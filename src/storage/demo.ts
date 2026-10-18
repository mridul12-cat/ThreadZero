import { emptyWorkspace, makeTask, type Workspace } from "./types";
export const exampleDump =
  "I have to finish my presentation by Friday. First I need to choose a topic. I need to email my teacher by tomorrow. I should ask Alex for the research. I'm waiting for Alex to send the research. I can't write the outline until I choose a topic. I need to build the slides, practice my talk, and study for my exam. It all feels a little tangled.";
export function demoWorkspace(): Workspace {
  const w = emptyWorkspace();
  w.name = "The Presentation Panic";
  w.demo = true;
  w.draft = exampleDump;
  const titles = [
    "Choose a presentation topic",
    "Email my teacher",
    "Request the research from Alex",
    "Wait for Alex’s research",
    "Write the outline",
    "Build the slides",
    "Practice the presentation",
    "Submit the presentation",
    "Study for the exam",
    "Pack notes for class",
  ];
  w.tasks = titles.map((title, i) => ({
    ...makeTask(title),
    id: `demo-${i}`,
    estimatedMinutes: null,
    kind: i === 3 ? "WAITING_EVENT" : "ACTION",
    waiting: false,
    priority: i === 0 ? "high" : "normal",
  }));
  const due = new Date();
  due.setDate(due.getDate() + ((5 - due.getDay() + 7) % 7 || 7));
  w.tasks[7].due = due.toLocaleDateString("en-CA");
  w.tasks[1].due = new Date(Date.now() + 86400000).toLocaleDateString("en-CA");
  w.edges = [
    [2, 3],
    [0, 4],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [8, 9],
  ].map(([s, t]) => ({ source: `demo-${s}`, target: `demo-${t}` }));
  return w;
}
