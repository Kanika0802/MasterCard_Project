// blueteam/src/stream/DeduplicationCache.js
"use strict";

class DeduplicationCache {
    constructor({ maxSize = 10000, ttlMs = 3600000 } = {}) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.cache = new Map(); // key -> expireTimestamp
    }

    isDuplicate(key) {
        if (!key) return false;
        const now = Date.now();
        const expiry = this.cache.get(key);

        if (expiry) {
            if (expiry > now) {
                return true;
            }
            this.cache.delete(key);
        }
        return false;
    }

    add(key) {
        if (!key) return;
        const now = Date.now();
        this._evictExpired(now);

        if (this.cache.size >= this.maxSize) {
            // Evict oldest entry
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, now + this.ttlMs);
    }

    _evictExpired(now) {
        for (const [k, exp] of this.cache.entries()) {
            if (exp <= now) {
                this.cache.delete(k);
            } else {
                // Since Map maintains insertion order, oldest are first
                break;
            }
        }
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

module.exports = DeduplicationCache;
