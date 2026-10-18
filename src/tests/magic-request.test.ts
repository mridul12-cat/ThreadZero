// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { requestMagicProposal, MagicRequestError } from "../magic/request";
import { magicFixture } from "./magic-fixture";
const context = { today: "2026-10-18", timeZone: "Asia/Kolkata" };
const run = (fetcher: typeof fetch, signal = new AbortController().signal) =>
  requestMagicProposal(
    "Buy tuna before feeding the cat.",
    context,
    signal,
    fetcher,
  );
describe("Magic API error classification", () => {
  it("validates a successful proposal from the same-origin route", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ proposal: magicFixture() }));
    expect((await run(fetcher)).tasks).toHaveLength(5);
    expect(fetcher.mock.calls[0][0]).toBe("/api/untangle");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      text: "Buy tuna before feeding the cat.",
      consent: true,
      ...context,
    });
  });
  it.each([
    [404, "not found"],
    [405, "request method"],
    [500, "server could not"],
    [503, "not configured"],
    [401, "authentication"],
    [429, "quota"],
    [504, "timed out"],
  ])(
    "classifies HTTP %s even when Vercel returns text or HTML",
    async (status, word) => {
      const fetcher = vi.fn().mockResolvedValue(
        new Response("private upstream details", {
          status: Number(status),
          headers: { "Content-Type": "text/html", "Retry-After": "120" },
        }),
      );
      const error = await run(fetcher).catch((e) => e);
      expect(error).toBeInstanceOf(MagicRequestError);
      expect(error.message).toContain(word);
      expect(error.message).not.toContain("private upstream details");
      if (status === 429) expect(error.retryAfter).toBe(120);
    },
  );
  it("distinguishes network failures from invalid success bodies", async () => {
    await expect(
      run(vi.fn().mockRejectedValue(new TypeError("private network details"))),
    ).rejects.toThrow("network failure");
    for (const response of [
      new Response("<html>SPA</html>", {
        headers: { "Content-Type": "text/html" },
      }),
      Response.json({ proposal: { tasks: [] } }),
      new Response("{", { headers: { "Content-Type": "application/json" } }),
    ]) {
      await expect(run(vi.fn().mockResolvedValue(response))).rejects.toThrow(
        /page instead|invalid proposal/,
      );
    }
  });
  it("preserves cancellation for the caller to distinguish its timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = new DOMException("cancelled", "AbortError");
    await expect(
      run(vi.fn().mockRejectedValue(error), controller.signal),
    ).rejects.toBe(error);
  });
});
