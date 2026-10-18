import { openDB } from "idb";
import { workspaceSchema, type Workspace } from "./types";
import { validateEdge } from "../graph/engine";
const database = () =>
  openDB("threadzero", 1, {
    upgrade(db) {
      db.createObjectStore("workspace");
    },
  });
export function validateWorkspace(value: unknown): Workspace {
  const parsed = workspaceSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues
        .slice(0, 3)
        .map(
          (issue) => `${issue.path.join(".") || "workspace"}: ${issue.message}`,
        )
        .join("; "),
    );
  const w = parsed.data;
  const ids = new Set(w.tasks.map((t) => t.id));
  if (ids.size !== w.tasks.length) throw new Error("Duplicate task IDs.");
  const accepted: typeof w.edges = [];
  for (const edge of w.edges) {
    const error = validateEdge(edge, w.tasks, accepted);
    if (error) throw new Error(error);
    accepted.push(edge);
  }
  for (const s of w.suggestions)
    if (!ids.has(s.source) || !ids.has(s.target) || s.source === s.target)
      throw new Error("Invalid suggested connection.");
  for (const goal of w.goals)
    if (goal.taskIds.some((id) => !ids.has(id)))
      throw new Error("A goal refers to a missing task.");
  return w;
}
export async function load() {
  const db = await database();
  try {
    const v = await db.get("workspace", "current");
    return v ? validateWorkspace(v) : null;
  } finally {
    db.close();
  }
}
export async function save(w: Workspace) {
  const db = await database();
  try {
    await db.put("workspace", w, "current");
  } finally {
    db.close();
  }
}
export async function erase() {
  const db = await database();
  try {
    await db.clear("workspace");
  } finally {
    db.close();
  }
}
