import {
  parseMinutes,
  parseDeadline,
  resolveDate,
  calendarContext,
  isEventTitle,
  isActionTitle,
} from "./context";
import { makeTask, type Task, type Edge } from "../storage/types";
export function parseDue(text: string, now = new Date()): string | undefined {
  return parseDeadline(text, calendarContext(now)) ?? undefined;
}
function clean(s: string) {
  return s
    .trim()
    .replace(/^[-*\d.)\s]+/, "")
    .replace(
      /^(?:(?:and|also|then|first)\s+)*(?:(?:I\s+(?:(?:also|still)\s+)?)?(?:need to|have to|must|should|want to)|remember to)\s+/i,
      "",
    )
    .replace(/^I(?:'m| am)\s+waiting\b/i, "Waiting")
    .replace(
      /^I\s+(?=receive|choose|finish|build|send|write|study|email|wait)\b/i,
      "",
    )
    .replace(
      /^(?:by|due)\s+(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*,?\s*/i,
      "",
    )
    .replace(/^(?:I\s+)?(?:also|then|first)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}
export function extract(input: unknown, now = new Date()) {
  const tasks: Task[] = [];
  const suggestions: Edge[] = [];
  const notes: string[] = [];
  if (typeof input !== "string") return { tasks, suggestions, notes };
  const add = (title: string, source: string) => {
    const rawTitle = title;
    title = clean(title);
    if (!title) return undefined;
    if (title.length > 500) {
      notes.push(source);
      return undefined;
    }
    const found = tasks.find(
      (t) => t.title.toLowerCase() === title.toLowerCase(),
    );
    if (found) return found;
    const t = makeTask(title[0].toUpperCase() + title.slice(1), source);
    t.due = parseDue(rawTitle, now);
    t.kind =
      isEventTitle(title) && !isActionTitle(title) ? "WAITING_EVENT" : "ACTION";
    t.waiting = false;
    t.estimatedMinutes = parseMinutes(rawTitle);
    t.estimateSource = t.estimatedMinutes === null ? null : "source";
    if (!t.due)
      t.scheduledStart =
        resolveDate(rawTitle, calendarContext(now)) ?? undefined;
    tasks.push(t);
    return t;
  };
  for (const original of input
    .split(/[\n.!?;]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    let m = original.match(/^(?:I\s+)?can(?:not|'t)\s+(.+?)\s+until\s+(.+)$/i);
    if (m) {
      const target = add(m[1], original);
      const source = add(m[2], original);
      if (source && target && source.id !== target.id)
        suggestions.push({
          source: source.id,
          target: target.id,
          confidence: "explicit",
          evidenceCategory: "prerequisite",
          confirmationStatus: "unconfirmed",
          evidence: original,
          explanation:
            "The until phrase states a prerequisite. Please verify it before confirming.",
        });
      continue;
    }
    m = original.match(
      /^(?:before|after|once)\s+(?:I\s+)?(.+?)(?:\s+is done)?,\s*(.+)$/i,
    );
    if (m) {
      const first = add(m[1], original);
      const second = add(m[2], original);
      if (first && second && first.id !== second.id)
        suggestions.push({
          ...(/^before/i.test(original)
            ? { source: second.id, target: first.id }
            : { source: first.id, target: second.id }),
          confidence: /^before/i.test(original) ? "explicit" : "inferred",
          evidenceCategory: /^before/i.test(original)
            ? "prerequisite"
            : "temporal",
          confirmationStatus: "unconfirmed",
          evidence: original,
          explanation: /^before/i.test(original)
            ? "The before phrase suggests a prerequisite; verify its meaning."
            : "This may be temporal ordering rather than a prerequisite. Confirm only if it is necessary.",
        });
      continue;
    }
    const chunks = original
      .replace(
        /^((?:by|due)\s+(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)),\s*/i,
        "$1 ",
      )
      .split(
        /,\s*(?:and\s+)?(?=(?:clean|finish|buy|reply|email|study|feed|research)\b)|\s+and\s+(?=(?:I\s+)?(?:need to|have to|must|remember to|study|email|finish|choose|send|call|buy|write|prepare|clean|reply|feed|research|practice|revise)\b)/i,
      );
    for (const chunk of chunks) {
      const title = clean(chunk);
      if (
        /^(?:remind|feed|fund|choose|finish|build|email|study|send|call|buy|write|prepare|review|revise|read|request|receive|wait|waiting|book|make|pay|complete|submit|practice|outline|collect|check|schedule|pick|research|draft|organize|clean|fix|reply|plan|create|design|update|test|download|install|learn|do|go|take|work|edit|ask|decide|start|find)\b/i.test(
          title,
        )
      )
        add(chunk, original);
      else notes.push(chunk);
    }
  }
  return { tasks, suggestions, notes };
}
