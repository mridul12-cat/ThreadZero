// @vitest-environment node
import { it, expect } from "vitest";
import { createUntangleService } from "./untangle";
import { validateProposal } from "../src/magic/domain";
import { scenarioInputs, type ScenarioKey } from "../src/storage/scenarios";
import { calendarContext } from "../src/parser/context";
it.skipIf(
  process.env.THREADZERO_GROQ_LIVE !== "1" || !process.env.GROQ_API_KEY,
)(
  "optional live Groq reasoning scenarios (up to three spaced requests)",
  async () => {
    const handler = createUntangleService(process.env, {
      fetcher: async (input, init) => {
        const response = await fetch(input, init);
        if (!response.ok) {
          const allowed = new Set([
            "json_validate_failed",
            "json_generation_failed",
            "context_length_exceeded",
            "rate_limit_exceeded",
          ]);
          try {
            const payload = await response.clone().json();
            console.log(
              `Provider failure: status=${response.status}, code=${allowed.has(payload.error?.code) ? payload.error.code : "other (details suppressed)"}`,
            );
          } catch {
            console.log(`Provider failure: status=${response.status}`);
          }
        }
        if (response.ok) {
          try {
            const data = await response.clone().json();
            const choice = data.choices?.[0];
            let count = 0;
            try {
              count =
                JSON.parse(choice?.message?.content ?? "{}").tasks?.length ?? 0;
            } catch {
              /* Incomplete output is reported by finish reason only. */
            }
            console.log(
              `Provider diagnostic: finish=${choice?.finish_reason ?? "none"}, taskCount=${count}`,
            );
          } catch {
            /* Never print raw response bodies. */
          }
        }
        return response;
      },
    });
    const context = calendarContext();
    const requested = process.env.THREADZERO_GROQ_SCENARIO;
    const scenarios: ScenarioKey[] = requested
      ? ["cat", "independent", "science"].includes(requested)
        ? [requested as ScenarioKey]
        : (() => {
            throw new Error("Unknown smoke scenario");
          })()
      : ["cat", "independent", "science"];
    for (const [index, key] of scenarios.entries()) {
      if (index) await new Promise((resolve) => setTimeout(resolve, 65100));
      const response = await handler(
        new Request("http://localhost/api/untangle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: scenarioInputs[key],
            consent: true,
            ...context,
          }),
        }),
      );
      // Never print provider error payloads, request headers or credentials.
      expect(response.status, `${key} status`).toBe(200);
      const result = await response.json();
      const p = validateProposal(result.proposal, {
        source: scenarioInputs[key],
        ...context,
      });
      console.log(
        `Synthetic ${key} candidates: ${p.tasks.map((t) => t.title).join(" | ")}`,
      );
      if (key === "cat") {
        expect(p.goals.some((g) => /nobel/i.test(g.title))).toBe(true);
        expect(p.tasks.every((t) => t.estimatedMinutes === null)).toBe(true);
        const tuna = p.tasks.find(
          (t) => /buy|purchase/i.test(t.title) && /tuna/i.test(t.title),
        );
        const feed = p.tasks.find((t) => /feed|give.*tuna/i.test(t.title));
        expect(tuna).toBeDefined();
        expect(feed).toBeDefined();
        expect(
          p.dependencies.some(
            (e) =>
              e.predecessorId === tuna?.id &&
              e.successorId === feed?.id &&
              e.confidence === "explicit",
          ),
        ).toBe(true);
        expect(p.dependencies.length).toBe(1);
      }
      if (key === "independent") {
        expect(p.tasks).toHaveLength(4);
        expect(p.dependencies).toHaveLength(0);
        expect(p.goals).toHaveLength(0);
        expect(
          p.tasks.every(
            (t) => t.kind === "ACTION" && t.estimatedMinutes === null,
          ),
        ).toBe(true);
      }
      if (key === "science") {
        const remind = p.tasks.find((t) => /remind/i.test(t.title));
        expect(remind?.kind).toBe("ACTION");
        expect(
          p.tasks.some(
            (t) => t.kind === "WAITING_EVENT" && /diagram/i.test(t.title),
          ),
        ).toBe(true);
        expect(
          p.tasks.find((t) => /calculus/i.test(t.title))?.estimatedMinutes,
        ).toBe(45);
        expect(
          p.tasks
            .filter((t) => t.estimatedMinutes !== null)
            .every((t) => /calculus/i.test(t.title)),
        ).toBe(true);
        expect(
          p.dependencies.some(
            (e) =>
              e.predecessorId === remind?.id && e.confidence === "explicit",
          ),
        ).toBe(false);
      }
      console.log(
        `PASS: ${key} live scenario (${p.tasks.length} tasks, ${p.dependencies.length} proposals).`,
      );
    }
  },
  220000,
);
