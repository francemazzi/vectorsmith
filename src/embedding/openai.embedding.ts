import type { EmbeddingProvider } from "./jina_ai.embedding";

export interface OpenAIEmbeddingProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  expectedDimensions?: number;
}

export enum OpenAIEmbeddingModel {
  TextEmbedding3Small = "text-embedding-3-small",
  TextEmbedding3Large = "text-embedding-3-large",
}

interface OpenAIEmbeddingItem {
  embedding: number[];
  index?: number;
  object?: string;
}

interface OpenAIEmbeddingResponse {
  data: OpenAIEmbeddingItem[];
  model?: string;
  object?: string;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: OpenAIEmbeddingModel;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly expectedDimensions?: number;

  public constructor(
    apiKey: string,
    model: OpenAIEmbeddingModel,
    options: OpenAIEmbeddingProviderOptions = {}
  ) {
    if (!apiKey) {
      throw new Error("OpenAIEmbeddingProvider: apiKey is required");
    }
    if (!model) {
      throw new Error("OpenAIEmbeddingProvider: model is required");
    }
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.expectedDimensions = options.expectedDimensions;
  }

  public static fromEnv(
    options: OpenAIEmbeddingProviderOptions = {}
  ): OpenAIEmbeddingProvider {
    const apiKey = process.env.OPENAI_API_KEY ?? "";
    const modelStr =
      (process.env.OPENAI_EMBEDDING_MODEL as
        | OpenAIEmbeddingModel
        | undefined) ?? OpenAIEmbeddingModel.TextEmbedding3Small;
    const model = toOpenAIEmbeddingModel(modelStr);
    return new OpenAIEmbeddingProvider(apiKey, model, options);
  }

  public async embed(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error("embed: provide a non-empty array of texts");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await safeReadText(res);
        throw new Error(`OpenAI embeddings failed: ${res.status} ${errText}`);
      }

      const json = (await res.json()) as OpenAIEmbeddingResponse;
      if (!json?.data || !Array.isArray(json.data)) {
        throw new Error("OpenAI embeddings: unexpected response shape");
      }
      const vectors = json.data.map((d) => d.embedding);

      if (this.expectedDimensions != null) {
        for (const v of vectors) {
          if (!Array.isArray(v) || v.length !== this.expectedDimensions) {
            throw new Error(
              `OpenAI embeddings: dimension mismatch (expected ${
                this.expectedDimensions
              }, got ${Array.isArray(v) ? v.length : "invalid"})`
            );
          }
        }
      }

      return vectors;
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(
          `OpenAI embeddings timed out after ${this.timeoutMs}ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async embedOne(text: string): Promise<number[]> {
    const [vector] = await this.embed([text]);
    return vector;
  }
}

function toOpenAIEmbeddingModel(value: string): OpenAIEmbeddingModel {
  const allowed = Object.values(OpenAIEmbeddingModel) as string[];
  if (allowed.includes(value)) {
    return value as OpenAIEmbeddingModel;
  }
  throw new Error(
    `Invalid OPENAI_EMBEDDING_MODEL "${value}". Valid values: ${allowed.join(
      ", "
    )}`
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
