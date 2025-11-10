import { Pool, PoolClient } from "pg";

export interface PgVectorAdapterConfig {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}

export class PgVectorAdapter {
  private pool: Pool | null = null;
  private readonly config: PgVectorAdapterConfig;

  public constructor(config: PgVectorAdapterConfig = {}) {
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const connectionConfig = this.config.url
      ? { connectionString: this.config.url }
      : {
          host: this.config.host || "localhost",
          port: this.config.port || 5432,
          user: this.config.user || "postgres",
          password: this.config.password,
          database: this.config.database || "postgres",
          ssl: this.config.ssl,
        };

    this.pool = new Pool(connectionConfig);

    this.pool.on("error", (error) => {
      console.error("PostgreSQL Pool Error:", error);
    });

    // Verify connection and pgvector extension
    const client = await this.pool.connect();
    try {
      await client.query("SELECT 1");
      await this.ensurePgVectorExtension(client);
    } finally {
      client.release();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  public async createTable(
    tableName: string,
    vectorDimension: number
  ): Promise<void> {
    this.ensureConnected();
    const client = await this.pool!.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.escapeIdentifier(tableName)} (
          id SERIAL PRIMARY KEY,
          embedding vector(${vectorDimension}),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } finally {
      client.release();
    }
  }

  public async insertVector(
    tableName: string,
    embedding: number[],
    metadata?: Record<string, unknown>
  ): Promise<number> {
    this.ensureConnected();
    const client = await this.pool!.connect();
    try {
      const vectorString = `[${embedding.join(",")}]`;
      const result = await client.query(
        `INSERT INTO ${this.escapeIdentifier(tableName)} (embedding, metadata) 
         VALUES ($1::vector, $2::jsonb) 
         RETURNING id`,
        [vectorString, metadata ? JSON.stringify(metadata) : null]
      );
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  public async searchSimilar(
    tableName: string,
    queryVector: number[],
    limit: number = 10,
    distanceFunction: "cosine" | "l2" | "inner_product" = "cosine"
  ): Promise<
    Array<{
      id: number;
      embedding: number[];
      metadata: unknown;
      distance: number;
    }>
  > {
    this.ensureConnected();
    const client = await this.pool!.connect();
    try {
      const vectorString = `[${queryVector.join(",")}]`;
      let distanceExpr: string;

      switch (distanceFunction) {
        case "cosine":
          distanceExpr = "1 - (embedding <=> $1::vector)";
          break;
        case "l2":
          distanceExpr = "embedding <-> $1::vector";
          break;
        case "inner_product":
          distanceExpr = "embedding <#> $1::vector";
          break;
      }

      const result = await client.query(
        `SELECT id, embedding::text, metadata, ${distanceExpr} as distance
         FROM ${this.escapeIdentifier(tableName)}
         ORDER BY embedding <-> $1::vector
         LIMIT $2`,
        [vectorString, limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        embedding: this.parseVector(row.embedding),
        metadata: row.metadata,
        distance: parseFloat(row.distance),
      }));
    } finally {
      client.release();
    }
  }

  public async deleteVector(tableName: string, id: number): Promise<boolean> {
    this.ensureConnected();
    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `DELETE FROM ${this.escapeIdentifier(tableName)} WHERE id = $1`,
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  public async dropTable(tableName: string): Promise<void> {
    this.ensureConnected();
    const client = await this.pool!.connect();
    try {
      await client.query(
        `DROP TABLE IF EXISTS ${this.escapeIdentifier(tableName)}`
      );
    } finally {
      client.release();
    }
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }

  private async ensurePgVectorExtension(client: PoolClient): Promise<void> {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private parseVector(vectorString: string): number[] {
    // Remove brackets and parse
    const cleaned = vectorString.replace(/[\[\]]/g, "");
    return cleaned.split(",").map((v) => parseFloat(v.trim()));
  }

  private ensureConnected(): void {
    if (!this.pool) {
      throw new Error(
        "PostgreSQL pool is not connected. Call connect() first."
      );
    }
  }
}
