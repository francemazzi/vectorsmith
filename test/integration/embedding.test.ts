import { describe, it, expect } from "vitest";
import {
  JinaAIEmbeddingProvider,
  JinaEmbeddingModel,
  OpenAIEmbeddingProvider,
  OpenAIEmbeddingModel,
} from "@/embedding";

describe("Embedding Providers (integration)", () => {
  describe("JinaAIEmbeddingProvider", () => {
    const apiKey = process.env.JINA_API_KEY;
    const runWithKey = apiKey ? it : it.skip;

    runWithKey(
      "generates embeddings for simple texts",
      async () => {
        const provider = new JinaAIEmbeddingProvider(
          apiKey!,
          JinaEmbeddingModel.CodeEmbeddings_0_5B,
          {
            expectedDimensions: 896,
            timeoutMs: 30000,
          }
        );

        const inputs = ["hello world", "ciao mondo", "simple test"];
        const vectors = await provider.embed(inputs);

        expect(Array.isArray(vectors)).toBe(true);
        expect(vectors.length).toBe(inputs.length);
        for (const vec of vectors) {
          expect(Array.isArray(vec)).toBe(true);
          expect(vec.length).toBe(896);
          expect(
            vec.every((value) => typeof value === "number" && Number.isFinite(value))
          ).toBe(true);
        }
      },
      60_000
    );

    it(
      "fails with invalid API key",
      async () => {
        const badProvider = new JinaAIEmbeddingProvider(
          "invalid_api_key",
          JinaEmbeddingModel.CodeEmbeddings_0_5B,
          { timeoutMs: 15_000 }
        );
        await expect(badProvider.embedOne("test")).rejects.toThrow();
      },
      30_000
    );
  });

  describe("OpenAIEmbeddingProvider", () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const runWithKey = apiKey ? it : it.skip;

    runWithKey(
      "generates embeddings for simple texts",
      async () => {
        const provider = new OpenAIEmbeddingProvider(
          apiKey!,
          OpenAIEmbeddingModel.TextEmbedding3Small,
          {
            expectedDimensions: 1_536,
            timeoutMs: 30_000,
          }
        );

        const inputs = ["hello world", "ciao mondo", "simple test"];
        const vectors = await provider.embed(inputs);

        expect(Array.isArray(vectors)).toBe(true);
        expect(vectors.length).toBe(inputs.length);
        for (const vec of vectors) {
          expect(Array.isArray(vec)).toBe(true);
          expect(vec.length).toBe(1_536);
          expect(
            vec.every((value) => typeof value === "number" && Number.isFinite(value))
          ).toBe(true);
        }
      },
      60_000
    );

    it(
      "fails with invalid API key",
      async () => {
        const badProvider = new OpenAIEmbeddingProvider(
          "invalid_api_key",
          OpenAIEmbeddingModel.TextEmbedding3Small,
          { timeoutMs: 15_000 }
        );
        await expect(badProvider.embedOne("test")).rejects.toThrow();
      },
      30_000
    );
  });
});


