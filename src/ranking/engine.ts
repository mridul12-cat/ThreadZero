import type { Task, Edge } from "../storage/types";
import { calendarContext } from "../parser/context";
import { available, descendants } from "../graph/engine";
export function score(
  task: Task,
  tasks: Task[],
  edges: Edge[],
  now: Date,
): number {
  const days = task.due
    ? (Date.parse(task.due + "T23:59:59") - now.getTime()) / 86400000
    : Infinity;
  const urgency =
    days <= 0 ? 50 : days <= 1 ? 40 : days <= 3 ? 28 : days <= 7 ? 14 : 0;
  const downstream = [...descendants(task.id, edges)].filter(
    (id) => tasks.find((t) => t.id === id)?.status !== "done",
  ).length;
  return (
    urgency +
    { low: 0, normal: 8, high: 20 }[task.priority] +
    Math.min(24, downstream * 6) +
    (task.estimatedMinutes === null
      ? 7.5
      : Math.max(0, 15 - task.estimatedMinutes / 4))
  );
}
export function rank(
  tasks: Task[],
  edges: Edge[],
  now = new Date(),
  availableMinutes: number | null = null,
): Task[] {
  return tasks
    .filter(
      (t) =>
        available(t, tasks, edges, calendarContext(now).today) &&
        (availableMinutes === null ||
          t.estimatedMinutes === null ||
          t.estimatedMinutes <= availableMinutes),
    )
    .sort(
      (a, b) =>
        score(b, tasks, edges, now) - score(a, tasks, edges, now) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
export function explain(task: Task, tasks: Task[], edges: Edge[]): string {
  const children = edges
    .filter((e) => e.source === task.id)
    .map((e) => tasks.find((t) => t.id === e.target))
    .filter((t): t is Task => !!t && t.status !== "done");
  const external = children.find((t) => t.kind === "WAITING_EVENT");
  const direct = children.find((t) => t.kind === "ACTION");
  const why = external
    ? `This can begin the process for “${external.title}”. That event still needs to be confirmed received; finishing this action will not resolve it.`
    : direct
      ? `Finishing this satisfies one prerequisite for “${direct.title}”. Other prerequisites may still need attention.`
      : "This is ready to do, with no unfinished prerequisites.";
  return `${why}${task.estimatedMinutes !== null ? ` Your estimate: ${task.estimatedMinutes} minutes.` : " Time not estimated."}${task.priority === "high" ? " You marked this high priority." : ""}${task.due ? ` Deadline: ${task.due}.` : ""}`;
}
