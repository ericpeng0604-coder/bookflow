export type MarketplaceCacheCursor = {
  sellerVerified: boolean;
  createdAt: string;
  id: string;
} | null;

export type MarketplaceCacheEntry<TBook> = {
  books: TBook[];
  count: number;
  hasMore: boolean;
  nextCursor: MarketplaceCacheCursor;
  updatedAt: number;
};

export const MAX_MARKETPLACE_CACHE_ENTRIES = 12;

export function readMarketplaceCache<TBook>(
  cache: Map<string, MarketplaceCacheEntry<TBook>>,
  key: string,
) {
  return cache.get(key) ?? null;
}

export function writeMarketplaceCache<TBook>(
  cache: Map<string, MarketplaceCacheEntry<TBook>>,
  key: string,
  entry: Omit<MarketplaceCacheEntry<TBook>, "updatedAt"> & { updatedAt?: number },
) {
  cache.set(key, { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
  while (cache.size > MAX_MARKETPLACE_CACHE_ENTRIES) {
    const oldestKey = [...cache.entries()]
      .sort(([, left], [, right]) => left.updatedAt - right.updatedAt)[0]?.[0];
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export function invalidateMarketplaceCache<TBook>(
  cache: Map<string, MarketplaceCacheEntry<TBook>>,
  key?: string,
) {
  if (key) {
    cache.delete(key);
    return;
  }
  cache.clear();
}
