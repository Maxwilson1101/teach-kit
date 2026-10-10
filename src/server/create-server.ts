import { serve } from "bun";
import index from "../web/index.html";

export interface ServerOptions {
  port?: number;
}

export function createServer({ port = 4321 }: ServerOptions = {}) {
  return serve({
    hostname: "127.0.0.1",
    port,
    routes: { "/": index },
    fetch() {
      return new Response("Not found", { status: 404 });
    },
    development: process.env.NODE_ENV !== "production" && {
      hmr: true,
      console: true,
    },
  });
}
