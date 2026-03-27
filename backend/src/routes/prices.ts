import { FastifyPluginAsync } from "fastify";

const pricesRoute: FastifyPluginAsync = async (fastify) => {
  const redis = fastify.redisSubscriber; // Reusing the subscriber client for GETs is fine in ioredis

  // Dynamic asset endpoint
  fastify.get("/prices/asset/:symbol", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const decodedSymbol = decodeURIComponent(symbol).trim();
    
    const data = await redis.get(`price:${decodedSymbol}`);
    
    if (!data) {
      return reply.code(404).send({
        status: "error",
        message: `Price data not found for symbol: ${decodedSymbol}`,
      });
    }

    try {
      const parsedData = JSON.parse(data);
      return {
        status: "ok",
        data: parsedData,
      };
    } catch (err) {
      return reply.code(500).send({
        status: "error",
        message: "Failed to parse price data",
      });
    }
  });

  // Legacy/Shortcut endpoints
  fastify.get("/prices/btc", async (request, reply) => {
    return reply.redirect("/api/prices/asset/BTC%2FUSD");
  });

  fastify.get("/prices/gold", async (request, reply) => {
    return reply.redirect("/api/prices/asset/XAU%2FUSD");
  });
};

export default pricesRoute;
