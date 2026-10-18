// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createUntangleService, DEFAULT_MODEL } from "./untangle";
import { memoryLimiter, distributedLimiter } from "./rate-limit";
import { magicFixture } from "../src/tests/magic-fixture";
const KEY = "test-only-not-a-real-credential";
const req = (
  body: unknown = {
    text: "Buy tuna before feeding the cat.",
    consent: true,
    today: "2026-10-18",
    timeZone: "Asia/Kolkata",
  },
) =>
  new Request("https://threadzero.example/api/untangle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://threadzero.example",
    },
    body: JSON.stringify(body),
  });
const ok = () =>
  Response.json({
    choices: [
      {
        finish_reason: "stop",
        message: { content: JSON.stringify(magicFixture()) },
      },
    ],
  });
const allowed = async () => true;
describe("server-side Groq integration", () => {
  it("uses strict structured outputs, server credentials, bounded tokens and only the submitted text", async () => {
    const fetcher = vi.fn().mockImplementation(ok);
    const handle = createUntangleService(
      { GROQ_API_KEY: KEY },
      { fetcher, limiter: allowed },
    );
    const response = await handle(req());
    expect(response.status).toBe(200);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(options.headers.Authorization).toBe(`Bearer ${KEY}`);
    const request = JSON.parse(options.body);
    expect(request.model).toBe(DEFAULT_MODEL);
    expect(request.max_completion_tokens).toBe(3600);
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.messages[1].content).not.toContain("saved tasks");
    expect(await response.text()).not.toContain(KEY);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("has no-key fallback and never calls the provider", async () => {
    const fetcher = vi.fn();
    const response = await createUntangleService({}, { fetcher })(req());
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("local parser");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects unconsented, malformed, oversized and cross-origin requests", async () => {
    const fetcher = vi.fn();
    const handle = createUntangleService(
      { GROQ_API_KEY: KEY },
      { fetcher, limiter: allowed },
    );
    expect(
      (
        await handle(
          req({ text: "hello", consent: false, today: "2026-10-18" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handle(
          req({ text: "x".repeat(1501), consent: true, today: "2026-10-18" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handle(
          new Request(req(), {
            headers: {
              "Content-Type": "application/json",
              Origin: "https://attacker.example",
            },
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handle(new Request("https://threadzero.example/api/untangle")))
        .status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns safe provider 429 and 503 responses without retrying", async () => {
    for (const status of [429, 503]) {
      const fetcher = vi.fn().mockResolvedValue(new Response(KEY, { status }));
      const response = await createUntangleService(
        { GROQ_API_KEY: KEY },
        { fetcher, limiter: allowed },
      )(req());
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain(KEY);
      expect(fetcher).toHaveBeenCalledOnce();
    }
  });
  it("handles timeout and suppresses provider credential/error details", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new DOMException(KEY, "TimeoutError"));
    const response = await createUntangleService(
      { GROQ_API_KEY: KEY },
      { fetcher, limiter: allowed },
    )(req());
    expect(response.status).toBe(504);
    expect(await response.text()).not.toContain(KEY);
  });
  it("rejects malformed/truncated/schema-invalid and cyclic output", async () => {
    for (const content of [
      "not-json",
      JSON.stringify({ tasks: [] }),
      JSON.stringify({
        ...magicFixture(),
        dependencies: [
          ...magicFixture().dependencies,
          {
            predecessorId: "feed_cat",
            successorId: "buy_tuna",
            explanation: "loop",
            confidence: "inferred",
          },
        ],
      }),
    ]) {
      const fetcher = vi.fn().mockResolvedValue(
        Response.json({
          choices: [{ finish_reason: "stop", message: { content } }],
        }),
      );
      expect(
        (
          await createUntangleService(
            { GROQ_API_KEY: KEY },
            { fetcher, limiter: allowed },
          )(req())
        ).status,
      ).toBe(502);
    }
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: "length",
            message: { content: JSON.stringify(magicFixture()) },
          },
        ],
      }),
    );
    expect(
      (
        await createUntangleService(
          { GROQ_API_KEY: KEY },
          { fetcher, limiter: allowed },
        )(req())
      ).status,
    ).toBe(502);
  });
  it("limits requests on the server and fails closed on Vercel without distributed protection", async () => {
    const fetcher = vi.fn().mockImplementation(ok);
    const handle = createUntangleService({ GROQ_API_KEY: KEY }, { fetcher });
    expect((await handle(req())).status).toBe(200);
    expect((await handle(req())).status).toBe(429);
    expect(fetcher).toHaveBeenCalledOnce();
    const protectedRoute = createUntangleService(
      { GROQ_API_KEY: KEY },
      { fetcher, requireDistributed: true },
    );
    expect((await protectedRoute(req())).status).toBe(503);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("atomically uses Redis cooldown and daily budget and fails closed on limiter failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ result: 1 }));
    const limit = distributedLimiter(
      {
        UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: KEY,
      },
      fetcher,
    );
    expect(await limit()).toBe(true);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)[0]).toBe("EVAL");
    fetcher.mockResolvedValue(Response.json({ error: KEY }));
    await expect(limit()).rejects.toThrow("Shared rate limit is unavailable.");
  });
  it("caps local daily usage even when cooldowns pass", async () => {
    let now = Date.parse("2026-10-18T00:00:00Z");
    const limit = memoryLimiter(() => now);
    for (let i = 0; i < 20; i++) {
      expect(await limit()).toBe(true);
      now += 65001;
    }
    expect(await limit()).toBe(false);
  });
});
