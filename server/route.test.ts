// @vitest-environment node
import { it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { magicFixture } from "../src/tests/magic-fixture";
it("Vercel adapter reads server env, reserves shared budget and returns a sanitized proposal", async () => {
  vi.stubEnv("GROQ_API_KEY", "test-only-vercel-credential");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-only-redis-credential");
  const fetcher = vi.fn().mockImplementation(async (url: string) =>
    url.includes("upstash")
      ? Response.json({ result: 1 })
      : Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(magicFixture()) },
            },
          ],
        }),
  );
  vi.stubGlobal("fetch", fetcher);
  try {
    vi.resetModules();
    const { default: handler } = await import("../api/untangle");
    let status = 0,
      body = "";
    const response = {
      writeHead(code: number) {
        status = code;
      },
      end(value: string) {
        body = value;
      },
    } as unknown as ServerResponse;
    await handler(
      {
        method: "POST",
        headers: {
          host: "threadzero.example",
          origin: "https://threadzero.example",
          "content-type": "application/json",
        },
        body: {
          text: "Buy tuna before feeding the cat",
          consent: true,
          today: "2026-10-18",
          timeZone: "Asia/Kolkata",
        },
      } as unknown as IncomingMessage & { body: unknown },
      response,
    );
    expect(status).toBe(200);
    expect(JSON.parse(body).proposal.tasks.length).toBe(5);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(body).not.toContain("test-only-vercel-credential");
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});
