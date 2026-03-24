import fp from "fastify-plugin";
import { Redis as IORedis, type Redis as RedisClient } from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redisSubscriber: RedisClient;
  }
}

export default fp(async function redisPlugin(fastify) {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redisHost = (() => {
    try {
      return new URL(redisUrl).hostname;
    } catch {
      return undefined;
    }
  })();
  const subscriber = new IORedis(redisUrl, {
    tls: redisUrl.startsWith("rediss://")
      ? {
          servername: redisHost,
        }
      : undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    connectTimeout: 10000,
  });

  subscriber.on("error", (err) => {
    fastify.log.error({ err }, "Redis connection error");
  });

  fastify.decorate("redisSubscriber", subscriber);

  fastify.addHook("onClose", async () => {
    await subscriber.quit();
  });
});
