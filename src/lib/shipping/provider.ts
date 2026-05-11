import type { ShippingProviderId } from "@/src/schemas/firestore";
import { melhorEnvioProvider } from "@/src/lib/shipping/melhorEnvio";
import { fixedRateProvider } from "@/src/lib/shipping/fallback/fixedRateProvider";
import type { ShippingProvider } from "@/src/lib/shipping/types";

/**
 * Registry de providers disponíveis. Adicionar um novo provider passa por:
 *   1) implementar o `ShippingProvider`
 *   2) registrar aqui
 *   3) incluir o id em `SHIPPING_PROVIDER_IDS` no schema
 */
const REGISTRY: Record<ShippingProviderId, ShippingProvider> = {
  "melhor-envio": melhorEnvioProvider,
  "fixed-rate": fixedRateProvider,
};

export function getShippingProvider(providerId: ShippingProviderId): ShippingProvider {
  const provider = REGISTRY[providerId];
  if (!provider) {
    throw new Error(`Shipping provider "${providerId}" não registrado.`);
  }
  return provider;
}

/** Provider que sempre existe — usado como degradação quando o externo falha. */
export function getFallbackProvider(): ShippingProvider {
  return fixedRateProvider;
}

/** Testes injetam um provider mock substituindo o registry. */
export function __setShippingProviderForTests(
  providerId: ShippingProviderId,
  provider: ShippingProvider,
): void {
  REGISTRY[providerId] = provider;
}
