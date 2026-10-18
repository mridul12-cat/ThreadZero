import { normalizeProposal, type ProposalContext } from "./normalize";
import { calendarContext, type CalendarContext } from "../parser/context";
import { proposalSchema, type Proposal } from "./contract";
import { makeTask, type Workspace, type Edge, uid } from "../storage/types";
import { validateEdge } from "../graph/engine";
export function validateProposal(
  value: unknown,
  context?: ProposalContext,
): Proposal {
  const p = proposalSchema.parse(value);
  const ids = new Set(p.tasks.map((t) => t.id));
  if (ids.size !== p.tasks.length)
    throw new Error("The proposal contains duplicate task IDs.");
  if (new Set(p.goals.map((g) => g.id)).size !== p.goals.length)
    throw new Error("The proposal contains duplicate goal IDs.");
  const tasks = p.tasks.map((t) => ({ ...makeTask(t.title), id: t.id }));
  const edges: Edge[] = [];
  for (const d of p.dependencies) {
    const e = { source: d.predecessorId, target: d.successorId };
    const issue = validateEdge(e, tasks, edges);
    if (issue) throw new Error(`Invalid proposed connection: ${issue}`);
    edges.push(e);
  }
  for (const g of p.goals)
    if (g.taskIds.some((id) => !ids.has(id)))
      throw new Error("A goal refers to a missing task.");
  return normalizeProposal(p, context);
}
export function appendProposal(
  w: Workspace,
  value: unknown,
  source: string,
  context: CalendarContext = calendarContext(),
): Workspace {
  const p = validateProposal(value, { source, ...context });
  const batch = uid();
  const remap = new Map<string, string>();
  const added: Workspace["tasks"] = [];
  for (const candidate of p.tasks) {
    const existing = [...w.tasks, ...added].find(
      (t) =>
        (t.aiOriginId === candidate.id && t.source === source) ||
        t.title.trim().toLowerCase() === candidate.title.trim().toLowerCase(),
    );
    const task = existing ?? {
      ...makeTask(candidate.title, source),
      kind: candidate.kind,
      waiting: false,
      notes: candidate.notes ?? "",
      estimatedMinutes: candidate.estimatedMinutes,
      estimateSource: candidate.estimatedMinutes === null ? null : "source",
      scheduledStart: candidate.scheduledStart ?? undefined,
      due: candidate.due ?? undefined,
      aiBatch: batch,
      aiOriginId: candidate.id,
    };
    remap.set(candidate.id, task.id);
    if (!existing) added.push(task);
  }
  const tasks = [...w.tasks, ...added];
  const accepted = [...w.edges];
  const suggestions = [...w.suggestions];
  for (const candidate of p.dependencies) {
    const e = {
      source: remap.get(candidate.predecessorId)!,
      target: remap.get(candidate.successorId)!,
    };
    if (
      w.dismissedSuggestions.some(
        (old) => old.source === e.source && old.target === e.target,
      )
    )
      continue;
    if (
      accepted.some(
        (old) => old.source === e.source && old.target === e.target,
      ) ||
      suggestions.some(
        (old) => old.source === e.source && old.target === e.target,
      )
    )
      continue;
    const issue = validateEdge(e, tasks, accepted);
    if (issue)
      throw new Error(
        `This proposal conflicts with your current map: ${issue}`,
      );
    accepted.push(e);
    suggestions.push({
      ...e,
      explanation: candidate.explanation,
      confidence: candidate.confidence,
      evidence: candidate.evidence,
      evidenceCategory: candidate.evidenceCategory,
      confirmationStatus: "unconfirmed",
      origin: "groq",
      batch,
    });
  }
  const goals = [
    ...w.goals,
    ...p.goals
      .filter(
        (g) =>
          !w.goals.some(
            (old) => old.title.toLowerCase() === g.title.toLowerCase(),
          ),
      )
      .map((g) => ({
        id: uid(),
        title: g.title,
        notes: g.notes ?? "",
        taskIds: g.taskIds.map((id) => remap.get(id)!),
      })),
  ];
  if (tasks.length > 500 || suggestions.length > 10000 || goals.length > 100)
    throw new Error(
      "This workspace is full. Export a backup and start a fresh space.",
    );
  return {
    ...w,
    tasks,
    suggestions,
    goals,
    questions: [...new Set([...w.questions, ...p.questions])].slice(0, 100),
    aiSummary: p.summary,
  };
}
