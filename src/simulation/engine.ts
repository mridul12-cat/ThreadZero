import type { Task, Edge } from "../storage/types";
import { available, descendants } from "../graph/engine";
import { rank } from "../ranking/engine";
export function simulate(
  tasks: Task[],
  edges: Edge[],
  id: string,
  mode: "finish" | "delay",
  now = new Date(),
) {
  const derived = tasks.map((t) =>
    t.id === id
      ? {
          ...t,
          ...(mode === "finish"
            ? {
                status: "done" as const,
                eventResolvedAt:
                  t.kind === "WAITING_EVENT"
                    ? now.toISOString()
                    : t.eventResolvedAt,
              }
            : { waiting: true }),
        }
      : { ...t },
  );
  const newlyAvailable = derived.filter(
    (t) =>
      available(t, derived, edges) &&
      !available(
        tasks.find((x) => x.id === t.id)!,
        tasks,
        edges,
      ),
  );
  const affected = descendants(id, edges);
  return {
    tasks: derived,
    newlyAvailable,
    blocked: derived.filter(
      (t) => t.status !== "done" && !available(t, derived, edges),
    ),
    affected: tasks.filter((t) => affected.has(t.id) && t.status !== "done"),
    atRisk: tasks.filter(
      (t) =>
        affected.has(t.id) &&
        t.status !== "done" &&
        t.due &&
        Date.parse(t.due + "T23:59:59") - now.getTime() < 7 * 86400000,
    ),
    next: rank(derived, edges, now)[0],
  };
}
