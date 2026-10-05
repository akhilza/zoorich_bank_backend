"use strict";
/**
 * In-Memory Locking and Caching Engine
 * Provides atomic Mutex locks for balance mutation and sub-millisecond
 * Idempotency tracking without requiring an external Redis server.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireDistributedLock = acquireDistributedLock;
exports.releaseDistributedLock = releaseDistributedLock;
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDelete = cacheDelete;
const memoryLocks = new Map();
const memoryCache = new Map();
/**
 * Acquires an exclusive mutex lock for the given key with TTL.
 * Prevents concurrent double-spending race conditions.
 */
async function acquireDistributedLock(lockKey, ttlSeconds = 10) {
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
async function releaseDistributedLock(lockKey, token) {
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
async function cacheGet(key) {
    const entry = memoryCache.get(key);
    if (!entry)
        return null;
    if (entry.expiresAt < Date.now()) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
}
/**
 * Sets a key-value pair with TTL in seconds
 */
async function cacheSet(key, value, ttlSeconds) {
    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}
/**
 * Deletes a cached key
 */
async function cacheDelete(key) {
    return memoryCache.delete(key);
}
