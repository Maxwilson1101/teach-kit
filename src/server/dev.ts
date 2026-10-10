import { createServer } from "./create-server";

const server = createServer({ port: Number(process.env.PORT ?? 4321) });
console.log(`Teach Kit scaffold running at ${server.url}`);
