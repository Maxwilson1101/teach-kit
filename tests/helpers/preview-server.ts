import preview from "../fixtures/preview/index.html";

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 4323),
  routes: { "/": preview },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
  development: false,
});
console.log(`Renderer fixture running at ${server.url}`);
