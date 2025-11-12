import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { VectorSmithAdapter } from "../../src/adapter/index.adapter";
import {
  RedisRetriever,
  PgVectorRetriever,
  QdrantRetriever,
} from "../../src/retrieve";

describe("Retrieve Integration Flow", () => {
  let adapter: VectorSmithAdapter;
  let redisRetriever: RedisRetriever;
  let pgVectorRetriever: PgVectorRetriever;
  let qdrantRetriever: QdrantRetriever;

  beforeAll(async () => {
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
      },
    });

    await adapter.connect();

    redisRetriever = new RedisRetriever(adapter.getRedis());
    pgVectorRetriever = new PgVectorRetriever(adapter.getPgVector());
    qdrantRetriever = new QdrantRetriever(adapter.getQdrant());
  });

  afterAll(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  it("recupera un valore da Redis", async () => {
    const redis = adapter.getRedis();
    const key = "integration:retrieve:redis";

    await redis.set(key, "value");
    try {
      const result = await redisRetriever.retrieve({
        query: { key },
      });
      expect(result).toBe("value");
    } finally {
      await redis.delete(key);
    }
  });

  it("recupera vettori simili da PgVector", async () => {
    const pgvector = adapter.getPgVector();
    const tableName = `retrieve_pgvector_${Date.now()}`;

    await pgvector.createTable(tableName, 3);
    try {
      const vector = [0.1, 0.2, 0.3];
      const queryVector = [0.1, 0.21, 0.29];
      await pgvector.insertVector(tableName, vector, { label: "target" });

      const results = await pgVectorRetriever.retrieve({
        query: {
          tableName,
          queryVector,
          limit: 1,
        },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata).toBeTruthy();
    } finally {
      await pgvector.dropTable(tableName);
    }
  });

  it("recupera vettori da Qdrant", async () => {
    const qdrant = adapter.getQdrant();
    const collectionName = `retrieve_qdrant_${Date.now()}`;

    await qdrant.createCollection(collectionName, 3);
    try {
      await qdrant.upsert(
        collectionName,
        [
          {
            id: 1,
            vector: [0.9, 0.8, 0.7],
            payload: { label: "primary" },
          },
          {
            id: 2,
            vector: [0.1, 0.2, 0.3],
            payload: { label: "secondary" },
          },
        ],
        true
      );

      const results = await qdrantRetriever.retrieve({
        query: {
          collectionName,
          vector: [0.9, 0.79, 0.69],
          options: {
            limit: 1,
            withPayload: true,
          },
        },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].payload?.label).toBeDefined();
    } finally {
      await qdrant.deleteCollection(collectionName);
    }
  });
});
