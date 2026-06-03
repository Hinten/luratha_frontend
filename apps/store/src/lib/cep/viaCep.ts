/**
 * Consulta de CEP no ViaCEP (https://viacep.com.br) — grátis, sem chave, com CORS,
 * então roda tanto no browser (autocomplete do endereço) quanto no servidor
 * (enriquecer `ibgeCode`).
 *
 * A base do ViaCEP **não é exaustiva**: um CEP válido pode não constar. Por isso
 * "não encontrado" é um RESULTADO de negócio (`not_found`), não um erro — o
 * chamador trata como aviso, nunca como bloqueio. Timeout/rede/serviço fora viram
 * `error` (também não bloqueiam o cadastro; o formato já é validado por Zod).
 *
 * Segue o padrão de fetch externo de `lib/shipping/melhorEnvio/client.ts`:
 * AbortController + timeout, com catches estreitados (sem catch genérico).
 */

const VIACEP_TIMEOUT_MS = 5_000;

export type CepLookupResult =
  | {
      status: "found";
      logradouro: string;
      bairro: string;
      localidade: string;
      uf: string;
      /** Código IBGE do município (7 dígitos) quando disponível; "" se ausente. */
      ibge: string;
    }
  | { status: "not_found" }
  | { status: "error" };

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean | string;
}

/**
 * Consulta um CEP. Aceita com ou sem máscara; só dispara com exatamente 8 dígitos
 * (caso contrário devolve `not_found` — defensivo; os chamadores já validam o
 * formato antes).
 */
export async function lookupCep(cep: string): Promise<CepLookupResult> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return { status: "not_found" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VIACEP_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    // AbortError (timeout) ou TypeError (falha de rede) → serviço indisponível.
    if ((error instanceof Error && error.name === "AbortError") || error instanceof TypeError) {
      return { status: "error" };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) return { status: "error" };

  let data: ViaCepResponse;
  try {
    data = (await response.json()) as ViaCepResponse;
  } catch (error) {
    // Body não-JSON (SyntaxError) ou stream abortado/bloqueado (TypeError/DOMException).
    if (
      error instanceof SyntaxError ||
      error instanceof TypeError ||
      error instanceof DOMException
    ) {
      return { status: "error" };
    }
    throw error;
  }

  // ViaCEP sinaliza CEP inexistente com `{ "erro": true }` (às vezes string "true").
  if (data.erro === true || data.erro === "true") return { status: "not_found" };
  if (!data.localidade || !data.uf) return { status: "not_found" };

  return {
    status: "found",
    logradouro: data.logradouro ?? "",
    bairro: data.bairro ?? "",
    localidade: data.localidade,
    uf: data.uf,
    ibge: data.ibge ?? "",
  };
}
