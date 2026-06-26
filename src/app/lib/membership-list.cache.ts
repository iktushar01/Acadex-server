type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry<unknown>>();

export async function withMembershipListCache<T>(
  userId: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(userId) as CacheEntry<T> | undefined;

  if (hit && now < hit.expiresAt) {
    return hit.data;
  }

  const data = await fetcher();
  cache.set(userId, { data, expiresAt: now + TTL_MS });
  return data;
}

export function invalidateMembershipListCache(userId?: string) {
  if (userId) {
    cache.delete(userId);
    return;
  }

  cache.clear();
}
