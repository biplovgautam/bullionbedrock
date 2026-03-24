import { FastifyPluginAsync } from "fastify";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => ({ status: "ok", service: "backend" }));
};

export default healthRoute;
