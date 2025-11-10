import { RedisAdapter, type RedisAdapterConfig } from "./redis.adapter";
import {
  PgVectorAdapter,
  type PgVectorAdapterConfig,
} from "./pg_vector.adpater";
import { QdrantAdapter, type QdrantAdapterConfig } from "./qdrant.adapter";
import { SqliteAdapter, type SqliteAdapterConfig } from "./sqlite.adapter";

export interface VectorSmithAdapterConfig {
  redis?: RedisAdapterConfig;
  pgvector?: PgVectorAdapterConfig;
  qdrant?: QdrantAdapterConfig;
  sqlite?: SqliteAdapterConfig;
}

export class VectorSmithAdapter {
  private redis?: RedisAdapter;
  private pgvector?: PgVectorAdapter;
  private qdrant?: QdrantAdapter;
  private sqlite?: SqliteAdapter;
  private readonly config: VectorSmithAdapterConfig;

  public constructor(config: VectorSmithAdapterConfig = {}) {
    this.config = config;

    if (config.redis) {
      this.redis = new RedisAdapter(config.redis);
    }

    if (config.pgvector) {
      this.pgvector = new PgVectorAdapter(config.pgvector);
    }

    if (config.sqlite) {
      this.sqlite = new SqliteAdapter(config.sqlite);
    }

    if (config.qdrant) {
      this.qdrant = new QdrantAdapter(config.qdrant);
    }
  }

  public async connect(): Promise<void> {
    const connections: Promise<void>[] = [];

    if (this.redis) {
      connections.push(this.redis.connect());
    }

    if (this.pgvector) {
      connections.push(this.pgvector.connect());
    }

    if (this.sqlite) {
      connections.push(
        Promise.resolve().then(() => {
          this.sqlite!.connect();
        })
      );
    }

    if (this.qdrant) {
      connections.push(this.qdrant.connect());
    }

    if (connections.length === 0) {
      throw new Error(
        "No database adapters configured. Provide at least one database configuration."
      );
    }

    await Promise.all(connections);
  }

  public async disconnect(): Promise<void> {
    const disconnections: Promise<void>[] = [];

    if (this.redis?.isConnected()) {
      disconnections.push(this.redis.disconnect());
    }

    if (this.pgvector?.isConnected()) {
      disconnections.push(this.pgvector.disconnect());
    }

    if (this.sqlite?.isConnected()) {
      disconnections.push(
        Promise.resolve().then(() => {
          this.sqlite!.disconnect();
        })
      );
    }

    if (this.qdrant?.isConnected()) {
      disconnections.push(this.qdrant.disconnect());
    }

    await Promise.all(disconnections);
  }

  public getRedis(): RedisAdapter {
    if (!this.redis) {
      throw new Error("Redis adapter is not configured.");
    }
    return this.redis;
  }

  public getPgVector(): PgVectorAdapter {
    if (!this.pgvector) {
      throw new Error("PgVector adapter is not configured.");
    }
    return this.pgvector;
  }

  public getSqlite(): SqliteAdapter {
    if (!this.sqlite) {
      throw new Error("SQLite adapter is not configured.");
    }
    return this.sqlite;
  }

  public getQdrant(): QdrantAdapter {
    if (!this.qdrant) {
      throw new Error("Qdrant adapter is not configured.");
    }
    return this.qdrant;
  }

  public isConnected(): boolean {
    let connected = false;

    if (this.redis) {
      connected = connected || this.redis.isConnected();
    }

    if (this.pgvector) {
      connected = connected || this.pgvector.isConnected();
    }

    if (this.sqlite) {
      connected = connected || this.sqlite.isConnected();
    }

    if (this.qdrant) {
      connected = connected || this.qdrant.isConnected();
    }

    return connected;
  }
}
