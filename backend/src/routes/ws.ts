import { FastifyPluginAsync } from "fastify";
import { ratioUpdateSchema, RatioUpdate } from "../schemas/ratio.schema.js";

const wsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/ws",
    { websocket: true },
    (connection) => {
      const onMessage = (_channel: string, payload: string) => {
        try {
          const data = JSON.parse(payload) as RatioUpdate;
          const valid = fastify.validatorCompiler?.({ schema: ratioUpdateSchema } as any);
          if (valid) {
            connection.send(JSON.stringify(data));
          }
        } catch {
          // no-op malformed payload
        }
      };

      const redis = fastify.redisSubscriber;
      redis.subscribe("ratio_update");
      redis.on("message", onMessage);

      connection.on("close", () => {
        redis.off("message", onMessage);
      });
    }
  );
};

export default wsRoute;
