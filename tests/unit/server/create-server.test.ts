import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "../../../src/server/create-server";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

describe("preview server scaffold", () => {
  test("serves the application shell on an available port", async () => {
    const server = createServer({ port: 0 });
    servers.push(server);

    const response = await fetch(server.url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("<title>Teach Kit</title>");
  });

  test("returns not found for unknown routes", async () => {
    const server = createServer({ port: 0 });
    servers.push(server);

    const response = await fetch(new URL("/missing", server.url));
    expect(response.status).toBe(404);
  });
});
