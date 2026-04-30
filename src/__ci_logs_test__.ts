// Intentional TypeScript error — verifies the CI log comment workflow.
// post-ci-logs.yml should post the tsc error as a comment on this PR.
// This commit must be reverted before merging.

export const ciLogsTest: number = "this is not a number";
