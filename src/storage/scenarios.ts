import type { Proposal } from "../magic/contract";
import { appendProposal } from "../magic/domain";
import { calendarContext, resolveDate } from "../parser/context";
import { emptyWorkspace } from "./types";
const task = (
  id: string,
  title: string,
  kind: "ACTION" | "WAITING_EVENT" = "ACTION",
): Proposal["tasks"][number] => ({
  id,
  title,
  kind,
  notes: null,
  estimatedMinutes: null,
  estimateEvidence: null,
  due: null,
  deadlineEvidence: null,
  scheduledStart: null,
  scheduleEvidence: null,
});
const edge = (
  predecessorId: string,
  successorId: string,
  evidence: string | null,
  confidence: "explicit" | "inferred" = "explicit",
): Proposal["dependencies"][number] => ({
  predecessorId,
  successorId,
  evidence,
  confidence,
  evidenceCategory: "prerequisite",
  confirmationStatus: "unconfirmed",
  explanation:
    confidence === "explicit"
      ? "The quoted text states this prerequisite."
      : "This may initiate the external process; confirm it only if this relationship is necessary.",
});
export const scenarioInputs = {
  science:
    "I want to submit my science fair project by Friday. Alex promised to send me the circuit diagram. I should remind Alex tomorrow. I need to email my teacher to request budget approval. I cannot order the sensor until I receive budget approval. I will wait for sensor delivery. I must receive the circuit diagram and the sensor before building the prototype. I must build the prototype before running experiments. I must run experiments before submitting the science fair project. I also need to revise calculus for about 45 minutes, practice 20 questions, and reply to my cousin.",
  cat: "I want my cat to win a Nobel Prize. I need to buy tuna before feeding her. I also need to research cat intelligence and email a university professor.",
  independent:
    "I need to clean my room, finish my math homework, buy groceries, and reply to my friend.",
};
export type ScenarioKey = keyof typeof scenarioInputs;
export function scenarioProposal(
  key: ScenarioKey,
  context = calendarContext(),
): Proposal {
  if (key === "cat")
    return {
      tasks: [
        task("buy", "Buy tuna"),
        task("feed", "Feed the cat"),
        task("research", "Research cat intelligence"),
        task("email", "Email a university professor"),
      ],
      dependencies: [
        edge("buy", "feed", "I need to buy tuna before feeding her"),
      ],
      goals: [
        {
          id: "nobel",
          title: "Cat wins a Nobel Prize",
          notes:
            "An aspirational, playful premise; this is not a guaranteed achievable outcome.",
          taskIds: ["research", "email"],
          evidence: "I want my cat to win a Nobel Prize",
        },
      ],
      questions: [],
      summary:
        "One feeding prerequisite and two independent research activities. Unknown durations remain unknown.",
    };
  if (key === "independent")
    return {
      tasks: [
        task("clean", "Clean my room"),
        task("math", "Finish my math homework"),
        task("buy", "Buy groceries"),
        task("reply", "Reply to my friend"),
      ],
      dependencies: [],
      goals: [],
      questions: [],
      summary:
        "Four independent actions. No umbrella goal or dependency was needed.",
    };
  const tasks = [
    task("remind", "Remind Alex about the circuit diagram"),
    task("diagram", "Receive the circuit diagram", "WAITING_EVENT"),
    task("email", "Email my teacher to request budget approval"),
    task("approval", "Receive budget approval", "WAITING_EVENT"),
    task("order", "Order the sensor"),
    task("sensor", "Receive the sensor delivery", "WAITING_EVENT"),
    task("build", "Build the prototype"),
    task("experiment", "Run experiments"),
    task("submit", "Submit the science fair project"),
    task("calculus", "Revise calculus"),
    task("practice", "Practice 20 questions"),
    task("reply", "Reply to my cousin"),
  ];
  Object.assign(tasks[0], {
    scheduledStart: resolveDate("tomorrow", context),
    scheduleEvidence: "I should remind Alex tomorrow",
  });
  Object.assign(tasks[8], {
    due: resolveDate("by Friday", context),
    deadlineEvidence: "I want to submit my science fair project by Friday",
  });
  Object.assign(tasks[9], {
    estimatedMinutes: 45,
    estimateEvidence: "revise calculus for about 45 minutes",
  });
  return {
    tasks,
    dependencies: [
      edge(
        "approval",
        "order",
        "I cannot order the sensor until I receive budget approval",
      ),
      edge(
        "diagram",
        "build",
        "I must receive the circuit diagram and the sensor before building the prototype",
      ),
      edge(
        "sensor",
        "build",
        "I must receive the circuit diagram and the sensor before building the prototype",
      ),
      edge(
        "build",
        "experiment",
        "I must build the prototype before running experiments",
      ),
      edge(
        "experiment",
        "submit",
        "I must run experiments before submitting the science fair project",
      ),
      edge("email", "approval", null, "inferred"),
      edge("order", "sensor", null, "inferred"),
    ],
    goals: [
      {
        id: "science",
        title: "Submit the science fair project",
        notes: null,
        taskIds: [
          "diagram",
          "email",
          "approval",
          "order",
          "sensor",
          "build",
          "experiment",
          "submit",
        ],
        evidence: "I want to submit my science fair project by Friday",
      },
    ],
    questions: ["Which delivery date has the supplier confirmed?"],
    summary:
      "Science work has separate diagram, approval and delivery branches. Reminding Alex does not receive the diagram. Math practice and replying to your cousin stay independent.",
  };
}
export function scenarioWorkspace(key: ScenarioKey) {
  const context = calendarContext();
  const w = appendProposal(
    emptyWorkspace(),
    scenarioProposal(key, context),
    scenarioInputs[key],
    context,
  );
  return {
    ...w,
    name:
      key === "science"
        ? "Science Fair · example"
        : key === "cat"
          ? "Cat Nobel Prize · example"
          : "Independent Threads · example",
    draft: scenarioInputs[key],
    demo: true,
  };
}
