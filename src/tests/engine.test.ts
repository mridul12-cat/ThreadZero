import { describe, it, expect } from "vitest";
import { makeTask, emptyWorkspace, type Edge } from "../storage/types";
import {
  available,
  validateEdge,
  descendants,
  blockers,
  topological,
  layout,
} from "../graph/engine";
import { rank } from "../ranking/engine";
import { simulate } from "../simulation/engine";
import { extract, parseDue } from "../parser/extract";
import { validateWorkspace } from "../storage/store";
const fixture = () => {
  const tasks = ["A", "B", "C", "D"].map((title) => ({
    ...makeTask(title),
    id: title,
    createdAt: "2026-10-18T00:00:00Z",
  }));
  const edges: Edge[] = [
    { source: "A", target: "B" },
    { source: "A", target: "C" },
    { source: "B", target: "D" },
    { source: "C", target: "D" },
  ];
  return { tasks, edges };
};
describe("directed dependency engine", () => {
  it("uses prerequisite → dependent direction", () => {
    const { tasks, edges } = fixture();
    expect(available(tasks[0], tasks, edges)).toBe(true);
    expect(available(tasks[1], tasks, edges)).toBe(false);
  });
  it("rejects cycles, self edges, duplicates and missing IDs", () => {
    const { tasks, edges } = fixture();
    expect(validateEdge({ source: "D", target: "A" }, tasks, edges)).toMatch(
      /circle/,
    );
    expect(validateEdge({ source: "A", target: "A" }, tasks, edges)).toMatch(
      /itself/,
    );
    expect(validateEdge(edges[0], tasks, edges)).toMatch(/already/);
    expect(validateEdge({ source: "X", target: "A" }, tasks, edges)).toMatch(
      /exist/,
    );
  });
  it("counts diamond descendants once", () => {
    expect([...descendants("A", fixture().edges)].sort()).toEqual([
      "B",
      "C",
      "D",
    ]);
  });
  it("gates on all prerequisites", () => {
    const { tasks, edges } = fixture();
    tasks[0].status = "done";
    tasks[1].status = "done";
    expect(available(tasks[3], tasks, edges)).toBe(false);
    expect(blockers(tasks[3], tasks, edges).map((t) => t.id)).toEqual(["C"]);
    tasks[2].status = "done";
    expect(available(tasks[3], tasks, edges)).toBe(true);
  });
  it("unlocks after completion; waiting is never actionable", () => {
    const { tasks, edges } = fixture();
    tasks[0].status = "done";
    expect(available(tasks[1], tasks, edges)).toBe(true);
    tasks[1].waiting = true;
    expect(available(tasks[1], tasks, edges)).toBe(false);
    expect(rank(tasks, edges).some((t) => t.id === "B")).toBe(false);
  });
  it("handles empty, disconnected, and cyclic graphs", () => {
    expect(rank([], [])).toEqual([]);
    expect(layout([], [])).toEqual([]);
    const { tasks, edges } = fixture();
    expect(topological(tasks, [])).toHaveLength(4);
    expect(() =>
      topological(tasks, [...edges, { source: "D", target: "A" }]),
    ).toThrow(/cycle/);
  });
  it("places dependent tasks after their predecessors", () => {
    const { tasks, edges } = fixture();
    const positions = layout(tasks, edges);
    for (const e of edges)
      expect(positions.find((n) => n.id === e.source)!.position.x).toBeLessThan(
        positions.find((n) => n.id === e.target)!.position.x,
      );
  });
});
describe("transparent ranking", () => {
  it("is deterministic including ties", () => {
    const { tasks } = fixture();
    expect(rank(tasks, []).map((t) => t.id)).toEqual(["A", "B", "C", "D"]);
  });
  it("allows an urgent small task to outrank a connected task", () => {
    const { tasks, edges } = fixture();
    const urgent = {
      ...makeTask("Email"),
      id: "E",
      estimatedMinutes: 5,
      due: "2026-10-18",
    };
    expect(
      rank([...tasks, urgent], edges, new Date("2026-10-18T12:00:00Z"))[0].id,
    ).toBe("E");
  });
  it("prefers lower effort when other factors are equal", () => {
    const { tasks } = fixture();
    tasks[2].estimatedMinutes = 5;
    expect(rank(tasks, [])[0].id).toBe("C");
  });
});
describe("parser", () => {
  it("extracts obligations, informal action lines, and conjunctions", () => {
    const r = extract(
      "I need to email my teacher and study for my exam.\nBuy milk",
    );
    expect(r.tasks.map((t) => t.title)).toEqual([
      "Email my teacher",
      "Study for my exam",
      "Buy milk",
    ]);
  });
  it("preserves ambiguous text as notes", () => {
    const r = extract("Everything feels tangled. Maybe a holiday?");
    expect(r.tasks).toHaveLength(0);
    expect(r.notes).toEqual(["Everything feels tangled", "Maybe a holiday"]);
  });
  it("suggests explicit connections without confirming them", () => {
    const r = extract("I can't build slides until I receive research");
    expect(r.tasks).toHaveLength(2);
    const e = r.suggestions[0];
    expect(r.tasks.find((t) => t.id === e.source)?.title).toBe(
      "Receive research",
    );
    expect(r.tasks.find((t) => t.id === e.target)?.title).toBe("Build slides");
  });
  it("handles before and after direction", () => {
    const before = extract("Before I build slides, choose a topic");
    expect(
      before.tasks.find((t) => t.id === before.suggestions[0].source)?.title,
    ).toBe("Choose a topic");
    const after = extract("After I choose a topic, build slides");
    expect(
      after.tasks.find((t) => t.id === after.suggestions[0].source)?.title,
    ).toBe("Choose a topic");
  });
  it("deduplicates candidates and preserves source", () => {
    const r = extract("I need to buy milk. Buy milk");
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0].source).toBe("I need to buy milk");
  });
  it("supports today, tomorrow and weekday dates", () => {
    const now = new Date(2026, 9, 18, 12);
    expect(parseDue("due tomorrow", now)).toBe("2026-10-19");
    expect(parseDue("by Friday", now)).toBe("2026-10-23");
    expect(parseDue("due today", now)).toBe("2026-10-18");
  });
  it("survives incorrect and empty input", () => {
    for (const input of [null, undefined, 42, {}, "", "..."])
      expect(extract(input).tasks).toHaveLength(0);
  });
  it("keeps a wait separate from an actionable request", () => {
    const r = extract("Request research from Alex. Waiting for Alex");
    expect(r.tasks.map((t) => t.kind)).toEqual(["ACTION", "WAITING_EVENT"]);
  });
});
describe("non-destructive scenarios", () => {
  it("previews real unlocks without changing original objects", () => {
    const { tasks, edges } = fixture();
    const original = JSON.stringify(tasks);
    const p = simulate(tasks, edges, "A", "finish");
    expect(p.newlyAvailable.map((t) => t.id)).toEqual(["B", "C"]);
    expect(JSON.stringify(tasks)).toBe(original);
    expect(p.tasks[0]).not.toBe(tasks[0]);
    expect(rank(tasks, edges)[0].id).toBe("A");
  });
  it("does not unlock a task with another unfinished prerequisite", () => {
    const { tasks, edges } = fixture();
    expect(
      simulate(tasks, edges, "B", "finish").newlyAvailable.map((t) => t.id),
    ).not.toContain("D");
  });
  it("delay affects unique downstream work and never mutates waiting", () => {
    const { tasks, edges } = fixture();
    tasks[3].due = "2026-10-20";
    const p = simulate(tasks, edges, "A", "delay", new Date("2026-10-18"));
    expect(p.affected).toHaveLength(3);
    expect(p.atRisk.map((t) => t.id)).toEqual(["D"]);
    expect(tasks[0].waiting).toBe(false);
  });
});
describe("import validation", () => {
  it("accepts a valid workspace", () => {
    const w = { ...emptyWorkspace(), ...fixture() };
    expect(validateWorkspace(w).tasks).toHaveLength(4);
  });
  it("rejects malformed imports, duplicate IDs, cycles, and missing endpoints", () => {
    expect(() => validateWorkspace({ version: 2 })).toThrow();
    const { tasks, edges } = fixture();
    expect(() =>
      validateWorkspace({
        ...emptyWorkspace(),
        tasks: [...tasks, tasks[0]],
        edges,
      }),
    ).toThrow(/Duplicate/);
    expect(() =>
      validateWorkspace({
        ...emptyWorkspace(),
        tasks,
        edges: [...edges, { source: "D", target: "A" }],
      }),
    ).toThrow(/circle/);
    expect(() =>
      validateWorkspace({
        ...emptyWorkspace(),
        tasks,
        edges: [{ source: "missing", target: "A" }],
      }),
    ).toThrow(/exist/);
  });
});

describe("informal parser phrasing", () => {
  it("recognizes waiting, omitted I, and leading deadline", () => {
    const r = extract(
      "I'm waiting for Alex. Need to buy milk. By Friday, finish slides",
      new Date(2026, 9, 18, 12),
    );
    expect(r.tasks.map((t) => t.title)).toEqual([
      "Waiting for Alex",
      "Buy milk",
      "Finish slides",
    ]);
    expect(r.tasks[0].kind).toBe("WAITING_EVENT");
    expect(r.tasks[2].due).toBe("2026-10-23");
  });
});
