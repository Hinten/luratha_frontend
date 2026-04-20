const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_EMBEDDING_DIMENSIONS = 2048;
const MIN_EMBEDDING_DIMENSIONS = 8;

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
}

type CreateEmbeddingServiceOptions = {
  projectId?: string;
  location?: string;
  model?: string;
  accessToken?: string;
  timeoutMs?: number;
};

export function normalizeEmbeddingDimensions(values: number[]): number[] {
  const normalized = values.filter((value) => Number.isFinite(value));
  if (normalized.length < MIN_EMBEDDING_DIMENSIONS) {
    throw new Error("Embedding returned less than the minimum required dimensions.");
  }
  return normalized.slice(0, MAX_EMBEDDING_DIMENSIONS);
}

export function createEmbeddingService(
  options: CreateEmbeddingServiceOptions = {},
): EmbeddingService {
  const projectId = options.projectId ?? process.env.VERTEX_AI_PROJECT_ID;
  const location = options.location ?? process.env.VERTEX_AI_LOCATION ?? "us-central1";
  const model = options.model ?? process.env.VERTEX_AI_EMBEDDING_MODEL ?? "text-embedding-005";
  const accessToken = options.accessToken ?? process.env.VERTEX_AI_ACCESS_TOKEN;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async embed(text: string): Promise<number[]> {
      const term = text.trim();
      if (!term) {
        throw new Error("Embedding input cannot be empty.");
      }
      if (!projectId || !accessToken) {
        throw new Error("Vertex AI configuration is missing.");
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
          throw new Error(`Vertex AI embedding request failed with status ${response.status}.`);
        }

        const json = (await response.json()) as {
          predictions?: Array<{
            embeddings?: { values?: number[] };
            values?: number[];
          }>;
        };

        const rawVector =
          json.predictions?.[0]?.embeddings?.values ??
          json.predictions?.[0]?.values ??
          [];

        return normalizeEmbeddingDimensions(rawVector);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
