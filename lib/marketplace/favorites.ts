const FAVORITES_KEY = "bookflow-favorites-v1";
const FAVORITES_SYNCED_KEY = "bookflow-favorites-synced-v2";

export function readFavoriteIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeFavoriteIds(ids: Set<string>) {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

export function toggleFavoriteId(ids: Set<string>, bookId: string) {
  const next = new Set(ids);
  if (next.has(bookId)) next.delete(bookId);
  else next.add(bookId);
  writeFavoriteIds(next);
  return next;
}

export function clearLegacyFavorites() {
  window.localStorage.removeItem(FAVORITES_KEY);
  window.localStorage.setItem(FAVORITES_SYNCED_KEY, "1");
}

export function legacyFavoritesNeedSync() {
  return typeof window !== "undefined"
    && window.localStorage.getItem(FAVORITES_SYNCED_KEY) !== "1";
}
