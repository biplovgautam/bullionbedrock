import { FastifyPluginAsync } from "fastify";

type WsClient = { send: (data: string) => void; on: (event: string, cb: () => void) => void };

const clients = new Set<WsClient>();
let subscribed = false;

const wsRoute: FastifyPluginAsync = async (fastify) => {
  const redis = fastify.redisSubscriber;

  const onMessage = (_channel: string, payload: string) => {
    for (const client of clients) {
      client.send(payload);
    }
  };

  fastify.get(
    "/ws/stream",
    { websocket: true },
    (connection) => {
      clients.add(connection as WsClient);

      if (!subscribed) {
        redis.subscribe("bullion_ticks");
        redis.on("message", onMessage);
        subscribed = true;
      }

      connection.on("close", () => {
        clients.delete(connection as WsClient);
      });
    }
  );
};

export default wsRoute;
