type CachedResponse = {
  value: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CachedResponse>();
const pendingRequests = new Map<string, Promise<unknown>>();
const maxEntries = 200;
let generation = 0;

export function readCachedResponse<T>(key: string): T | undefined {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }

  // Refresh insertion order so frequently revisited pages survive eviction.
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value as T;
}

export function writeCachedResponse(
  key: string,
  value: unknown,
  ttlMs: number,
  requestGeneration: number,
) {
  if (ttlMs <= 0 || requestGeneration !== generation) return;
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });

  while (responseCache.size > maxEntries) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}

export function getPendingRequest<T>(key: string): Promise<T> | undefined {
  return pendingRequests.get(key) as Promise<T> | undefined;
}

export function setPendingRequest<T>(key: string, request: Promise<T>) {
  pendingRequests.set(key, request);
  const removePendingRequest = () => {
    if (pendingRequests.get(key) === request) pendingRequests.delete(key);
  };
  void request.then(removePendingRequest, removePendingRequest);
}

export function clearResponseCache() {
  generation += 1;
  responseCache.clear();
  pendingRequests.clear();
}

export function currentCacheGeneration() {
  return generation;
}
