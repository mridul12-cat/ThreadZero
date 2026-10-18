import { describe, it, expect } from "vitest";
import { magicFixture, magicSource } from "./magic-fixture";
import { validateProposal, appendProposal } from "../magic/domain";
import { emptyWorkspace, makeTask } from "../storage/types";
import { rank } from "../ranking/engine";
import { validateWorkspace } from "../storage/store";
describe("Magic graph domain", () => {
  it("separates goals and waits from executable tasks, remaps IDs, and leaves all connections unconfirmed", () => {
    const w = appendProposal(emptyWorkspace(), magicFixture(), magicSource);
    expect(w.tasks).toHaveLength(5);
    expect(w.goals[0].title).toContain("Nobel");
    expect(w.tasks.some((t) => t.title.includes("Nobel"))).toBe(false);
    expect(w.edges).toEqual([]);
    expect(w.suggestions.map((e) => e.confidence)).toEqual([
      "explicit",
      "inferred",
    ]);
    expect(w.suggestions[0].source).toBe(w.tasks[0].id);
    expect(w.tasks[0].id).not.toBe("buy_tuna");
    expect(rank(w.tasks, w.edges).some((t) => t.waiting)).toBe(false);
    expect(validateWorkspace(w)).toBeDefined();
  });
  it("rejects missing IDs, cycles, self links and duplicate edges", () => {
    for (const dependency of [
      { predecessorId: "missing", successorId: "feed_cat" },
      { predecessorId: "feed_cat", successorId: "buy_tuna" },
      { predecessorId: "buy_tuna", successorId: "buy_tuna" },
      { predecessorId: "buy_tuna", successorId: "feed_cat" },
    ]) {
      const p = magicFixture();
      p.dependencies.push({
        ...dependency,
        confidence: "inferred",
        evidenceCategory: "prerequisite",
        evidence: null,
        confirmationStatus: "unconfirmed",
        explanation: "Untrusted suggestion",
      });
      expect(() => validateProposal(p)).toThrow();
    }
  });
  it("rejects malformed data, duplicate task IDs, executable markup and impossible dates", () => {
    expect(() => validateProposal({ tasks: [] })).toThrow();
    const p = magicFixture();
    p.tasks.push(p.tasks[0]);
    expect(() => validateProposal(p)).toThrow();
    for (const bad of ["<script>alert(1)</script>", "```js alert(1)```"]) {
      const p = magicFixture();
      p.tasks[0].title = bad;
      expect(() => validateProposal(p)).toThrow();
    }
    const badDate = magicFixture();
    badDate.tasks[0].due = "2026-02-31";
    expect(() => validateProposal(badDate)).toThrow();
  });
  it("rejects missing goal links", () => {
    const p = magicFixture();
    p.goals[0].taskIds = ["missing"];
    expect(() => validateProposal(p)).toThrow(/missing/);
  });
  it("preserves existing work, renamed candidate edits and rejection decisions on retry", () => {
    let w = emptyWorkspace();
    const old = {
      ...makeTask("Private saved task"),
      status: "done" as const,
      notes: "Keep my notes",
    };
    w.tasks.push(old);
    w = appendProposal(w, magicFixture(), magicSource);
    w.tasks[1].title = "Buy salmon instead";
    w.dismissedSuggestions.push(w.suggestions[0]);
    w.suggestions = w.suggestions.slice(1);
    const next = appendProposal(w, magicFixture(), magicSource);
    expect(next.tasks).toHaveLength(6);
    expect(next.tasks[0]).toEqual(old);
    expect(next.tasks[1].title).toBe("Buy salmon instead");
    expect(next.suggestions).toHaveLength(1);
    expect(w.tasks).toHaveLength(6);
  });
  it("validates proposals against the existing confirmed graph without mutating it", () => {
    const w = appendProposal(emptyWorkspace(), magicFixture(), magicSource);
    w.edges = [{ source: w.tasks[1].id, target: w.tasks[0].id }];
    w.suggestions = [];
    const original = JSON.stringify(w);
    expect(() => appendProposal(w, magicFixture(), magicSource)).toThrow(
      /conflicts/,
    );
    expect(JSON.stringify(w)).toBe(original);
  });
  it("migrates older workspace exports without Magic fields", () => {
    const w = emptyWorkspace();
    const { goals, questions, aiSummary, dismissedSuggestions, ...old } = w;
    void goals;
    void questions;
    void aiSummary;
    void dismissedSuggestions;
    expect(validateWorkspace(old).goals).toEqual([]);
  });
});
