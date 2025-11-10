import {
  QdrantClient,
  type QdrantClientParams,
  Schemas,
} from "@qdrant/js-client-rest";

export type QdrantDistance = Schemas["Distance"];

export interface QdrantAdapterConfig {
  url?: string;
  endpoint?: string;
  clusterId?: string;
  apiKey?: string;
  timeoutMs?: number;
  defaultCollection?: string;
}

export interface QdrantPointInput {
  id: number | string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantSearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
  withPayload?: boolean;
}

export type QdrantSearchResult = Schemas["ScoredPoint"];

export class QdrantAdapter {
  private client: QdrantClient | null = null;
  private connected = false;
  private readonly config: QdrantAdapterConfig;

  public constructor(config: QdrantAdapterConfig = {}) {
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const options: QdrantClientParams = {
      url: this.resolveUrl(),
      apiKey: this.resolveApiKey(),
      timeout: this.config.timeoutMs ?? 10_000,
      checkCompatibility: false,
    };

    this.client = new QdrantClient(options);
    await this.client.getCollections();
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async createCollection(
    name: string,
    vectorSize: number,
    distance: QdrantDistance = "Cosine"
  ): Promise<void> {
    this.ensureConnected();

    await this.client!.createCollection(name, {
      vectors: {
        size: vectorSize,
        distance,
      },
    });
  }

  public async deleteCollection(name: string): Promise<void> {
    this.ensureConnected();
    await this.client!.deleteCollection(name);
  }

  public async listCollections(): Promise<string[]> {
    this.ensureConnected();
    const response = await this.client!.getCollections();
    return response.collections?.map((collection) => collection.name) ?? [];
  }

  public async upsert(
    collectionName: string,
    points: QdrantPointInput[],
    wait: boolean = true
  ): Promise<void> {
    this.ensureConnected();

    const payload: Schemas["PointStruct"][] = points.map((point) => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload,
    }));

    await this.client!.upsert(collectionName, {
      wait,
      points: payload,
    });
  }

  public async search(
    collectionName: string,
    vector: number[],
    options: QdrantSearchOptions = {}
  ): Promise<QdrantSearchResult[]> {
    this.ensureConnected();

    return await this.client!.search(collectionName, {
      vector,
      limit: options.limit ?? 10,
      filter: options.filter,
      score_threshold: options.scoreThreshold,
      with_payload: options.withPayload ?? true,
    });
  }

  private resolveUrl(): string {
    if (this.config.url) {
      return this.config.url;
    }

    const endpoint =
      this.config.endpoint ??
      process.env.QDRANT_ENDPOINT ??
      "http://localhost:6333";
    const clusterId = this.config.clusterId ?? process.env.QDRANT_CLUSTER_ID;

    if (clusterId && !endpoint.includes(clusterId)) {
      return `${endpoint.replace(/\/$/, "")}/${clusterId}`;
    }

    return endpoint;
  }

  private resolveApiKey(): string | undefined {
    if (this.config.apiKey !== undefined) {
      return this.config.apiKey;
    }

    const envKey = process.env.QDRANT_API_KEY;
    return envKey && envKey.length > 0 ? envKey : undefined;
  }

  private ensureConnected(): void {
    if (!this.client || !this.connected) {
      throw new Error("Qdrant client is not connected. Call connect() first.");
    }
  }
}
