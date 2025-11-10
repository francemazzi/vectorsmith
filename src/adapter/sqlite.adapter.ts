import {
  ExtensionNotFoundError,
  getExtensionPath,
  getPlatformPackageName,
} from "@sqliteai/sqlite-vector";
import Database from "better-sqlite3";
import type { Database as BetterSqlite3Database } from "better-sqlite3";

export type SqliteDistanceMetric = "cosine" | "l2" | "dot" | "inner_product";
export type SqliteVectorType = "FLOAT32";

export interface SqliteExtensionConfig {
  path: string;
  entryPoint?: string;
}

export interface SqliteAdapterConfig {
  databasePath: string;
  vectorDimension: number;
  defaultTable?: string;
  distanceMetric?: SqliteDistanceMetric;
  vectorType?: SqliteVectorType;
  pragmas?: Record<string, string | number | boolean>;
  extensions?: SqliteExtensionConfig[];
}

export interface SqliteSearchResult {
  id: number;
  embedding: number[];
  metadata: Record<string, unknown> | null;
  distance: number;
}

export class SqliteAdapter {
  private database: BetterSqlite3Database | null = null;
  private readonly config: SqliteAdapterConfig;
  private readonly vectorType: SqliteVectorType;
  private readonly distanceMetric: string;
  private readonly vectorColumnName = "embedding";

  public constructor(config: SqliteAdapterConfig) {
    if (config.vectorDimension <= 0) {
      throw new Error("Vector dimension must be greater than zero.");
    }

    this.config = config;
    this.vectorType = config.vectorType ?? "FLOAT32";
    this.distanceMetric = this.mapDistanceMetric(config.distanceMetric);
  }

  public connect(): void {
    if (this.database) {
      return;
    }

    this.database = new Database(this.config.databasePath);

    this.applyPragmas();
    this.loadSqliteVectorExtension();
    this.loadAdditionalExtensions();

    if (this.config.defaultTable) {
      this.createTable(this.config.defaultTable);
    }
  }

  public disconnect(): void {
    if (this.database) {
      this.database.close();
      this.database = null;
    }
  }

  public isConnected(): boolean {
    return this.database !== null;
  }

  public createTable(tableName: string): void {
    this.ensureConnected();
    const escapedTable = this.escapeIdentifier(tableName);
    const statement = `
      CREATE TABLE IF NOT EXISTS ${escapedTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${this.vectorColumnName} BLOB NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `;
    this.database!.exec(statement);

    this.database!.prepare("SELECT vector_init(@table, @column, @params)").get({
      table: tableName,
      column: this.vectorColumnName,
      params: this.buildVectorInitParams(),
    });
  }

  public dropTable(tableName: string): void {
    this.ensureConnected();
    const escapedTable = this.escapeIdentifier(tableName);

    try {
      this.database!.prepare(
        "SELECT vector_quantize_cleanup(@table, @column)"
      ).get({
        table: tableName,
        column: this.vectorColumnName,
      });
    } catch {
      // Ignore cleanup errors; the table might not have been quantized.
    }

    this.database!.exec(`DROP TABLE IF EXISTS ${escapedTable}`);
  }

  public insertVector(
    tableName: string,
    vector: number[],
    metadata?: Record<string, unknown>
  ): number {
    this.ensureConnected();
    const escapedTable = this.escapeIdentifier(tableName);
    const statement = this.database!.prepare(
      `INSERT INTO ${escapedTable} (${this.vectorColumnName}, metadata)
       VALUES (${this.wrapVectorFunction("@embedding")}, @metadata)`
    );

    const result = statement.run({
      embedding: this.serializeVector(vector),
      metadata: metadata !== undefined ? JSON.stringify(metadata) : null,
    });

    return Number(result.lastInsertRowid);
  }

  public upsertVector(
    tableName: string,
    id: number,
    vector: number[],
    metadata?: Record<string, unknown>
  ): void {
    this.ensureConnected();
    const escapedTable = this.escapeIdentifier(tableName);
    const statement = this.database!.prepare(
      `INSERT INTO ${escapedTable} (id, ${this.vectorColumnName}, metadata)
       VALUES (@id, ${this.wrapVectorFunction("@embedding")}, @metadata)
       ON CONFLICT(id) DO UPDATE SET
         ${this.vectorColumnName} = excluded.${this.vectorColumnName},
         metadata = excluded.metadata`
    );

    statement.run({
      id,
      embedding: this.serializeVector(vector),
      metadata: metadata !== undefined ? JSON.stringify(metadata) : null,
    });
  }

  public deleteVector(tableName: string, id: number): boolean {
    this.ensureConnected();
    const escapedTable = this.escapeIdentifier(tableName);
    const statement = this.database!.prepare(
      `DELETE FROM ${escapedTable} WHERE id = @id`
    );
    const result = statement.run({ id });
    return result.changes > 0;
  }

  public searchSimilar(
    tableName: string,
    queryVector: number[],
    limit: number = 10,
    metric: SqliteDistanceMetric = this.config.distanceMetric ?? "cosine"
  ): SqliteSearchResult[] {
    this.ensureConnected();
    this.ensureDimension(queryVector);
    this.assertDistanceMetric(metric);

    const escapedTable = this.escapeIdentifier(tableName);
    const rows = this.database!.prepare(
      `SELECT source.id,
                source.${this.vectorColumnName} AS embedding_blob,
                source.metadata,
                match.distance
         FROM ${escapedTable} AS source
         JOIN vector_full_scan(
               @table,
               @column,
               ${this.wrapVectorFunction("@queryVector")},
               @limit
             ) AS match
           ON source.rowid = match.rowid
         ORDER BY match.distance
         LIMIT @limit`
    ).all({
      table: tableName,
      column: this.vectorColumnName,
      queryVector: this.serializeVector(queryVector),
      limit,
    }) as Array<{
      id: number;
      embedding_blob: Buffer;
      metadata: string | null;
      distance: number;
    }>;

    return rows.map<SqliteSearchResult>((row) => ({
      id: row.id,
      embedding: this.deserializeVector(row.embedding_blob),
      metadata: this.parseMetadata(row.metadata),
      distance: Number(row.distance),
    }));
  }

  private loadSqliteVectorExtension(): void {
    if (!this.database) {
      return;
    }

    const path = this.resolveExtensionPath();
    this.database.loadExtension(path);
  }

  private loadAdditionalExtensions(): void {
    if (!this.database || !this.config.extensions) {
      return;
    }

    for (const extension of this.config.extensions) {
      if (extension.entryPoint) {
        (
          this.database.loadExtension as unknown as (
            path: string,
            entryPoint?: string
          ) => BetterSqlite3Database
        )(extension.path, extension.entryPoint);
      } else {
        this.database.loadExtension(extension.path);
      }
    }
  }

  private applyPragmas(): void {
    if (!this.database || !this.config.pragmas) {
      return;
    }

    for (const [pragma, value] of Object.entries(this.config.pragmas)) {
      this.database.pragma(`${pragma} = ${value}`);
    }
  }

  private resolveExtensionPath(): string {
    try {
      return getExtensionPath();
    } catch (error) {
      if (error instanceof ExtensionNotFoundError) {
        const fallback = this.tryResolvePlatformPackage();
        if (fallback) {
          return fallback;
        }
      }
      throw error;
    }
  }

  private tryResolvePlatformPackage(): string | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleExport = require(getPlatformPackageName()) as {
        path?: string;
      };

      if (moduleExport?.path && typeof moduleExport.path === "string") {
        return moduleExport.path;
      }
    } catch {
      return null;
    }

    return null;
  }

  private ensureConnected(): void {
    if (!this.database) {
      throw new Error(
        "SQLite database is not connected. Call connect() first."
      );
    }
  }

  private ensureDimension(vector: number[]): void {
    if (vector.length !== this.config.vectorDimension) {
      throw new Error(
        `Vector dimension mismatch. Expected ${this.config.vectorDimension}, received ${vector.length}.`
      );
    }
  }

  private wrapVectorFunction(parameter: string): string {
    switch (this.vectorType) {
      case "FLOAT32":
        return `vector_as_f32(${parameter})`;
      default:
        throw new Error(`Unsupported vector type: ${this.vectorType}`);
    }
  }

  private serializeVector(vector: number[]): Buffer {
    this.ensureDimension(vector);

    switch (this.vectorType) {
      case "FLOAT32":
        return Buffer.from(new Float32Array(vector).buffer);
      default:
        throw new Error(`Unsupported vector type: ${this.vectorType}`);
    }
  }

  private deserializeVector(buffer: Buffer): number[] {
    switch (this.vectorType) {
      case "FLOAT32": {
        const arrayBuffer = this.bufferToArrayBuffer(buffer);
        return Array.from(new Float32Array(arrayBuffer));
      }
      default:
        throw new Error(`Unsupported vector type: ${this.vectorType}`);
    }
  }

  private buildVectorInitParams(): string {
    return `type=${this.vectorType},dimension=${this.config.vectorDimension},distance=${this.distanceMetric}`;
  }

  private parseMetadata(
    serialized: string | null
  ): Record<string, unknown> | null {
    if (serialized === null) {
      return null;
    }

    try {
      return JSON.parse(serialized) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private bufferToArrayBuffer(buffer: Buffer): ArrayBufferLike {
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  }

  private mapDistanceMetric(metric?: SqliteDistanceMetric): string {
    if (!metric) {
      return "cosine";
    }

    if (metric === "inner_product") {
      return "dot";
    }

    if (metric === "cosine" || metric === "l2" || metric === "dot") {
      return metric;
    }

    throw new Error(`Unsupported distance metric: ${metric}`);
  }

  private assertDistanceMetric(metric: SqliteDistanceMetric): void {
    const normalized = this.mapDistanceMetric(metric);

    if (normalized !== this.distanceMetric) {
      throw new Error(
        `Configured distance metric '${this.distanceMetric}' does not match requested metric '${normalized}'.`
      );
    }
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
