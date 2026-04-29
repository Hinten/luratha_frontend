#!/usr/bin/env bash
# UserPromptSubmit hook for Claude Code.
#
# When a <github-webhook-activity> event reports a CI failure, fetch the
# failing job's logs from the GitHub API and inject them into the prompt
# context so Claude can diagnose without asking the user.
#
# Wired up in .claude/settings.json under hooks.UserPromptSubmit.
#
# Requires:
#   - curl, jq (both standard in the Code-on-the-Web sandbox)
#   - GH_TOKEN env var with `actions:read` (public repos) or `repo` scope
#     (private repos). Configure as a project secret in Claude Code.
#
# Behavior:
#   - No webhook failure detected -> silent exit 0 (~10ms overhead).
#   - Token missing -> emits a one-line context note so Claude knows why
#     logs are absent and can ask the user to configure it.
#   - Logs fetched -> last ~12KB injected via hookSpecificOutput.additionalContext.

set -uo pipefail

# Read hook input JSON from stdin.
input_json=$(cat)
prompt=$(printf '%s' "$input_json" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Bail unless this is a CI failure webhook event.
if [[ "$prompt" != *"<github-webhook-activity>"* ]]; then
  exit 0
fi
if [[ "$prompt" != *"Conclusion: failure"* ]]; then
  exit 0
fi

emit_context() {
  jq -n --arg ctx "$1" '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: $ctx
    }
  }'
}

if [ -z "${GH_TOKEN:-}" ]; then
  emit_context "[ci-logs] GH_TOKEN não configurado no ambiente. Configure como secret do projeto Claude Code (escopo \`repo\` + \`workflow\`) para que os logs do CI sejam buscados automaticamente em falhas."
  exit 0
fi

# Extract the failing job URL from the prompt.
url=$(printf '%s' "$prompt" | grep -oE 'https://github\.com/[^[:space:]]+/job/[0-9]+' | head -1)
if [ -z "$url" ]; then
  exit 0
fi

repo=$(printf '%s' "$url" | sed -E 's|https://github\.com/([^/]+/[^/]+)/.*|\1|')
job_id=$(printf '%s' "$url" | grep -oE '/job/[0-9]+' | grep -oE '[0-9]+')

if [ -z "$repo" ] || [ -z "$job_id" ]; then
  exit 0
fi

# Download to a temp file with a hard size cap, then tail the relevant portion.
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

http_code=$(curl -sL --max-time 30 --max-filesize 5000000 \
  -w '%{http_code}' \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -o "$tmpfile" \
  "https://api.github.com/repos/$repo/actions/jobs/$job_id/logs" 2>/dev/null) || true

if [ "$http_code" != "200" ]; then
  emit_context "[ci-logs] Falha ao buscar logs do job $job_id (HTTP $http_code). Verifique se GH_TOKEN tem permissão para o repo $repo."
  exit 0
fi

# Last 12KB, then last 250 lines (whichever is smaller).
logs=$(tail -c 12000 "$tmpfile" | tail -n 250)

if [ -z "$logs" ]; then
  exit 0
fi

emit_context "$(printf 'CI job logs (tail, repo=%s job=%s):\n\n%s' "$repo" "$job_id" "$logs")"
