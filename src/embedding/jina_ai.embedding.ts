export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  embedOne(text: string): Promise<number[]>;
}

export interface JinaAIEmbeddingProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  expectedDimensions?: number;
}

export enum JinaEmbeddingModel {
  CodeEmbeddings_0_5B = "jina-code-embeddings-0.5b",
  CodeEmbeddings_1_5B = "jina-code-embeddings-1.5b",
  Embeddings_V2_Base_Code = "jina-embeddings-v2-base-code",
}

interface JinaEmbeddingItem {
  embedding: number[];
  index?: number;
}

interface JinaEmbeddingResponse {
  data: JinaEmbeddingItem[];
}

export class JinaAIEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: JinaEmbeddingModel;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly expectedDimensions?: number;

  public constructor(
    apiKey: string,
    model: JinaEmbeddingModel,
    options: JinaAIEmbeddingProviderOptions = {}
  ) {
    if (!apiKey) {
      throw new Error("JinaAIEmbeddingProvider: apiKey is required");
    }
    if (!model) {
      throw new Error("JinaAIEmbeddingProvider: model is required");
    }
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = options.baseUrl ?? "https://api.jina.ai/v1";
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.expectedDimensions = options.expectedDimensions;
  }

  public static fromEnv(
    options: JinaAIEmbeddingProviderOptions = {}
  ): JinaAIEmbeddingProvider {
    const apiKey = process.env.JINA_API_KEY ?? "";
    const modelStr = process.env.JINA_EMBEDDING_MODEL ?? "";
    const model = toJinaEmbeddingModel(modelStr);
    return new JinaAIEmbeddingProvider(apiKey, model, options);
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
        throw new Error(`Jina embeddings failed: ${res.status} ${errText}`);
      }

      const json = (await res.json()) as JinaEmbeddingResponse;
      if (!json?.data || !Array.isArray(json.data)) {
        throw new Error("Jina embeddings: unexpected response shape");
      }
      const vectors = json.data.map((d) => d.embedding);

      if (this.expectedDimensions != null) {
        for (const v of vectors) {
          if (!Array.isArray(v) || v.length !== this.expectedDimensions) {
            throw new Error(
              `Jina embeddings: dimension mismatch (expected ${
                this.expectedDimensions
              }, got ${Array.isArray(v) ? v.length : "invalid"})`
            );
          }
        }
      }

      return vectors;
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`Jina embeddings timed out after ${this.timeoutMs}ms`);
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

function toJinaEmbeddingModel(value: string): JinaEmbeddingModel {
  const allowed = Object.values(JinaEmbeddingModel) as string[];
  if (allowed.includes(value)) {
    return value as JinaEmbeddingModel;
  }
  throw new Error(
    `Invalid JINA_EMBEDDING_MODEL "${value}". Valid values: ${allowed.join(
      ", "
    )}`
  );
}
