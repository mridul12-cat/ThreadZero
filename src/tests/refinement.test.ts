import { describe, it, expect } from "vitest";
import { makeTask, taskSchema, emptyWorkspace } from "../storage/types";
import { available, blockers, pathMembers, isComplete } from "../graph/engine";
import { rank, score } from "../ranking/engine";
import { simulate } from "../simulation/engine";
import {
  parseMinutes,
  calendarContext,
  resolveDate,
  parseDeadline,
} from "../parser/context";
import { extract } from "../parser/extract";
import { scenarioProposal, scenarioInputs } from "../storage/scenarios";
import { appendProposal, validateProposal } from "../magic/domain";
import { constellationLayout, CARD_WIDTH, CARD_HEIGHT } from "../graph/layout";
const context = { today: "2026-10-18", timeZone: "Asia/Kolkata" };
function science() {
  return appendProposal(
    emptyWorkspace(),
    scenarioProposal("science", context),
    scenarioInputs.science,
    context,
  );
}
describe("external events and reminder correctness", () => {
  it("keeps reminders actionable while receipt needs independent confirmation", () => {
    const w = science();
    const reminder = w.tasks.find((t) => /Remind/.test(t.title))!;
    reminder.scheduledStart = undefined;
    const diagram = w.tasks.find(
      (t) => t.title === "Receive the circuit diagram",
    )!;
    const sensor = w.tasks.find(
      (t) => t.title === "Receive the sensor delivery",
    )!;
    const build = w.tasks.find((t) => t.title === "Build the prototype")!;
    const edges = [
      { source: diagram.id, target: build.id },
      { source: sensor.id, target: build.id },
    ];
    expect(reminder.kind).toBe("ACTION");
    expect(available(reminder, w.tasks, edges)).toBe(true);
    expect(available(diagram, w.tasks, edges)).toBe(false);
    const preview = simulate(w.tasks, edges, reminder.id, "finish");
    expect(
      preview.tasks.find((t) => t.id === diagram.id)?.eventResolvedAt,
    ).toBeNull();
    expect(available(build, preview.tasks, edges)).toBe(false);
    expect(w.tasks.find((t) => t.id === reminder.id)?.status).toBe("todo");
    diagram.status = "done";
    expect(isComplete(diagram)).toBe(false);
    diagram.eventResolvedAt = "2026-10-18T12:00:00Z";
    expect(blockers(build, w.tasks, edges).map((t) => t.id)).toEqual([
      sensor.id,
    ]);
    sensor.status = "done";
    sensor.eventResolvedAt = "2026-10-18T12:00:00Z";
    expect(available(build, w.tasks, edges)).toBe(true);
  });
  it("repairs misclassified reminders and legacy waiting reminders", () => {
    const p = scenarioProposal("science", context);
    p.tasks[0].kind = "WAITING_EVENT";
    expect(
      validateProposal(p, { source: scenarioInputs.science, ...context })
        .tasks[0].kind,
    ).toBe("ACTION");
    const old = { ...makeTask("Remind Alex"), kind: "waiting", waiting: true };
    const migrated = taskSchema.parse(old);
    expect(migrated.kind).toBe("ACTION");
  });
  it("never recommends unresolved events, unavailable actions, completed or future-scheduled tasks", () => {
    const w = science();
    w.tasks[2].waiting = true;
    w.tasks[7].status = "done";
    const ranked = rank(w.tasks, [], new Date("2026-10-18T12:00:00Z"));
    expect(
      ranked.every(
        (t) =>
          t.kind === "ACTION" &&
          !t.waiting &&
          t.status !== "done" &&
          t.scheduledStart !== "2026-10-19",
      ),
    ).toBe(true);
  });
});
describe("honest estimates and calendar context", () => {
  it("keeps unknown effort null and preserves stated durations without confusing quantities", () => {
    const r = extract(
      "I need to study calculus. Study for about 45 minutes. Practice 20 questions.",
    );
    expect(r.tasks.map((t) => t.estimatedMinutes)).toEqual([null, 45, null]);
    expect(parseMinutes("Practice 20 questions")).toBeNull();
    expect(parseMinutes("Study for 1.5 hours")).toBe(90);
  });
  it("removes guessed model durations while retaining source-backed estimates", () => {
    const p = scenarioProposal("science", context);
    p.tasks[6].estimatedMinutes = 3;
    p.tasks[6].estimateEvidence = null;
    const parsed = validateProposal(p, {
      source: scenarioInputs.science,
      ...context,
    });
    expect(parsed.tasks[6].estimatedMinutes).toBeNull();
    expect(parsed.tasks[9].estimatedMinutes).toBe(45);
    const old = taskSchema.parse({
      ...makeTask("Build prototype"),
      estimatedMinutes: undefined,
      effort: 3,
    });
    expect(old.estimatedMinutes).toBeNull();
  });
  it("uses a neutral missing-effort score and stable ranking; respects optional available time", () => {
    const a = { ...makeTask("A"), id: "a", createdAt: "2026-10-18T00:00:00Z" };
    const b = { ...makeTask("B"), id: "b", createdAt: a.createdAt };
    expect(score(a, [a, b], [], new Date())).toBe(15.5);
    expect(rank([b, a], []).map((t) => t.id)).toEqual(["a", "b"]);
    b.estimatedMinutes = 45;
    expect(rank([a, b], [], new Date(), 10).map((t) => t.id)).toEqual(["a"]);
  });
  it("resolves dates across timezone boundaries and weekday rollovers, separating planned starts", () => {
    const instant = new Date("2026-10-18T00:30:00Z");
    expect(calendarContext(instant, "America/Los_Angeles").today).toBe(
      "2026-10-17",
    );
    expect(calendarContext(instant, "Asia/Kolkata").today).toBe("2026-10-18");
    expect(resolveDate("by Friday", { ...context, today: "2026-10-23" })).toBe(
      "2026-10-23",
    );
    expect(
      resolveDate("next Thursday", { ...context, today: "2026-10-22" }),
    ).toBe("2026-10-29");
    expect(resolveDate("by Friday", { ...context, today: "2026-10-24" })).toBe(
      "2026-10-30",
    );
    expect(parseDeadline("Remind Alex tomorrow", context)).toBeNull();
    expect(parseDeadline("Before the exam", context)).toBeNull();
    expect(resolveDate("tomorrow", { ...context, today: "2026-12-31" })).toBe(
      "2027-01-01",
    );
  });
});
describe("required demonstration scenarios and evidence", () => {
  it("science has separate branches, null estimates and no reminder-to-receipt assumption", () => {
    const w = science();
    expect(w.tasks).toHaveLength(12);
    expect(
      w.tasks
        .filter((t) => t.estimatedMinutes !== null)
        .map((t) => t.estimatedMinutes),
    ).toEqual([45]);
    expect(
      w.suggestions.some((e) =>
        /Remind/.test(w.tasks.find((t) => t.id === e.source)!.title),
      ),
    ).toBe(false);
    for (const title of [
      "Revise calculus",
      "Practice 20 questions",
      "Reply to my cousin",
    ]) {
      const task = w.tasks.find((t) => t.title === title)!;
      expect(
        w.suggestions.some((e) => e.source === task.id || e.target === task.id),
      ).toBe(false);
    }
  });
  it("cat Nobel goal is separate and research/professor email stay independent", () => {
    const w = appendProposal(
      emptyWorkspace(),
      scenarioProposal("cat", context),
      scenarioInputs.cat,
      context,
    );
    expect(w.goals).toHaveLength(1);
    expect(w.tasks).toHaveLength(4);
    expect(w.tasks.every((t) => t.estimatedMinutes === null)).toBe(true);
    expect(w.suggestions).toHaveLength(1);
    expect(w.suggestions[0].confidence).toBe("explicit");
    expect(w.edges).toHaveLength(0);
  });
  it("unrelated chores have four available options and no goals or edges", () => {
    const w = appendProposal(
      emptyWorkspace(),
      scenarioProposal("independent", context),
      scenarioInputs.independent,
      context,
    );
    expect(w.tasks).toHaveLength(4);
    expect(rank(w.tasks, w.edges)).toHaveLength(4);
    expect(w.goals).toEqual([]);
    expect(w.suggestions).toEqual([]);
    expect(extract(scenarioInputs.independent).tasks).toHaveLength(4);
  });
  it("downgrades fabricated evidence, drops temporal links and rejects vague unsupported goals", () => {
    const p = scenarioProposal("cat", context);
    p.dependencies[0].evidence = "A fabricated quote before research";
    expect(
      validateProposal(p, { source: scenarioInputs.cat, ...context })
        .dependencies[0].confidence,
    ).toBe("inferred");
    p.dependencies[0].evidenceCategory = "temporal";
    expect(
      validateProposal(p, { source: scenarioInputs.cat, ...context })
        .dependencies,
    ).toEqual([]);
    p.goals[0].title = "Maintain personal responsibilities";
    p.goals[0].evidence = scenarioInputs.cat;
    expect(
      validateProposal(p, { source: scenarioInputs.cat, ...context }).goals,
    ).toEqual([]);
  });
});
describe("constellation layout and path highlighting", () => {
  it("lays out disconnected components without overlap and keeps directed prerequisites to the left", () => {
    const w = science();
    const result = constellationLayout(w.tasks, [], w.suggestions);
    expect(result.nodes).toHaveLength(12);
    expect(result.clusters.length).toBeGreaterThan(1);
    for (let i = 0; i < result.nodes.length; i++)
      for (let j = i + 1; j < result.nodes.length; j++) {
        const a = result.nodes[i].position,
          b = result.nodes[j].position;
        expect(
          Math.abs(a.x - b.x) >= CARD_WIDTH ||
            Math.abs(a.y - b.y) >= CARD_HEIGHT,
        ).toBe(true);
      }
    for (const e of w.suggestions) {
      const a = result.nodes.find((n) => n.id === e.source)!,
        b = result.nodes.find((n) => n.id === e.target)!;
      expect(a.position.x).toBeLessThan(b.position.x);
    }
  });
  it("highlights transitive prerequisites and downstream nodes without unrelated siblings", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "a", target: "d" },
    ];
    expect([...pathMembers("b", edges)].sort()).toEqual(["a", "b", "c"]);
  });
  it("supports 100 independent tasks and remains deterministic", () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      ...makeTask(`Task ${i}`),
      id: `t${i}`,
    }));
    const result = constellationLayout(tasks, []);
    expect(result.nodes).toHaveLength(100);
    expect(constellationLayout(tasks, [])).toEqual(result);
  });
});

describe("source-grounded recovery and deadlines", () => {
  it("recovers a clearly stated goal from an actual source sentence rather than inventing an evidence quote", () => {
    const p = scenarioProposal("cat", context);
    p.goals[0].evidence = "A paraphrased cat Nobel ambition";
    const normalized = validateProposal(p, {
      source: scenarioInputs.cat,
      ...context,
    });
    expect(normalized.goals[0].evidence).toBe(
      "I want my cat to win a Nobel Prize",
    );
  });
  it("does not label an unrelated real source quote as explicit evidence", () => {
    const p = scenarioProposal("science", context);
    p.dependencies[0].evidence =
      "I must build the prototype before running experiments";
    const normalized = validateProposal(p, {
      source: scenarioInputs.science,
      ...context,
    });
    expect(normalized.dependencies[0].confidence).toBe("inferred");
  });
  it("asks about an undated exam instead of inventing an absolute deadline", () => {
    const p = scenarioProposal("independent", context);
    p.tasks[1].due = "2026-10-23";
    p.tasks[1].deadlineEvidence = "before the exam";
    const normalized = validateProposal(p, {
      source: scenarioInputs.independent + " Finish homework before the exam.",
      ...context,
    });
    expect(normalized.tasks[1].due).toBeNull();
    expect(
      normalized.questions.some((q) => q.includes("date of the event")),
    ).toBe(true);
  });
});

it("recovers an explicitly stated duration when the model omits or paraphrases its estimate evidence", () => {
  const p = scenarioProposal("science", context);
  p.tasks[9].estimatedMinutes = null;
  p.tasks[9].estimateEvidence = "study calculus for 45 minutes";
  const normalized = validateProposal(p, {
    source: scenarioInputs.science,
    ...context,
  });
  expect(normalized.tasks[9].estimatedMinutes).toBe(45);
  expect(scenarioInputs.science).toContain(
    normalized.tasks[9].estimateEvidence,
  );
});

it("keeps dates and durations scoped to the relevant local-parser clause", () => {
  const result = extract(
    "I need to revise calculus for 45 minutes and email Alex tomorrow. Buy groceries by Friday.",
    new Date(2026, 9, 18, 12),
  );
  expect(result.tasks).toHaveLength(3);
  expect(result.tasks[0].estimatedMinutes).toBe(45);
  expect(result.tasks[1].estimatedMinutes).toBeNull();
  expect(result.tasks[0].scheduledStart).toBeUndefined();
  expect(result.tasks[1].scheduledStart).toBe("2026-10-19");
  expect(result.tasks[1].due).toBeUndefined();
  expect(result.tasks[2].due).toBe("2026-10-23");
});
