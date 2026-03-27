import { FastifyPluginAsync } from "fastify";

type WsClient = any; // Fastify websocket connection type

const clientSubscriptions = new Map<WsClient, Set<string>>();
let isSubscribedToRedis = false;

const wsRoute: FastifyPluginAsync = async (fastify) => {
  const redis = fastify.redisSubscriber;

  const onRedisMessage = (_channel: string, payload: string) => {
    try {
      const data = JSON.parse(payload);
      const symbol = data.symbol;

      for (const [client, subs] of clientSubscriptions.entries()) {
        // If client subscribed to this symbol OR hasn't subscribed to anything yet (default to all)
        if (subs.has(symbol) || subs.size === 0) {
          client.send(payload);
        }
      }
    } catch (err) {
      fastify.log.error({ err }, "WS broadcast error");
    }
  };

  fastify.get(
    "/ws/stream",
    { websocket: true },
    (connection, req) => {
      const client = connection;
      clientSubscriptions.set(client, new Set<string>());

      if (!isSubscribedToRedis) {
        redis.subscribe("bullion_ticks");
        redis.on("message", onRedisMessage);
        isSubscribedToRedis = true;
      }

      connection.on("message", (message) => {
        try {
          const { action, symbol } = JSON.parse(message.toString());
          const subs = clientSubscriptions.get(client);
          
          if (!subs) return;

          if (action === "subscribe" && symbol) {
            subs.add(symbol);
            fastify.log.info(`Client subscribed to ${symbol}`);
          } else if (action === "unsubscribe" && symbol) {
            subs.delete(symbol);
            fastify.log.info(`Client unsubscribed from ${symbol}`);
          }
        } catch (err) {
          // Ignore invalid JSON or unknown actions
        }
      });

      connection.on("close", () => {
        clientSubscriptions.delete(client);
      });
    }
  );
};

export default wsRoute;
