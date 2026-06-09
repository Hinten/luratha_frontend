import type { Credential } from "firebase-admin/app";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_EMBEDDING_DIMENSIONS = 2048;
const MIN_EMBEDDING_DIMENSIONS = 8;

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
}

/**
 * Thrown by the embedding service when an embedding cannot be produced —
 * missing Vertex AI configuration, upstream HTTP error, empty input, or
 * a degenerate vector response. API routes narrow on this to keep
 * embedding generation non-fatal while still letting *unknown* errors
 * surface in logs.
 */
export class EmbeddingGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingGenerationError";
  }
}

type CreateEmbeddingServiceOptions = {
  projectId?: string;
  location?: string;
  model?: string;
  /** Static access token. Takes precedence over `credential`. */
  accessToken?: string;
  /**
   * Firebase Admin credential (from `firebase-admin/app`).
   * When provided, a fresh OAuth token is fetched via `credential.getAccessToken()`
   * on every call, so tokens are automatically refreshed.
   */
  credential?: Credential;
  timeoutMs?: number;
};

export function normalizeEmbeddingDimensions(values: number[]): number[] {
  const normalized = values.filter((value) => Number.isFinite(value));
  if (normalized.length < MIN_EMBEDDING_DIMENSIONS) {
    throw new EmbeddingGenerationError(
      "Embedding returned less than the minimum required dimensions.",
    );
  }
  return normalized.slice(0, MAX_EMBEDDING_DIMENSIONS);
}

export function createEmbeddingService(
  options: CreateEmbeddingServiceOptions = {},
): EmbeddingService {
  const projectId = options.projectId ?? process.env.VERTEX_AI_PROJECT_ID;
  const location = options.location ?? process.env.VERTEX_AI_LOCATION ?? "us-central1";
  const model = options.model ?? process.env.VERTEX_AI_EMBEDDING_MODEL ?? "text-embedding-005";
  const staticAccessToken = options.accessToken ?? process.env.VERTEX_AI_ACCESS_TOKEN;
  const credential = options.credential;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async embed(text: string): Promise<number[]> {
      const term = text.trim();
      if (!term) {
        throw new EmbeddingGenerationError("Embedding input cannot be empty.");
      }
      if (!projectId) {
        throw new EmbeddingGenerationError("Vertex AI configuration is missing.");
      }

      // Resolve access token: static value takes precedence; otherwise use credential
      let accessToken: string;
      if (staticAccessToken) {
        accessToken = staticAccessToken;
      } else if (credential) {
        const tokenResult = await credential.getAccessToken();
        accessToken = tokenResult.access_token;
      } else {
        throw new EmbeddingGenerationError("Vertex AI configuration is missing.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            instances: [{ content: term }],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new EmbeddingGenerationError(
            `Vertex AI embedding request failed with status ${response.status} - ${errorBody}.`,
          );
        }

        const json = (await response.json()) as {
          predictions?: Array<{
            embeddings?: { values?: number[] };
            values?: number[];
          }>;
        };

        const rawVector =
          json.predictions?.[0]?.embeddings?.values ?? json.predictions?.[0]?.values ?? [];

        return normalizeEmbeddingDimensions(rawVector);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
