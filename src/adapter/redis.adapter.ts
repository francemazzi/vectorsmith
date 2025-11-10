import { createClient, RedisClientType } from "redis";

export interface RedisAdapterConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  database?: number;
}

export class RedisAdapter {
  private client: RedisClientType | null = null;
  private readonly config: RedisAdapterConfig;

  public constructor(config: RedisAdapterConfig = {}) {
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.client?.isOpen) {
      return;
    }

    const connectionUrl = this.config.url ?? this.buildConnectionUrl();
    this.client = createClient({ url: connectionUrl });

    this.client.on("error", (error) => {
      console.error("Redis Client Error:", error);
    });

    await this.client.connect();
  }

  public async disconnect(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      this.client = null;
    }
  }

  public async get(key: string): Promise<string | null> {
    this.ensureConnected();
    return await this.client!.get(key);
  }

  public async set(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<void> {
    this.ensureConnected();
    if (ttlSeconds) {
      await this.client!.setEx(key, ttlSeconds, value);
    } else {
      await this.client!.set(key, value);
    }
  }

  public async delete(key: string): Promise<boolean> {
    this.ensureConnected();
    const result = await this.client!.del(key);
    return result > 0;
  }

  public async exists(key: string): Promise<boolean> {
    this.ensureConnected();
    const result = await this.client!.exists(key);
    return result > 0;
  }

  public async keys(pattern: string): Promise<string[]> {
    this.ensureConnected();
    return await this.client!.keys(pattern);
  }

  public isConnected(): boolean {
    return this.client?.isOpen ?? false;
  }

  private buildConnectionUrl(): string {
    const { host = "localhost", port = 6379, password, database } = this.config;
    const auth = password ? `:${password}@` : "";
    const db = database !== undefined ? `/${database}` : "";
    return `redis://${auth}${host}:${port}${db}`;
  }

  private ensureConnected(): void {
    if (!this.client?.isOpen) {
      throw new Error("Redis client is not connected. Call connect() first.");
    }
  }
}
