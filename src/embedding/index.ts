import {
  JinaAIEmbeddingProvider,
  JinaEmbeddingModel,
  type EmbeddingProvider,
  type JinaAIEmbeddingProviderOptions,
} from "./jina_ai.embedding";
import {
  OpenAIEmbeddingProvider,
  OpenAIEmbeddingModel,
  type OpenAIEmbeddingProviderOptions,
} from "./openai.embedding";

export enum EmbeddingProviderType {
  Jina = "JINA",
  OpenAI = "OPENAI",
}

export interface JinaEmbeddingConfig {
  apiKey: string;
  model: JinaEmbeddingModel;
  options?: JinaAIEmbeddingProviderOptions;
}

export interface OpenAIEmbeddingConfig {
  apiKey: string;
  model: OpenAIEmbeddingModel;
  options?: OpenAIEmbeddingProviderOptions;
}

export interface VectorSmithEmbeddingConfig {
  defaultProvider?: EmbeddingProviderType;
  jina?: JinaEmbeddingConfig;
  openai?: OpenAIEmbeddingConfig;
}

export class VectorSmithEmbedding {
  private readonly providers: Map<EmbeddingProviderType, EmbeddingProvider>;
  private defaultProvider?: EmbeddingProviderType;

  public constructor(config: VectorSmithEmbeddingConfig = {}) {
    this.providers = new Map<EmbeddingProviderType, EmbeddingProvider>();

    if (config.jina) {
      this.providers.set(
        EmbeddingProviderType.Jina,
        new JinaAIEmbeddingProvider(
          config.jina.apiKey,
          config.jina.model,
          config.jina.options
        )
      );
    }

    if (config.openai) {
      this.providers.set(
        EmbeddingProviderType.OpenAI,
        new OpenAIEmbeddingProvider(
          config.openai.apiKey,
          config.openai.model,
          config.openai.options
        )
      );
    }

    if (this.providers.size === 0) {
      throw new Error(
        "VectorSmithEmbedding: configure at least one embedding provider."
      );
    }

    if (config.defaultProvider) {
      if (!this.providers.has(config.defaultProvider)) {
        throw new Error(
          `VectorSmithEmbedding: defaultProvider ${config.defaultProvider} is not configured.`
        );
      }
      this.defaultProvider = config.defaultProvider;
    } else if (this.providers.size === 1) {
      this.defaultProvider = this.providers.keys().next().value;
    }
  }

  public hasProvider(type: EmbeddingProviderType): boolean {
    return this.providers.has(type);
  }

  public setDefaultProvider(type: EmbeddingProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(
        `VectorSmithEmbedding: provider ${type} is not configured; cannot set as default.`
      );
    }
    this.defaultProvider = type;
  }

  public getDefaultProviderType(): EmbeddingProviderType | undefined {
    return this.defaultProvider;
  }

  public getProvider(type?: EmbeddingProviderType): EmbeddingProvider {
    const resolvedType = type ?? this.defaultProvider;
    if (!resolvedType) {
      throw new Error(
        "VectorSmithEmbedding: no default provider configured; specify a provider type."
      );
    }
    const provider = this.providers.get(resolvedType);
    if (!provider) {
      throw new Error(
        `VectorSmithEmbedding: provider ${resolvedType} is not configured.`
      );
    }
    return provider;
  }

  public async embed(
    texts: string[],
    type?: EmbeddingProviderType
  ): Promise<number[][]> {
    return this.getProvider(type).embed(texts);
  }

  public async embedOne(
    text: string,
    type?: EmbeddingProviderType
  ): Promise<number[]> {
    return this.getProvider(type).embedOne(text);
  }
}

export type {
  EmbeddingProvider,
  JinaAIEmbeddingProviderOptions,
  OpenAIEmbeddingProviderOptions,
};
export {
  JinaAIEmbeddingProvider,
  JinaEmbeddingModel,
  OpenAIEmbeddingProvider,
  OpenAIEmbeddingModel,
};
