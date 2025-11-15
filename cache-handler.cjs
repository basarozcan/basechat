const { createClient } = require("redis");

const DEFAULT_TTL = 84600; // 24 hours
const CACHE_KEY_PREFIX = "basechat:";
const TAG_INDEX_PREFIX = "basechat:tags:";

function buildTenantUserTag(userId, slug) {
  return `tenant:${slug}:user:${userId}`;
}

function buildTenantTag(slug) {
  return `tenant:${slug}`;
}

function buildTags(userId, slug) {
  return [buildTenantUserTag(userId, slug), buildTenantTag(slug)];
}

class CacheHandler {
  constructor() {
    this.redisClient = null;
    this.isConnected = false;
    this.connectionPromise = null;

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.warn("REDIS_URL environment variable not set. Cache will be disabled.");
      return;
    }

    try {
      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              console.warn("Redis reconnection attempts exceeded, disabling cache");
              return false;
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.redisClient.on("error", (err) => {
        console.error("Redis client error:", err);
        this.isConnected = false;
      });

      this.redisClient.on("connect", () => {
        this.isConnected = true;
      });

      this.redisClient.on("disconnect", () => {
        console.log("Redis client disconnected");
        this.isConnected = false;
      });
    } catch (error) {
      console.error("Failed to create Redis client:", error);
      this.redisClient = null;
    }
  }

  async ensureConnected() {
    if (!this.redisClient) return false;
    if (this.isConnected) return true;

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        await this.redisClient.connect();
        this.isConnected = true;
        return true;
      } catch (error) {
        console.error("Failed to connect to Redis:", error);
        this.isConnected = false;
        return false;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  getTagIndexKey(tag) {
    return `${TAG_INDEX_PREFIX}${tag}`;
  }

  async get(key) {
    const prefixedKey = `${CACHE_KEY_PREFIX}${key}`;
    try {
      const connected = await this.ensureConnected();
      if (!connected) {
        console.warn("Redis unavailable in get()");
        return undefined;
      }

      const data = await this.redisClient.get(prefixedKey);
      if (!data) return undefined;

      return JSON.parse(data);
    } catch (error) {
      console.warn("Error getting cache key:", error);
      return undefined;
    }
  }

  async set(key, data, ctx) {
    const prefixedKey = `${CACHE_KEY_PREFIX}${key}`;

    const fixedCtx = {
      ...ctx,
      tags: Array.isArray(ctx.tags) ? ctx.tags : [ctx.tags],
    };

    const fixedData = {
      ...data,
      revalidate: typeof data.revalidate === "number" ? data.revalidate : DEFAULT_TTL,
    };

    try {
      const connected = await this.ensureConnected();
      if (!connected) {
        console.warn("Redis unavailable in set()");
        return;
      }

      const cacheEntry = {
        value: fixedData,
        lastModified: Date.now(),
        tags: fixedCtx.tags,
      };

      const serialized = JSON.stringify(cacheEntry);

      await this.redisClient.set(prefixedKey, serialized, {
        expiration: { type: "EX", value: fixedData.revalidate },
      });

      const multi = this.redisClient.multi();

      for (const tag of fixedCtx.tags) {
        const tagIndexKey = this.getTagIndexKey(tag);
        multi.sAdd(tagIndexKey, prefixedKey);
        multi.expire(tagIndexKey, fixedData.revalidate);
      }

      await multi.exec();
    } catch (error) {
      console.warn("Error setting cache key:", error);
    }
  }

  async revalidateTag(tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];

    try {
      const connected = await this.ensureConnected();
      if (!connected) {
        console.warn("Redis unavailable in revalidateTag()");
        return;
      }

      for (const tag of tagArray) {
        const tagIndexKey = this.getTagIndexKey(tag);
        const cacheKeys = await this.redisClient.sMembers(tagIndexKey);

        if (!cacheKeys.length) continue;

        const multi = this.redisClient.multi();

        for (const cacheKey of cacheKeys) {
          multi.del(cacheKey);
        }

        multi.del(tagIndexKey);

        await multi.exec();
      }
    } catch (error) {
      console.warn("Error revalidating tags:", error);
    }
  }

  resetRequestCache() {
    // No-op
  }

  async disconnect() {
    if (this.redisClient && this.isConnected) {
      try {
        await this.redisClient.quit();
        this.isConnected = false;
      } catch (error) {
        console.warn("Error disconnecting from Redis:", error);
      }
    }
  }
}

module.exports = {
  default: CacheHandler,
  buildTenantUserTag,
  buildTenantTag,
  buildTags,
};
