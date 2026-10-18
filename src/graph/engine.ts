import { calendarContext } from "../parser/context";
import type { Task, Edge } from "../storage/types";
export function descendants(id: string, edges: Edge[]): Set<string> {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const next = queue.pop()!;
    for (const e of edges)
      if (e.source === next && !seen.has(e.target)) {
        seen.add(e.target);
        queue.push(e.target);
      }
  }
  seen.delete(id);
  return seen;
}
export const prerequisites = (id: string, edges: Edge[]) =>
  edges.filter((e) => e.target === id).map((e) => e.source);
export function validateEdge(
  edge: Edge,
  tasks: Task[],
  edges: Edge[],
): string | null {
  if (
    !tasks.some((t) => t.id === edge.source) ||
    !tasks.some((t) => t.id === edge.target)
  )
    return "Both tasks must exist.";
  if (edge.source === edge.target) return "A task cannot depend on itself.";
  if (edges.some((e) => e.source === edge.source && e.target === edge.target))
    return "These tasks are already connected.";
  if (descendants(edge.target, edges).has(edge.source))
    return "This would create a circle: a task would eventually depend on itself. Remove a connection first.";
  return null;
}
export const isComplete = (task: Task) =>
  task.status === "done" &&
  (task.kind !== "WAITING_EVENT" || !!task.eventResolvedAt);
export function ancestors(id: string, edges: Edge[]): Set<string> {
  return descendants(
    id,
    edges.map((e) => ({ source: e.target, target: e.source })),
  );
}
export function pathMembers(id: string, edges: Edge[]): Set<string> {
  return new Set([id, ...ancestors(id, edges), ...descendants(id, edges)]);
}
export function blockers(task: Task, tasks: Task[], edges: Edge[]): Task[] {
  return prerequisites(task.id, edges)
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t && !isComplete(t));
}
export const available = (
  task: Task,
  tasks: Task[],
  edges: Edge[],
  today = calendarContext().today,
) =>
  task.status !== "done" &&
  task.kind !== "WAITING_EVENT" &&
  !task.waiting &&
  (!task.scheduledStart || task.scheduledStart <= today) &&
  blockers(task, tasks, edges).length === 0;
export const stateOf = (
  task: Task,
  tasks: Task[],
  edges: Edge[],
  today = calendarContext().today,
) =>
  isComplete(task)
    ? "Complete"
    : task.kind === "WAITING_EVENT" || task.waiting
      ? "Waiting"
      : task.scheduledStart && task.scheduledStart > today
        ? "Scheduled"
        : available(task, tasks, edges, today)
          ? "Ready"
          : "Blocked";
export function topological(tasks: Task[], edges: Edge[]): string[] {
  const degree = new Map(
    tasks.map((t) => [t.id, prerequisites(t.id, edges).length]),
  );
  const queue = tasks.filter((t) => degree.get(t.id) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of edges.filter((e) => e.source === id)) {
      degree.set(e.target, degree.get(e.target)! - 1);
      if (degree.get(e.target) === 0) queue.push(e.target);
    }
  }
  if (order.length !== tasks.length)
    throw new Error("The graph contains a cycle.");
  return order;
}
export function layout(tasks: Task[], edges: Edge[]) {
  const levels = new Map<string, number>();
  const rows = new Map<number, number>();
  return topological(tasks, edges).map((id) => {
    const level = Math.max(
      0,
      ...prerequisites(id, edges).map((p) => (levels.get(p) ?? 0) + 1),
    );
    levels.set(id, level);
    const row = rows.get(level) ?? 0;
    rows.set(level, row + 1);
    return { id, position: { x: level * 310 + 40, y: row * 165 + 50 } };
  });
}
