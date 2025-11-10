import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { VectorSmithAdapter } from "../../src/adapter/index.adapter";

describe("VectorSmith Integration Tests", () => {
  let adapter: VectorSmithAdapter;

  beforeAll(() => {
    adapter = new VectorSmithAdapter({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT || 6380),
      },
      pgvector: {
        host: process.env.PG_HOST || "localhost",
        port: Number(process.env.PG_PORT || 55432),
        user: process.env.PG_USER || "vectorsmith",
        password: process.env.PG_PASSWORD || "vectorsmith",
        database: process.env.PG_DB || "vectorsmith",
      },
      qdrant: {
        url: process.env.QDRANT_ENDPOINT || "http://localhost:6333",
        apiKey: process.env.QDRANT_API_KEY,
        clusterId: process.env.QDRANT_CLUSTER_ID,
        defaultCollection: "vectorsmith_integration",
      },
    });
  });

  afterAll(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  it("should connect to all configured databases", async () => {
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);
    await adapter.disconnect();
  });

  it("should access Redis adapter", async () => {
    await adapter.connect();
    try {
      const redis = adapter.getRedis();

      const key = "test:vectorsmith:redis";
      await redis.set(key, "test-value");
      const value = await redis.get(key);

      expect(value).toBe("test-value");
      await redis.delete(key);
    } finally {
      await adapter.disconnect();
    }
  });

  it("should access PgVector adapter", async () => {
    await adapter.connect();
    const tableName = "test_vectorsmith_table";
    try {
      const pgvector = adapter.getPgVector();
      await pgvector.createTable(tableName, 3);
      const id = await pgvector.insertVector(tableName, [1.0, 2.0, 3.0]);

      expect(id).toBeGreaterThan(0);
    } finally {
      const pgvector = adapter.getPgVector();
      await pgvector.dropTable(tableName);
      await adapter.disconnect();
    }
  });

  it("should work with only Redis configured", async () => {
    const redisOnly = new VectorSmithAdapter({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT || 6380),
      },
    });

    await redisOnly.connect();
    try {
      const redis = redisOnly.getRedis();
      const key = "test:redis-only";
      await redis.set(key, "value");
      const value = await redis.get(key);
      expect(value).toBe("value");
      await redis.delete(key);
    } finally {
      await redisOnly.disconnect();
    }
  });

  it("should work with only PgVector configured", async () => {
    const pgvectorOnly = new VectorSmithAdapter({
      pgvector: {
        host: process.env.PG_HOST || "localhost",
        port: Number(process.env.PG_PORT || 55432),
        user: process.env.PG_USER || "vectorsmith",
        password: process.env.PG_PASSWORD || "vectorsmith",
        database: process.env.PG_DB || "vectorsmith",
      },
    });

    await pgvectorOnly.connect();
    const tableName = "test_pgvector_only";
    try {
      const pgvector = pgvectorOnly.getPgVector();
      await pgvector.createTable(tableName, 3);
      const id = await pgvector.insertVector(tableName, [1.0, 2.0, 3.0]);
      expect(id).toBeGreaterThan(0);
    } finally {
      const pgvector = pgvectorOnly.getPgVector();
      await pgvector.dropTable(tableName);
      await pgvectorOnly.disconnect();
    }
  });

  it("should access Qdrant adapter", async () => {
    await adapter.connect();
    const collectionName = "vectorsmith_adapter_test";
    try {
      const qdrant = adapter.getQdrant();
      await qdrant.createCollection(collectionName, 3);
      await qdrant.upsert(collectionName, [
        { id: 1, vector: [0.1, 0.2, 0.3], payload: { label: "alpha" } },
        { id: 2, vector: [0.2, 0.1, 0.4], payload: { label: "beta" } },
      ]);

      const results = await qdrant.search(collectionName, [0.1, 0.2, 0.3], {
        limit: 1,
        withPayload: true,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].payload?.label).toBeDefined();
    } finally {
      const qdrant = adapter.getQdrant();
      await qdrant.deleteCollection(collectionName);
      await adapter.disconnect();
    }
  });

  it("should work with only Qdrant configured", async () => {
    const qdrantOnly = new VectorSmithAdapter({
      qdrant: {
        url: process.env.QDRANT_ENDPOINT || "http://localhost:6333",
        apiKey: process.env.QDRANT_API_KEY,
        clusterId: process.env.QDRANT_CLUSTER_ID,
      },
    });

    const collectionName = "vectorsmith_qdrant_only";

    await qdrantOnly.connect();
    try {
      const qdrant = qdrantOnly.getQdrant();
      await qdrant.createCollection(collectionName, 3);
      await qdrant.upsert(collectionName, [{ id: 1, vector: [0.3, 0.2, 0.1] }]);

      const results = await qdrant.search(collectionName, [0.3, 0.2, 0.1], {
        limit: 1,
      });
      expect(results.length).toBeGreaterThan(0);
    } finally {
      const qdrant = qdrantOnly.getQdrant();
      await qdrant.deleteCollection(collectionName);
      await qdrantOnly.disconnect();
    }
  });

  it("should throw error when trying to access unconfigured adapter", async () => {
    const redisOnly = new VectorSmithAdapter({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT || 6380),
      },
    });

    expect(() => redisOnly.getPgVector()).toThrow(
      "PgVector adapter is not configured."
    );
    expect(() => redisOnly.getQdrant()).toThrow(
      "Qdrant adapter is not configured."
    );
  });

  it("should throw error when no adapters are configured", async () => {
    const empty = new VectorSmithAdapter({});

    await expect(empty.connect()).rejects.toThrow(
      "No database adapters configured"
    );
  });

  it("should disconnect from all databases", async () => {
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);

    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });
});
