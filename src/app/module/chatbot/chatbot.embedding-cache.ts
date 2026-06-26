import { createHash } from "node:crypto";

const cache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 500;

const cacheKey = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

export const getCachedEmbedding = (text: string): number[] | undefined =>
  cache.get(cacheKey(text));

export const setCachedEmbedding = (text: string, embedding: number[]): void => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(cacheKey(text), embedding);
};
