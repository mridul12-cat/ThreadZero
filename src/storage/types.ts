import { isActionTitle, statedDuration } from "../parser/context.js";
import { z } from "zod";
const taskObject = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["ACTION", "WAITING_EVENT"]).default("ACTION"),
  eventResolvedAt: z.iso.datetime().nullable().default(null),
  scheduledStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    )
    .optional(),
  aiBatch: z.string().optional(),
  aiOriginId: z.string().optional(),
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10000).default(""),
  source: z.string().max(50000).default(""),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
      "Invalid date",
    )
    .optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().default(null),
  estimateSource: z.enum(["source", "user"]).nullable().default(null),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  status: z.enum(["todo", "active", "done"]).default("todo"),
  waiting: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
});
// Legacy durations had no provenance; preserve only explicitly confirmed values.
export const taskSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null) return value;
  const t = value as Record<string, unknown>;
  const kind =
    t.kind === "waiting"
      ? isActionTitle(String(t.title))
        ? "ACTION"
        : "WAITING_EVENT"
      : t.kind === "action"
        ? "ACTION"
        : (t.kind ??
          (t.waiting && /^(wait|receive|await)/i.test(String(t.title))
            ? "WAITING_EVENT"
            : "ACTION"));
  const stated = statedDuration(String(t.title ?? ""), String(t.source ?? ""));
  const statedMinutes = stated?.minutes ?? null;
  return {
    ...t,
    kind,
    estimateSource:
      "estimateSource" in t ? t.estimateSource : stated ? "source" : null,
    waiting: t.kind === "waiting" && kind === "ACTION" ? false : t.waiting,
    estimatedMinutes:
      "estimatedMinutes" in t
        ? t.estimatedMinutes
        : t.estimateSource === "user"
          ? t.effort
          : statedMinutes,
    eventResolvedAt:
      t.eventResolvedAt ??
      (kind === "WAITING_EVENT" && t.status === "done"
        ? (t.completedAt ?? t.createdAt)
        : null),
  };
}, taskObject);
export const edgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  explanation: z.string().max(1200).optional(),
  evidence: z.string().max(1200).nullable().optional(),
  evidenceCategory: z
    .enum(["prerequisite", "temporal", "related", "manual"])
    .optional(),
  confirmationStatus: z.enum(["unconfirmed", "confirmed"]).optional(),
  confidence: z.enum(["explicit", "inferred"]).optional(),
  origin: z.literal("groq").optional(),
  batch: z.string().optional(),
});
const goalSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(300),
  notes: z.string().max(1000),
  taskIds: z.array(z.string()).max(500),
});
export const workspaceSchema = z.object({
  version: z.literal(1),
  name: z.string().max(200),
  draft: z.string().max(100000),
  tasks: z.array(taskSchema).max(500),
  edges: z.array(edgeSchema).max(10000),
  suggestions: z.array(edgeSchema).max(10000),
  notes: z.array(z.string().max(50000)).max(500),
  history: z
    .array(
      z.object({ id: z.string(), text: z.string().max(1000), at: z.string() }),
    )
    .max(500),
  demo: z.boolean(),
  goals: z.array(goalSchema).max(100).default([]),
  questions: z.array(z.string().max(600)).max(100).default([]),
  aiSummary: z.string().max(1000).default(""),
  dismissedSuggestions: z.array(edgeSchema).max(10000).default([]),
});
export type Task = z.infer<typeof taskSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export const uid = () => crypto.randomUUID();
export const emptyWorkspace = (): Workspace => ({
  version: 1,
  name: "My little universe",
  draft: "",
  tasks: [],
  edges: [],
  suggestions: [],
  notes: [],
  history: [],
  demo: false,
  goals: [],
  questions: [],
  aiSummary: "",
  dismissedSuggestions: [],
});
export const makeTask = (title: string, source = title): Task => ({
  id: uid(),
  title,
  source,
  notes: "",
  kind: "ACTION",
  eventResolvedAt: null,
  estimatedMinutes: null,
  estimateSource: null,
  priority: "normal",
  status: "todo",
  waiting: false,
  createdAt: new Date().toISOString(),
});
