import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import redisPlugin from "./plugins/redis.js";
import healthRoute from "./routes/health.js";
import wsRoute from "./routes/ws.js";

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
});
await server.register(helmet);
await server.register(websocket);
await server.register(redisPlugin);
await server.register(healthRoute, { prefix: "/api" });
await server.register(wsRoute);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

server.listen({ port, host }).catch((error) => {
  server.log.error(error);
  process.exit(1);
});
