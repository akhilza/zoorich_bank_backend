/**
 * In-Memory Locking and Caching Engine
 * Provides atomic Mutex locks for balance mutation and sub-millisecond
 * Idempotency tracking without requiring an external Redis server.
 */

interface LockEntry {
  token: string;
  expiresAt: number;
}

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const memoryLocks = new Map<string, LockEntry>();
const memoryCache = new Map<string, CacheEntry>();

/**
 * Acquires an exclusive mutex lock for the given key with TTL.
 * Prevents concurrent double-spending race conditions.
 */
export async function acquireDistributedLock(
  lockKey: string,
  ttlSeconds: number = 10
): Promise<string | null> {
  const now = Date.now();
  const existing = memoryLocks.get(lockKey);

  if (existing && existing.expiresAt > now) {
    return null; // Lock already held
  }

  const token = Math.random().toString(36).substring(2) + now.toString(36);
  memoryLocks.set(lockKey, { token, expiresAt: now + ttlSeconds * 1000 });
  return token;
}

/**
 * Safely releases the lock only if the token matches.
 */
export async function releaseDistributedLock(
  lockKey: string,
  token: string
): Promise<boolean> {
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.token === token) {
    memoryLocks.delete(lockKey);
    return true;
  }
  return false;
}

/**
 * Retrieves a cached value (used for idempotency checks)
 */
export async function cacheGet(key: string): Promise<string | null> {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Sets a key-value pair with TTL in seconds
 */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Deletes a cached key
 */
export async function cacheDelete(key: string): Promise<boolean> {
  return memoryCache.delete(key);
}

