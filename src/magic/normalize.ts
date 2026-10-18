import type { Proposal } from "./contract.js";
import {
  isActionTitle,
  isEventTitle,
  statedDuration,
  parseDeadline,
  resolveDate,
  type CalendarContext,
} from "../parser/context.js";
export interface ProposalContext extends CalendarContext {
  source: string;
}
export function normalizeProposal(
  p: Proposal,
  context?: ProposalContext,
): Proposal {
  const result = structuredClone(p);
  const source = context?.source;
  const quoted = (quote: string | null) =>
    !!quote && !!source && source.includes(quote);
  for (const task of result.tasks) {
    if (isActionTitle(task.title)) task.kind = "ACTION";
    else if (isEventTitle(task.title)) task.kind = "WAITING_EVENT";
    const stated = context ? statedDuration(task.title, context.source) : null;
    if (stated) {
      task.estimatedMinutes = stated.minutes;
      task.estimateEvidence = stated.evidence;
    } else {
      task.estimatedMinutes = null;
      task.estimateEvidence = null;
    }
    if (context) {
      task.due = quoted(task.deadlineEvidence)
        ? parseDeadline(task.deadlineEvidence!, context)
        : null;
      if (
        quoted(task.deadlineEvidence) &&
        task.due === null &&
        /exam|meeting|event|presentation/i.test(task.deadlineEvidence ?? "")
      )
        result.questions = [
          ...new Set([
            ...result.questions,
            `What is the date of the event that sets the deadline for “${task.title}”?`,
          ]),
        ].slice(0, 8);
      task.scheduledStart =
        quoted(task.scheduleEvidence) &&
        !/\b(by|due|before|deadline)\b/i.test(task.scheduleEvidence!)
          ? resolveDate(task.scheduleEvidence!, context)
          : null;
    } else {
      task.due = null;
      if (
        quoted(task.deadlineEvidence) &&
        task.due === null &&
        /exam|meeting|event|presentation/i.test(task.deadlineEvidence ?? "")
      )
        result.questions = [
          ...new Set([
            ...result.questions,
            `What is the date of the event that sets the deadline for “${task.title}”?`,
          ]),
        ].slice(0, 8);
      task.scheduledStart = null;
    }
  }
  const supports = (id: string, quote: string) => {
    const title = result.tasks.find((t) => t.id === id)?.title ?? "";
    const ignored = new Set([
      "the",
      "and",
      "for",
      "from",
      "with",
      "that",
      "this",
      "receive",
      "need",
      "must",
      "have",
    ]);
    const words = (title.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(
      (w) => !ignored.has(w),
    );
    return words.some((w) =>
      quote.toLowerCase().includes(w.length > 4 ? w.slice(0, -1) : w),
    );
  };
  result.dependencies = result.dependencies.filter((edge) => {
    if (edge.evidenceCategory !== "prerequisite") return false;
    if (
      edge.confidence === "explicit" &&
      (!quoted(edge.evidence) ||
        !supports(edge.predecessorId, edge.evidence ?? "") ||
        !supports(edge.successorId, edge.evidence ?? "") ||
        !/(?:\bbefore\b|\buntil\b|\brequir(?:e|es|ed)\b|\bdepend|\bonly (?:after|once)\b|\bmust .+ first\b)/i.test(
          edge.evidence ?? "",
        ))
    )
      edge.confidence = "inferred";
    if (!quoted(edge.evidence)) edge.evidence = null;
    edge.confirmationStatus = "unconfirmed";
    return true;
  });
  if (context) {
    for (const goal of result.goals) {
      if (!quoted(goal.evidence)) {
        const words = (
          goal.title.toLowerCase().match(/[a-z]{3,}/g) ?? []
        ).filter(
          (w) => !["the", "for", "and", "with", "goal", "want"].includes(w),
        );
        const evidence = source
          ?.split(/[.!?\n]+/)
          .map((s) => s.trim())
          .find(
            (sentence) =>
              /\b(wants?|goal|aim|hope|submit|prepare|launch|finish|complete|win|pass|deliver)\b/i.test(
                sentence,
              ) &&
              words.length >= 2 &&
              words.every((w) =>
                sentence.toLowerCase().includes(w.replace(/s$/, "")),
              ),
          );
        if (evidence) goal.evidence = evidence;
      }
    }
  }
  if (context)
    result.goals = result.goals.filter(
      (g) =>
        quoted(g.evidence) &&
        /\b(wants?|goal|aim|hope|submit|prepare|launch|finish|complete|win|pass|deliver|project|exam|application|website)\b/i.test(
          g.evidence,
        ) &&
        !/^(maintain personal|manage (?:my |daily )?responsibilities|stay productive|be productive)/i.test(
          g.title,
        ),
    );
  return result;
}
