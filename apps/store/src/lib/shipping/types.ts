import type { ShippingProviderId, ShippingSettings } from "@luratha/schemas";

/** Item enviado ao provider de cálculo. Pesos/dimensões já resolvidos com fallback. */
export interface ShippingItemInput {
  productId: string;
  quantity: number;
  /** Peso unitário em kg (já com fallback aplicado). */
  weightKg: number;
  /** Dimensões unitárias em cm (já com fallback aplicado). */
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** Valor declarado unitário em BRL — alguns providers cobram seguro proporcional. */
  unitPrice: number;
}

export interface CalculateShippingInput {
  /** CEP de destino no formato 99999-999. */
  destinationPostalCode: string;
  /** CEP de origem no formato 99999-999. */
  originPostalCode: string;
  items: ShippingItemInput[];
}

export interface ShippingQuote {
  providerId: ShippingProviderId;
  /** Código interno do serviço dentro do provider (ex.: "1" PAC no Melhor Envio). */
  serviceCode: string;
  carrier: string;
  service: string;
  /** Preço cobrado em BRL (antes de aplicar regra de frete grátis). */
  price: number;
  /** Prazo estimado em dias úteis. */
  estimatedDays: number;
}

export interface TrackingEvent {
  occurredAt: string;
  status: string;
  description?: string;
  location?: string;
}

export interface TrackingInfo {
  trackingCode: string;
  carrier: string;
  trackingUrl: string;
  events: TrackingEvent[];
  /** true quando a transportadora reportou entrega. */
  delivered: boolean;
}

/**
 * Contrato de qualquer provider de frete plugável.
 *
 * `track()` é opcional para providers que não suportam rastreamento ativo
 * (ex.: tabela fixa) — nesse caso a UI cai no fluxo manual de `trackingCode`.
 */
export interface ShippingProvider {
  readonly id: ShippingProviderId;
  calculate(input: CalculateShippingInput, settings: ShippingSettings): Promise<ShippingQuote[]>;
  track?(trackingCode: string, settings: ShippingSettings): Promise<TrackingInfo>;
}

export class ShippingProviderError extends Error {
  readonly providerId: ShippingProviderId | "unknown";
  readonly code:
    | "config_missing"
    | "invalid_input"
    | "provider_unavailable"
    | "not_supported"
    | "unknown";
  readonly cause?: unknown;
  /** HTTP status of the provider response, when the error came from a non-ok HTTP reply. */
  readonly httpStatus?: number;

  constructor(
    message: string,
    providerId: ShippingProviderId | "unknown",
    code: ShippingProviderError["code"],
    cause?: unknown,
    httpStatus?: number,
  ) {
    super(message);
    this.name = "ShippingProviderError";
    this.providerId = providerId;
    this.code = code;
    this.cause = cause;
    this.httpStatus = httpStatus;
  }
}
