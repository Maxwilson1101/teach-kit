import { createServer } from "./create-server";

const server = await createServer({
  port: Number(process.env.PORT ?? 4321),
  entry: process.argv[2] ?? "example/index.ts",
});
console.log(`Teach Kit running at ${server.url}`);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.stop(true);
    process.exit(0);
  });
}
