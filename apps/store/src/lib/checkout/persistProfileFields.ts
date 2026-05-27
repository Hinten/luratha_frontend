import { ApiResponseError } from "@/src/lib/errors";
import { formatCpf } from "@/src/lib/format/cpf";
import type { PaymentPayer } from "@/src/components/checkout/PaymentStep";

/**
 * Persiste lastName + taxIdentity (CPF) no UserProfile após o usuário avançar
 * do step "Seus dados", pra próxima compra pré-popular esses campos. Lança
 * `ApiResponseError` (HTTP não-OK) ou `TypeError` (falha de rede) — o caller
 * narra e exibe o erro pro usuário antes de avançar.
 *
 * Fluxo: tenta PATCH (atualizar doc existente). Se retornar **404** — caso de
 * usuários antigos cujo doc `userProfiles/{uid}` nunca foi criado no signup —
 * faz fallback pra PUT, que é idempotente e cria o perfil completo a partir
 * dos dados do payer + role `customer`.
 *
 * PJ fica fora do taxIdentity porque o form do checkout não coleta
 * `legalName` / `stateRegistration` exigidos pelo `userProfileSchema` PJ — o
 * user fica livre pra completar isso depois no perfil.
 */
export async function persistProfileFields(
  userId: string,
  payer: PaymentPayer,
): Promise<void> {
  const patchBody: Record<string, unknown> = { lastName: payer.lastName };
  if (payer.identification.type === "CPF") {
    patchBody.taxIdentity = {
      type: "PF",
      cpf: formatCpf(payer.identification.number),
    };
  }

  const patchRes = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patchBody),
  });

  if (patchRes.ok) return;

  if (patchRes.status === 404) {
    // Perfil não existe → criar via PUT (upsert) com todos os campos
    // mínimos exigidos pelo `userProfileSchema`. firstName pode ter vindo
    // vazio do form (validação Zod já barra), mas reforçamos com fallback
    // pra não quebrar o PUT em caso de race.
    const putBody: Record<string, unknown> = {
      email: payer.email,
      firstName: payer.firstName ?? "",
      lastName: payer.lastName ?? "",
      role: "customer",
    };
    if (payer.identification.type === "CPF") {
      putBody.taxIdentity = {
        type: "PF",
        cpf: formatCpf(payer.identification.number),
      };
    }

    const putRes = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(putBody),
    });
    if (!putRes.ok) {
      const body = (await putRes.json().catch(() => ({}))) as { message?: string };
      throw new ApiResponseError(
        body.message ?? "Não foi possível criar seu perfil.",
        putRes.status,
      );
    }
    return;
  }

  const body = (await patchRes.json().catch(() => ({}))) as { message?: string };
  throw new ApiResponseError(
    body.message ?? "Não foi possível salvar seus dados.",
    patchRes.status,
  );
}
