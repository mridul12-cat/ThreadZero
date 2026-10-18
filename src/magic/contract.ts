import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (v) => !/<\/?[a-z][^>]*>|```|javascript:|data:text\/html/i.test(v),
      "Executable markup is not accepted",
    );
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
export const proposalSchema = z.strictObject({
  tasks: z
    .array(
      z.strictObject({
        id,
        title: text(300),
        kind: z.enum(["ACTION", "WAITING_EVENT"]),
        notes: text(1200).nullable(),
        estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
        due: date.nullable(),
        estimateEvidence: text(600).nullable(),
        deadlineEvidence: text(600).nullable(),
        scheduledStart: date.nullable(),
        scheduleEvidence: text(600).nullable(),
      }),
    )
    .max(12),
  dependencies: z
    .array(
      z.strictObject({
        predecessorId: id,
        successorId: id,
        explanation: text(600),
        confidence: z.enum(["explicit", "inferred"]),
        evidenceCategory: z.enum(["prerequisite", "temporal", "related"]),
        evidence: text(600).nullable(),
        confirmationStatus: z.literal("unconfirmed"),
      }),
    )
    .max(24),
  goals: z
    .array(
      z.strictObject({
        id,
        title: text(300),
        notes: text(1000).nullable(),
        taskIds: z.array(id).max(12),
        evidence: text(600),
      }),
    )
    .max(6),
  questions: z.array(text(600)).max(8),
  summary: text(1000),
});
// Groq strict mode requires every property, nullable optionals, and closed objects.
const string = { type: "string" };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const arr = (items: unknown) => ({ type: "array", items });
export const proposalJsonSchema = obj({
  tasks: arr(
    obj({
      id: string,
      title: string,
      kind: { type: "string", enum: ["ACTION", "WAITING_EVENT"] },
      notes: { type: ["string", "null"] },
      estimatedMinutes: { type: ["integer", "null"] },
      due: { type: ["string", "null"] },
      estimateEvidence: { type: ["string", "null"] },
      deadlineEvidence: { type: ["string", "null"] },
      scheduledStart: { type: ["string", "null"] },
      scheduleEvidence: { type: ["string", "null"] },
    }),
  ),
  dependencies: arr(
    obj({
      predecessorId: string,
      successorId: string,
      explanation: string,
      confidence: { type: "string", enum: ["explicit", "inferred"] },
      evidenceCategory: {
        type: "string",
        enum: ["prerequisite", "temporal", "related"],
      },
      evidence: { type: ["string", "null"] },
      confirmationStatus: { type: "string", enum: ["unconfirmed"] },
    }),
  ),
  goals: arr(
    obj({
      id: string,
      title: string,
      notes: { type: ["string", "null"] },
      taskIds: arr(string),
      evidence: string,
    }),
  ),
  questions: arr(string),
  summary: string,
});
export type Proposal = z.infer<typeof proposalSchema>;
export const requestSchema = z.strictObject({
  text: z
    .string()
    .trim()
    .min(1)
    .max(1500)
    .refine((v) => new TextEncoder().encode(v).length <= 3000),
  consent: z.literal(true),
  today: date,
  timeZone: z
    .string()
    .min(1)
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
});
export const COOLDOWN_SECONDS = 65;
