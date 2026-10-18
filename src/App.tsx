import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Mic,
  Sparkles,
  ShieldCheck,
  Settings2,
  Plus,
  Check,
  GitBranch,
  List,
  Network,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  X,
  Leaf,
  Play,
  Clock,
  ChevronRight,
  BookOpen,
  Sun,
  VolumeX,
} from "lucide-react";
import { effortLabel, type CalendarContext } from "./parser/context";
import MagicCapture from "./magic/MagicCapture";
import { appendProposal } from "./magic/domain";
import type { Proposal } from "./magic/contract";
import Pip from "./components/Pip";
import ReviewConnections from "./components/ReviewConnections";
import TaskEditor from "./components/TaskEditor";
import {
  emptyWorkspace,
  makeTask,
  uid,
  type Workspace,
  type Task,
  type Edge,
} from "./storage/types";
import { load, save, erase, validateWorkspace } from "./storage/store";
import { scenarioWorkspace, type ScenarioKey } from "./storage/scenarios";
import { demoWorkspace, exampleDump } from "./storage/demo";
import { extract } from "./parser/extract";
import { available, stateOf, validateEdge } from "./graph/engine";
import { rank, explain } from "./ranking/engine";
import { simulate } from "./simulation/engine";
const ThreadMap = lazy(() => import("./components/ThreadMap"));
const VoicePanel = lazy(() => import("./voice/VoicePanel"));
type Page = "Dump" | "Review" | "Map" | "Focus";
const navIcons = { Dump: Sparkles, Review: List, Map: GitBranch, Focus: Sun };
function pref(key: string) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [autoSaveAllowed, setAutoSaveAllowed] = useState(false);
  const [page, setPage] = useState<Page>("Dump");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [voice, setVoice] = useState(false);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [listView, setListView] = useState(false);
  const [scenario, setScenario] = useState<{
    id: string;
    mode: "finish" | "delay";
  }>();
  const [undo, setUndo] = useState<Workspace>();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");
  const [mascot, setMascot] = useState(() => !pref("hidePip"));
  const [contrast, setContrast] = useState(() => pref("contrast"));
  const [motion, setMotion] = useState(() => pref("reduceMotion"));
  const [storageStatus, setStorageStatus] = useState(
    "Opening your local space…",
  );
  const [filter, setFilter] = useState("all");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const initialNav = useRef(true);
  const latestWorkspace = useRef(workspace);
  latestWorkspace.current = workspace;
  const tasks = workspace.tasks;
  const edges = workspace.edges;
  useEffect(() => {
    let cancelled = false;
    void load()
      .then((w) => {
        if (!cancelled) {
          if (w) setWorkspace(w);
          setAutoSaveAllowed(true);
          setStorageStatus("Saved on this device");
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Device storage is unavailable or unreadable. This session still works; export a backup before closing.",
          );
          setStorageStatus("Session only · export a backup");
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready || !autoSaveAllowed) return;
    const timer = setTimeout(() => {
      void save(workspace)
        .then(() => setStorageStatus("Saved on this device"))
        .catch(() => {
          setStorageStatus("Save failed · export a backup");
          setError(
            "Your last changes could not be saved. Export your workspace to keep them.",
          );
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [workspace, ready, autoSaveAllowed]);
  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else dialog.current?.close();
  }, [settings]);
  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", contrast);
    document.documentElement.classList.toggle("reduce-motion", motion);
    try {
      localStorage.setItem("contrast", String(contrast));
      localStorage.setItem("reduceMotion", String(motion));
      localStorage.setItem("hidePip", String(!mascot));
    } catch {
      /* Preferences remain in memory. */
    }
  }, [contrast, motion, mascot]);
  useEffect(() => {
    if (initialNav.current) {
      initialNav.current = false;
      return;
    }
    heading.current?.focus();
  }, [page]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  const ranked = useMemo(
    () => rank(tasks, edges, now, availableMinutes),
    [tasks, edges, availableMinutes, now],
  );
  const next = ranked.find((t) => !skipped.includes(t.id)) ?? ranked[0];
  const done = tasks.filter((t) => t.status === "done").length;
  const currentTask = tasks.find((t) => t.id === selected);
  const preview = useMemo(
    () =>
      scenario ? simulate(tasks, edges, scenario.id, scenario.mode) : null,
    [tasks, edges, scenario],
  );
  function commit(fn: (w: Workspace) => Workspace, message?: string) {
    setWorkspace((w) => {
      const updated = fn(w);
      return {
        ...updated,
        history: message
          ? [
              { id: uid(), text: message, at: new Date().toISOString() },
              ...w.history,
            ].slice(0, 200)
          : updated.history,
      };
    });
    if (message) setNotice(message);
  }
  function updateTask(task: Task) {
    commit((w) => ({
      ...w,
      tasks: w.tasks.map((t) => (t.id === task.id ? task : t)),
    }));
  }
  function addEdge(edge: Edge) {
    const issue = validateEdge(edge, tasks, edges);
    if (issue) {
      setError(issue);
      return;
    }
    commit(
      (w) => ({
        ...w,
        edges: [
          ...w.edges,
          {
            ...edge,
            evidenceCategory: edge.evidenceCategory ?? "manual",
            confirmationStatus: "confirmed",
          },
        ],
        suggestions: w.suggestions.filter(
          (e) => e.source !== edge.source || e.target !== edge.target,
        ),
      }),
      "Connection confirmed. The map has found its shape.",
    );
  }
  function confirmSuggestions(candidates: Edge[]) {
    const combined = [...edges];
    for (const edge of candidates) {
      const problem = validateEdge(edge, tasks, combined);
      if (problem) {
        setError(problem);
        return;
      }
      combined.push({ ...edge, confirmationStatus: "confirmed" });
    }
    setUndo(workspace);
    commit(
      (w) => ({
        ...w,
        edges: combined,
        suggestions: w.suggestions.filter(
          (e) =>
            !candidates.some(
              (c) => c.source === e.source && c.target === e.target,
            ),
        ),
      }),
      `${candidates.length} connection(s) confirmed. Inferred suggestions stay yours to decide.`,
    );
  }
  function rejectSuggestions(candidates: Edge[]) {
    setUndo(workspace);
    commit(
      (w) => ({
        ...w,
        suggestions: w.suggestions.filter(
          (e) =>
            !candidates.some(
              (c) => c.source === e.source && c.target === e.target,
            ),
        ),
        dismissedSuggestions: [...w.dismissedSuggestions, ...candidates],
      }),
      "Suggestions set aside.",
    );
  }
  function addGoal() {
    const title = window.prompt(
      "What meaningful outcome are you working toward?",
    );
    if (title?.trim())
      commit(
        (w) => ({
          ...w,
          goals: [
            ...w.goals,
            {
              id: uid(),
              title: title.trim().slice(0, 300),
              notes: "",
              taskIds: [],
            },
          ],
        }),
        "A bigger hope added.",
      );
  }
  function removeEdge(edge: Edge) {
    commit(
      (w) => ({
        ...w,
        edges: w.edges.filter(
          (e) => e.source !== edge.source || e.target !== edge.target,
        ),
      }),
      "Connection removed.",
    );
  }
  function complete(task: Task) {
    setUndo(workspace);
    const reopening = task.status === "done";
    const updated = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            status: reopening ? ("todo" as const) : ("done" as const),
            completedAt: reopening ? undefined : new Date().toISOString(),
            eventResolvedAt:
              t.kind === "WAITING_EVENT"
                ? reopening
                  ? null
                  : new Date().toISOString()
                : t.eventResolvedAt,
          }
        : t,
    );
    const newly = updated.filter(
      (t) =>
        available(t, updated, edges) &&
        !available(
          tasks.find((a) => a.id === t.id)!,
          tasks,
          edges,
        ),
    );
    commit(
      (w) => ({ ...w, tasks: updated }),
      reopening
        ? "Task reopened."
        : `One knot untangled.${newly.length ? ` ${newly.length} new ${newly.length === 1 ? "task is" : "tasks are"} ready.` : ""}`,
    );
    setSkipped([]);
  }
  function deleteTask(id: string) {
    setUndo(workspace);
    commit(
      (w) => ({
        ...w,
        tasks: w.tasks.filter((t) => t.id !== id),
        goals: w.goals.map((g) => ({
          ...g,
          taskIds: g.taskIds.filter((tid) => tid !== id),
        })),
        dismissedSuggestions: w.dismissedSuggestions.filter(
          (e) => e.source !== id && e.target !== id,
        ),
        edges: w.edges.filter((e) => e.source !== id && e.target !== id),
        suggestions: w.suggestions.filter(
          (e) => e.source !== id && e.target !== id,
        ),
      }),
      "Task removed. Its connections were removed too.",
    );
    setSelected(undefined);
  }
  function addTask() {
    if (tasks.length >= 500) {
      setError(
        "This space holds up to 500 tasks. Export a backup and start a fresh workspace for more.",
      );
      return;
    }
    const title = window.prompt("What’s the next little thing?");
    if (title?.trim()) {
      const task = makeTask(title.trim().slice(0, 500));
      commit(
        (w) => ({ ...w, tasks: [...w.tasks, task] }),
        "A new thread added.",
      );
      setSelected(task.id);
    }
  }
  function untangle() {
    if (!workspace.draft.trim()) {
      setError("Start with a thought, a task, or a little of both.");
      return;
    }
    const parsed = extract(workspace.draft);
    const unique = parsed.tasks.filter(
      (t) =>
        !tasks.some((old) => old.title.toLowerCase() === t.title.toLowerCase()),
    );
    if (
      tasks.length + unique.length > 500 ||
      workspace.notes.length + parsed.notes.length > 500
    ) {
      setError(
        "This dump contains more than 500 tasks or notes. Please split it into smaller pieces; your original text is still here.",
      );
      return;
    }
    const remap = new Map(
      parsed.tasks.map((t) => [
        t.id,
        tasks.find((old) => old.title.toLowerCase() === t.title.toLowerCase())
          ?.id ?? t.id,
      ]),
    );
    const suggestions = parsed.suggestions
      .map((e) => ({
        ...e,
        source: remap.get(e.source)!,
        target: remap.get(e.target)!,
      }))
      .filter(
        (e) =>
          e.source !== e.target &&
          !edges.some((x) => x.source === e.source && x.target === e.target) &&
          !workspace.suggestions.some(
            (x) => x.source === e.source && x.target === e.target,
          ),
      );
    commit(
      (w) => ({
        ...w,
        tasks: [...w.tasks, ...unique],
        suggestions: [...w.suggestions, ...suggestions],
        notes: [...new Set([...w.notes, ...parsed.notes])],
      }),
      `${unique.length} candidate ${unique.length === 1 ? "task" : "tasks"} found. Take a moment to make them yours.`,
    );
    setPage("Review");
  }
  function receiveMagic(
    proposal: Proposal,
    source: string,
    context: CalendarContext,
  ) {
    // Append to the latest state; existing tasks, edits and completion are preserved.
    const current = latestWorkspace.current;
    const updated = appendProposal(current, proposal, source, context);
    setUndo(current);
    setWorkspace(updated);
    setNotice(
      "Magic suggestions added for review. Connections stay dotted until you accept them.",
    );
    setPage("Review");
  }
  function loadScenario(key: ScenarioKey) {
    if (
      (tasks.length || workspace.draft) &&
      !window.confirm(
        "Replace this workspace with the labeled example? Undo is available; export a backup first if needed.",
      )
    )
      return;
    setUndo(workspace);
    setWorkspace(scenarioWorkspace(key));
    setSelected(undefined);
    setScenario(undefined);
    setPage("Review");
    setSettings(false);
    setNotice(
      "Labeled example loaded. Review connections before accepting them.",
    );
  }
  function loadExample() {
    if (
      (tasks.length || workspace.draft.trim()) &&
      !window.confirm(
        "Load “The Presentation Panic”? This replaces this workspace. You can undo, or cancel and export a backup first.",
      )
    )
      return;
    setUndo(workspace);
    setWorkspace(demoWorkspace());
    setPage("Map");
    setSelected(undefined);
    setScenario(undefined);
    setNotice("Example project loaded. Everything here is interactive.");
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "threadzero-workspace.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Workspace exported. Keep this file somewhere safe.");
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Please choose a workspace smaller than 5 MB.");
      const incoming = validateWorkspace(JSON.parse(await file.text()));
      if (
        (tasks.length || workspace.draft) &&
        !window.confirm(
          "Replace this workspace with the imported file? You can undo.",
        )
      )
        return;
      setUndo(workspace);
      setWorkspace(incoming);
      setAutoSaveAllowed(true);
      setSelected(undefined);
      setScenario(undefined);
      setNotice("Your threads are back. Workspace imported.");
      setSettings(false);
      setPage("Map");
    } catch (e) {
      setError(
        `Import failed: ${e instanceof Error ? e.message : "Invalid workspace file."}`,
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function merge() {
    if (!currentTask || !mergeTarget) return;
    const source = currentTask.id,
      target = mergeTarget;
    const newEdges = edges
      .map((e) => ({
        source: e.source === source ? target : e.source,
        target: e.target === source ? target : e.target,
      }))
      .filter((e) => e.source !== e.target);
    const dedup = newEdges.filter(
      (e, i, arr) =>
        arr.findIndex((a) => a.source === e.source && a.target === e.target) ===
        i,
    );
    const remaining = tasks.filter((t) => t.id !== source);
    const accepted: Edge[] = [];
    for (const e of dedup) {
      const issue = validateEdge(e, remaining, accepted);
      if (issue) {
        setError(
          "Merging these tasks would create a cycle. Remove a conflicting connection first.",
        );
        return;
      }
      accepted.push(e);
    }
    setUndo(workspace);
    commit(
      (w) => ({
        ...w,
        tasks: remaining.map((t) =>
          t.id === target
            ? {
                ...t,
                notes: [t.notes, currentTask.title, currentTask.notes]
                  .filter(Boolean)
                  .join("\n"),
                source: [t.source, currentTask.source].join("\n"),
              }
            : t,
        ),
        edges: accepted,
        dismissedSuggestions: w.dismissedSuggestions.filter(
          (e) => e.source !== source && e.target !== source,
        ),
        goals: w.goals.map((g) => ({
          ...g,
          taskIds: [
            ...new Set(g.taskIds.map((id) => (id === source ? target : id))),
          ],
        })),
        suggestions: w.suggestions.filter(
          (e) => e.source !== source && e.target !== source,
        ),
      }),
      "Tasks merged.",
    );
    setSelected(target);
    setMergeTarget("");
  }
  return (
    <div className="app-shell">
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Dump");
          }}
          aria-label="ThreadZero home"
        >
          <svg viewBox="0 0 42 42" aria-hidden="true">
            <path
              d="M3 24c11-28 33-22 32-5-1 19-29 20-27 1S40 7 38 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <span>
            thread<span className="brand-zero">zero</span>
            <span className="brand-period">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(["Dump", "Review", "Map", "Focus"] as Page[]).map((item, i) => {
            const Icon = navIcons[item];
            return (
              <button
                key={item}
                className={page === item ? "nav-item active" : "nav-item"}
                aria-label={item}
                aria-current={page === item ? "page" : undefined}
                onClick={() => {
                  setPage(item);
                  setScenario(undefined);
                }}
              >
                <Icon size={16} />
                <span>{item}</span>
                <small>0{i + 1}</small>
              </button>
            );
          })}
        </nav>
        <div className="header-end">
          <span className="local-badge">
            <span /> A little space, just for you
          </span>
          <button
            className="icon-button"
            aria-label="Settings and local data"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      <main>
        {!ready ? (
          <div className="empty-state">
            <span className="eyebrow">OPENING YOUR LOCAL SPACE</span>
            <p>A moment to gather your threads…</p>
          </div>
        ) : (
          <>
            {page === "Dump" && (
              <div className="capture-page page-enter">
                <div className="capture-hero">
                  <span className="eyebrow">
                    <span className="tiny-star">✧</span> LESS OVERWHELM. A
                    LITTLE MORE CLEAR.
                  </span>
                  <h1 tabIndex={-1} ref={heading}>
                    A lot on your mind<span className="lavender-text">?</span>
                  </h1>
                  <p>Drop it all here. We’ll find the first thread together.</p>
                  <svg
                    className="hero-thread left-thread"
                    viewBox="0 0 200 180"
                    aria-hidden="true"
                  >
                    <path d="M-20 138C88 187 158 59 86 49S40 138 124 109 204 38 226 2" />
                    <circle cx="138" cy="101" r="4" />
                  </svg>
                  <svg
                    className="hero-thread right-thread"
                    viewBox="0 0 200 180"
                    aria-hidden="true"
                  >
                    <path d="M-10 127C80 126 16 42 91 48s-4 99 65 69 17-80 70-95" />
                    <path d="m146 20 0 15m-7-7h14" />
                  </svg>
                </div>
                {voice ? (
                  <Suspense
                    fallback={
                      <p className="center">
                        Preparing your microphone controls…
                      </p>
                    }
                  >
                    <VoicePanel
                      onClose={() => setVoice(false)}
                      onConfirm={(text) => {
                        commit(
                          (w) => ({
                            ...w,
                            draft: w.draft + (w.draft ? "\n" : "") + text,
                          }),
                          "Your transcript joined your thoughts.",
                        );
                        setVoice(false);
                      }}
                    />
                  </Suspense>
                ) : (
                  <section
                    className="thought-card"
                    aria-label="Brain dump studio"
                  >
                    <div className="thought-top">
                      <span>
                        <span className="small-orbit" /> YOUR MIND, UNFILTERED
                      </span>
                      <span className="draft-label">
                        {workspace.draft
                          ? "Draft saved locally"
                          : "No need to make it make sense yet."}
                      </span>
                    </div>
                    <textarea
                      maxLength={100000}
                      id="brain-dump"
                      aria-label="Your thoughts"
                      placeholder={
                        "The presentation. That email I keep putting off.\nA big idea. The tiny thing I don’t want to forget…"
                      }
                      value={workspace.draft}
                      onChange={(e) =>
                        commit((w) => ({ ...w, draft: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          untangle();
                        }
                      }}
                    />
                    <div className="thought-bottom">
                      <button
                        className="speak-button"
                        onClick={() => setVoice(true)}
                      >
                        <Mic size={17} />
                        <span>Speak instead</span>
                        <span className="english-tag">EN</span>
                      </button>
                      <div className="editor-meta">
                        {workspace.draft && (
                          <button
                            className="text-button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Clear this draft? Your existing tasks will remain.",
                                )
                              )
                                commit((w) => ({ ...w, draft: "" }));
                            }}
                          >
                            Clear
                          </button>
                        )}
                        <span>{workspace.draft.length} characters</span>
                        <kbd>⌘ ↵</kbd>
                      </div>
                    </div>
                  </section>
                )}
                <div className="capture-actions">
                  <button
                    className="button primary untangle-button"
                    onClick={untangle}
                    disabled={!workspace.draft.trim() || voice}
                  >
                    <Sparkles size={17} /> Untangle my thoughts{" "}
                    <ArrowRight size={17} />
                  </button>
                  <p>
                    Or borrow a little chaos.{" "}
                    <button
                      className="text-button example-button"
                      onClick={loadExample}
                    >
                      Try an example <ArrowUp />
                    </button>
                  </p>
                </div>
                <MagicCapture
                  text={workspace.draft}
                  onProposal={receiveMagic}
                  onLocal={untangle}
                  disabled={voice}
                />
                <div className="assurance">
                  <span>
                    <ShieldCheck size={15} /> Yours alone, saved on this device
                  </span>
                  <i /> <span>No accounts. No pressure.</span>
                </div>
                <div className="capture-bottom">
                  <div className="pip-note">
                    {mascot && <Pip />}
                    <span>
                      One thought at a time.
                      <br />
                      That’s a lovely place to start.
                    </span>
                  </div>
                  <div className="how-it-works">
                    <span className="eyebrow">
                      FROM A TANGLE TO A FIRST STEP
                    </span>
                    <div>
                      <span>
                        <b>01</b> Let it out
                      </span>
                      <ChevronRight size={13} />
                      <span>
                        <b>02</b> Find the threads
                      </span>
                      <ChevronRight size={13} />
                      <span>
                        <b>03</b> Take one step
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {page === "Review" && (
              <div className="workspace-page page-enter">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">
                      A LITTLE ORDER, ON YOUR TERMS
                    </span>
                    <h1 tabIndex={-1} ref={heading}>
                      Meet your threads<span className="lavender-text">.</span>
                    </h1>
                    <p>
                      These are candidates, not conclusions. Change anything.
                    </p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => {
                      setSelected(undefined);
                      setPage("Map");
                    }}
                  >
                    See my thread map <ArrowRight size={16} />
                  </button>
                </div>
                <p className="review-overview">
                  {tasks.length} tasks found · {workspace.suggestions.length}{" "}
                  connections suggested · {workspace.questions.length}{" "}
                  {workspace.questions.length === 1 ? "question" : "questions"}
                </p>
                {workspace.demo && (
                  <p className="demo-label">
                    Labeled example · {workspace.name} · preset proposals, no
                    live AI call
                  </p>
                )}
                <div className="review-layout">
                  <section aria-label="Your threads">
                    <span className="eyebrow">01 · YOUR THREADS</span>
                    <div className="section-toolbar">
                      <h2>{tasks.length} little things to untangle</h2>
                      <button className="button secondary" onClick={addTask}>
                        <Plus size={15} /> Add task
                      </button>
                    </div>
                    {!tasks.length && (
                      <div className="empty-card">
                        <Leaf size={30} />
                        <h2>No tasks just yet.</h2>
                        <p>
                          Unclear thoughts stay as notes below. You can turn any
                          of them into a task.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => setPage("Dump")}
                        >
                          Back to your thoughts <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                    <div className="review-grid">
                      {tasks.map((task, i) => (
                        <article
                          key={task.id}
                          className={`review-card pastel-${i % 4}`}
                        >
                          <div className="spread">
                            <span className="eyebrow">
                              THREAD {String(i + 1).padStart(2, "0")}
                            </span>
                            <button
                              className="icon-button"
                              aria-label={`Delete ${task.title}`}
                              onClick={() => deleteTask(task.id)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                          <label className="sr-only" htmlFor={task.id}>
                            Task title
                          </label>
                          <input
                            id={task.id}
                            maxLength={500}
                            className="task-title-input"
                            value={task.title}
                            onChange={(e) =>
                              e.target.value.trim() &&
                              updateTask({ ...task, title: e.target.value })
                            }
                          />
                          <div className="review-card-bottom">
                            <span>
                              <Clock size={13} />{" "}
                              {effortLabel(task.estimatedMinutes)}
                            </span>
                            <button
                              className="text-button"
                              onClick={() => setSelected(task.id)}
                            >
                              Edit details <ArrowRight size={14} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <ReviewConnections
                      tasks={tasks}
                      suggestions={workspace.suggestions}
                      onConfirm={confirmSuggestions}
                      onReject={rejectSuggestions}
                    />
                    <details
                      className="bigger-hopes"
                      aria-label="Bigger hopes and questions"
                    >
                      <summary>
                        Bigger hopes &amp; questions{" "}
                        <span>
                          ({workspace.goals.length} hopes ·{" "}
                          {workspace.questions.length}{" "}
                          {workspace.questions.length === 1
                            ? "question"
                            : "questions"}
                          )
                        </span>
                      </summary>
                      <button className="button secondary" onClick={addGoal}>
                        <Plus size={15} /> Add goal
                      </button>
                      {workspace.aiSummary && (
                        <section className="magic-summary">
                          <span className="eyebrow">
                            {workspace.demo
                              ? "EXAMPLE PROPOSAL · YOUR DECISIONS"
                              : "MAGIC’S PROPOSAL · YOUR DECISIONS"}
                          </span>
                          <p>{workspace.aiSummary}</p>
                          <p className="small">
                            All connections need your confirmation. Goals are
                            outcomes, not immediately actionable tasks.
                          </p>
                        </section>
                      )}
                      {workspace.goals.length > 0 && (
                        <section className="magic-goals">
                          <h2>Bigger hopes</h2>
                          {workspace.goals.map((goal) => (
                            <div className="goal-item" key={goal.id}>
                              <label className="field">
                                Desired outcome
                                <input
                                  aria-label="Edit goal"
                                  maxLength={300}
                                  value={goal.title}
                                  onChange={(e) =>
                                    e.target.value.trim() &&
                                    commit((w) => ({
                                      ...w,
                                      goals: w.goals.map((g) =>
                                        g.id === goal.id
                                          ? { ...g, title: e.target.value }
                                          : g,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              {goal.notes && (
                                <p className="small">{goal.notes}</p>
                              )}
                              <p className="small muted">
                                Related:{" "}
                                {goal.taskIds
                                  .map(
                                    (id) =>
                                      tasks.find((t) => t.id === id)?.title,
                                  )
                                  .filter(Boolean)
                                  .join(" · ") || "No task links yet"}
                              </p>
                              <button
                                className="text-button"
                                onClick={() =>
                                  commit((w) => ({
                                    ...w,
                                    goals: w.goals.filter(
                                      (g) => g.id !== goal.id,
                                    ),
                                  }))
                                }
                              >
                                Dismiss goal
                              </button>
                            </div>
                          ))}
                        </section>
                      )}
                      {workspace.questions.length > 0 && (
                        <section className="magic-questions">
                          <h2>A few things to confirm</h2>
                          {workspace.questions.map((question, i) => (
                            <div className="note-item" key={question}>
                              <p>{question}</p>
                              <button
                                className="text-button"
                                onClick={() =>
                                  commit((w) => ({
                                    ...w,
                                    notes: [...w.notes, question],
                                    questions: w.questions.filter(
                                      (_, j) => j !== i,
                                    ),
                                  }))
                                }
                              >
                                Keep as a note
                              </button>
                              <button
                                className="icon-button"
                                aria-label="Dismiss question"
                                onClick={() =>
                                  commit((w) => ({
                                    ...w,
                                    questions: w.questions.filter(
                                      (_, j) => j !== i,
                                    ),
                                  }))
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </section>
                      )}
                    </details>
                    {workspace.notes.length > 0 && (
                      <section className="notes-section">
                        <h2>Thoughts that need a human touch</h2>
                        <p>
                          We kept these as notes. Simple patterns don’t
                          understand everything.
                        </p>
                        {workspace.notes.map((note, i) => (
                          <div key={i} className="note-item">
                            <p>{note}</p>
                            <button
                              className="text-button"
                              onClick={() =>
                                commit(
                                  (w) => ({
                                    ...w,
                                    tasks: [...w.tasks, makeTask(note)],
                                    notes: w.notes.filter((_, j) => j !== i),
                                  }),
                                  "Note turned into a task.",
                                )
                              }
                            >
                              Make a task <Plus size={14} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Delete note"
                              onClick={() =>
                                commit((w) => ({
                                  ...w,
                                  notes: w.notes.filter((_, j) => j !== i),
                                }))
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </section>
                    )}
                  </section>
                  <div>
                    {currentTask ? (
                      <>
                        <TaskEditor
                          task={currentTask}
                          tasks={tasks}
                          edges={edges}
                          onChange={updateTask}
                          onDelete={() => deleteTask(currentTask.id)}
                          onConnect={addEdge}
                          onRemove={removeEdge}
                          onComplete={() => complete(currentTask)}
                          onScenario={(mode) => {
                            setScenario({ id: currentTask.id, mode });
                            setPage("Map");
                          }}
                          onClose={() => setSelected(undefined)}
                        />
                        <div className="merge-box">
                          <label className="field">
                            Merge this task into
                            <select
                              value={mergeTarget}
                              onChange={(e) => setMergeTarget(e.target.value)}
                            >
                              <option value="">Choose another task…</option>
                              {tasks
                                .filter((t) => t.id !== currentTask.id)
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.title}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <button
                            className="button secondary"
                            disabled={!mergeTarget}
                            onClick={merge}
                          >
                            Merge tasks
                          </button>
                          <button
                            className="text-button"
                            onClick={() => {
                              commit((w) => ({
                                ...w,
                                notes: [...w.notes, currentTask.title],
                              }));
                              deleteTask(currentTask.id);
                            }}
                          >
                            Keep as a note instead
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="review-tip">
                        {mascot && <Pip />}
                        <h3>You know your life best.</h3>
                        <p>
                          Give these threads a quick look. Add what’s missing,
                          adjust the little details, and leave out what doesn’t
                          belong.
                        </p>
                        <span className="small">
                          No connections are guessed as facts.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {page === "Map" && (
              <div className="workspace-page map-page page-enter">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">
                      {workspace.demo ? "EXAMPLE PROJECT · " : ""}YOUR THOUGHTS,
                      FINDING THEIR SHAPE
                    </span>
                    <h1 tabIndex={-1} ref={heading}>
                      Everything is connected
                      <span className="lavender-text">.</span>
                    </h1>
                    <p>
                      {workspace.name}{" "}
                      <span className="heading-divider">/</span> {tasks.length}{" "}
                      threads · {ranked.length} ready to begin
                    </p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => setPage("Focus")}
                  >
                    Find my first thread <ArrowRight size={16} />
                  </button>
                </div>
                {!tasks.length ? (
                  <div className="empty-state">
                    {mascot && <Pip />}
                    <h2>Your constellation starts with a thought.</h2>
                    <p>
                      Capture what’s on your mind, or explore a ready-made
                      example.
                    </p>
                    <div className="button-row">
                      <button
                        className="button primary"
                        onClick={() => setPage("Dump")}
                      >
                        Capture a thought
                      </button>
                      <button
                        className="button secondary"
                        onClick={loadExample}
                      >
                        Load example
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="map-toolbar">
                      <div className="map-legend">
                        <span>
                          <i className="legend-dot gold" /> First thread
                        </span>
                        <span>
                          <i className="legend-dot sage" /> Ready
                        </span>
                        <span>
                          <i className="legend-dot muted-dot" /> Blocked /
                          waiting
                        </span>
                        <span>
                          <Check size={12} /> Complete
                        </span>
                      </div>
                      <div className="button-row">
                        <button className="text-button" onClick={addTask}>
                          <Plus size={15} /> Add task
                        </button>
                        <button
                          className={`view-toggle ${listView ? "selected" : ""}`}
                          onClick={() => setListView(!listView)}
                          aria-label={
                            listView
                              ? "Show graph view"
                              : "Show accessible list view"
                          }
                        >
                          {listView ? (
                            <Network size={16} />
                          ) : (
                            <List size={16} />
                          )}
                          <span>{listView ? "Map" : "List"}</span>
                        </button>
                      </div>
                    </div>
                    {scenario && preview && (
                      <section
                        className="scenario-panel"
                        aria-label="What if preview"
                      >
                        <div className="spread">
                          <span className="eyebrow">
                            <Sparkles size={14} /> WHAT IF? · PREVIEW ONLY
                          </span>
                          <button
                            className="icon-button"
                            aria-label="Exit simulation"
                            onClick={() => setScenario(undefined)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <h2>
                          {scenario.mode === "finish" ? "Finish" : "Delay"} “
                          {tasks.find((t) => t.id === scenario.id)?.title}”
                        </h2>
                        <p>
                          {scenario.mode === "finish"
                            ? `${preview.newlyAvailable.length} task(s) would become ready: ${preview.newlyAvailable.map((t) => t.title).join(", ") || "none yet; other prerequisites still need attention"}.`
                            : `${preview.affected.length} unfinished downstream task(s) are affected. ${preview.atRisk.length} have deadlines within a week; this is a dependency warning, not a schedule prediction.`}
                        </p>
                        <p className="small">
                          {preview.blocked.length} unfinished tasks would remain
                          unavailable. Next recommendation:{" "}
                          <strong>
                            {preview.next?.title ??
                              "No immediately available task"}
                          </strong>
                          .
                        </p>
                        {scenario.mode === "delay" &&
                          preview.affected.length > 0 && (
                            <p className="small">
                              Affected:{" "}
                              {preview.affected.map((t) => t.title).join(" · ")}
                            </p>
                          )}
                        <div className="button-row">
                          <button
                            className="button secondary"
                            onClick={() => setScenario(undefined)}
                          >
                            Exit preview
                          </button>
                          <button
                            className="button primary"
                            onClick={() => {
                              const task = tasks.find(
                                (t) => t.id === scenario.id,
                              )!;
                              if (
                                window.confirm(
                                  scenario.mode === "finish"
                                    ? `Mark “${task.title}” complete in your real workspace?`
                                    : `Mark “${task.title}” as waiting in your real workspace?`,
                                )
                              ) {
                                if (
                                  scenario.mode === "finish" &&
                                  task.status !== "done"
                                )
                                  complete(task);
                                if (scenario.mode === "delay") {
                                  setUndo(workspace);
                                  commit(
                                    (w) => ({
                                      ...w,
                                      tasks: w.tasks.map((t) =>
                                        t.id === task.id
                                          ? { ...t, waiting: true }
                                          : t,
                                      ),
                                    }),
                                    "Task marked as waiting.",
                                  );
                                }
                                setScenario(undefined);
                              }
                            }}
                          >
                            Apply to workspace
                          </button>
                        </div>
                      </section>
                    )}
                    <div
                      className={`map-layout ${currentTask ? "has-inspector" : ""}`}
                    >
                      <section className="map-canvas">
                        <div className="canvas-caption">
                          <span className="eyebrow">THE THREAD MAP</span>
                          <span>
                            Prerequisite <ArrowRight size={12} /> next task
                          </span>
                        </div>
                        <div
                          className={
                            listView
                              ? "graph-container hidden-mobile-graph"
                              : "graph-container desktop-graph"
                          }
                          style={listView ? { display: "none" } : undefined}
                        >
                          <Suspense
                            fallback={
                              <p className="center">Drawing your threads…</p>
                            }
                          >
                            <ThreadMap
                              tasks={preview?.tasks ?? tasks}
                              edges={edges}
                              suggestions={workspace.suggestions}
                              recommended={
                                preview ? preview.next?.id : next?.id
                              }
                              selected={selected}
                              onSelect={setSelected}
                              onConnect={addEdge}
                              onRemoveEdge={removeEdge}
                            />
                          </Suspense>
                        </div>
                        <div
                          className={
                            listView
                              ? "task-list"
                              : "task-list mobile-task-list"
                          }
                        >
                          <label className="filter-label">
                            Show
                            <select
                              aria-label="Filter tasks"
                              value={filter}
                              onChange={(e) => setFilter(e.target.value)}
                            >
                              <option value="all">All threads</option>
                              <option>Ready</option>
                              <option>Blocked</option>
                              <option>Waiting</option>
                              <option>Complete</option>
                              <option>Scheduled</option>
                            </select>
                          </label>
                          {(preview?.tasks ?? tasks)
                            .filter(
                              (t) =>
                                filter === "all" ||
                                stateOf(t, preview?.tasks ?? tasks, edges) ===
                                  filter,
                            )
                            .map((t) => (
                              <button
                                key={t.id}
                                className="task-list-row"
                                onClick={() => setSelected(t.id)}
                              >
                                <span
                                  className={`pill ${stateOf(t, preview?.tasks ?? tasks, edges).toLowerCase()}`}
                                >
                                  {stateOf(t, preview?.tasks ?? tasks, edges)}
                                </span>
                                <span>
                                  <strong>{t.title}</strong>
                                  <small>
                                    {edges
                                      .filter((e) => e.target === t.id)
                                      .map(
                                        (e) =>
                                          tasks.find((x) => x.id === e.source)
                                            ?.title,
                                      )
                                      .join(" + ") || "No prerequisites"}{" "}
                                    · {effortLabel(t.estimatedMinutes)}
                                  </small>
                                </span>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                        </div>
                        <div className="canvas-footer">
                          <span>
                            Drag from a card’s right dot to another’s left dot
                            to connect.
                          </span>
                          <span>
                            Select a thread to explore <ArrowUp />
                          </span>
                        </div>
                      </section>
                      {currentTask && (
                        <TaskEditor
                          task={currentTask}
                          tasks={tasks}
                          edges={edges}
                          onChange={updateTask}
                          onDelete={() => deleteTask(currentTask.id)}
                          onConnect={addEdge}
                          onRemove={removeEdge}
                          onComplete={() => complete(currentTask)}
                          onScenario={(mode) =>
                            setScenario({ id: currentTask.id, mode })
                          }
                          onClose={() => setSelected(undefined)}
                        />
                      )}
                    </div>
                    {next && !scenario && (
                      <button
                        className="next-strip"
                        onClick={() => setPage("Focus")}
                      >
                        <span className="next-icon">
                          <Sparkles size={21} />
                        </span>
                        <span>
                          <small>A GOOD PLACE TO BEGIN</small>
                          <strong>{next.title}</strong>
                          <span>{explain(next, tasks, edges)}</span>
                        </span>
                        <span className="next-cta">
                          Let’s start here <ArrowRight size={18} />
                        </span>
                      </button>
                    )}
                    <div className="progress-line">
                      <span>
                        <Leaf size={14} /> {done} of {tasks.length} knots
                        untangled
                      </span>
                      <div>
                        <i
                          style={{ width: `${(done / tasks.length) * 100}%` }}
                        />
                      </div>
                      <span>No rush. One thread at a time.</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {page === "Focus" && (
              <div className="focus-page page-enter">
                <button className="text-button" onClick={() => setPage("Map")}>
                  <ArrowLeft size={15} /> Back to the thread map
                </button>
                <span className="eyebrow">
                  YOU DON’T HAVE TO DO IT ALL RIGHT NOW
                </span>
                <h1 tabIndex={-1} ref={heading}>
                  Just this one little thing
                  <span className="lavender-text">.</span>
                </h1>
                <label className="field time-budget">
                  Available minutes (optional)
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={availableMinutes ?? ""}
                    placeholder="No time filter"
                    onChange={(e) =>
                      setAvailableMinutes(
                        e.target.value === ""
                          ? null
                          : Math.max(
                              1,
                              Math.min(1440, Number(e.target.value) || 1),
                            ),
                      )
                    }
                  />
                  <span>
                    Known estimates above this are hidden. Unknown durations
                    remain; we cannot promise they fit.
                  </span>
                </label>
                {next ? (
                  <section className="focus-card">
                    <div className="spread">
                      <span className="pill first-thread">
                        <Sparkles size={12} /> YOUR FIRST THREAD
                      </span>
                      <span className="small muted">
                        {done} of {tasks.length} complete
                      </span>
                    </div>
                    <h2>{next.title}</h2>
                    <p>{explain(next, tasks, edges)}</p>
                    <div className="focus-details">
                      <span>
                        <Clock size={16} /> {effortLabel(next.estimatedMinutes)}
                      </span>
                      {next.due && <span>Due {next.due}</span>}
                    </div>
                    {next.notes && <p className="focus-notes">{next.notes}</p>}
                    <div className="focus-actions">
                      {next.status === "active" ? (
                        <span className="active-focus">
                          <span className="status-dot" /> You’ve started. A
                          little room to concentrate.
                        </span>
                      ) : (
                        <button
                          className="button secondary"
                          onClick={() =>
                            commit(
                              (w) => ({
                                ...w,
                                tasks: w.tasks.map((t) =>
                                  t.id === next.id
                                    ? { ...t, status: "active" }
                                    : t,
                                ),
                              }),
                              "A little space to begin.",
                            )
                          }
                        >
                          <Play size={16} /> Start this task
                        </button>
                      )}
                      <button
                        className="button primary"
                        onClick={() => complete(next)}
                      >
                        <Check size={17} /> Mark complete
                      </button>
                    </div>
                    <button
                      className="text-button skip"
                      onClick={() => {
                        setSkipped((s) => [...s, next.id]);
                        setNotice(
                          ranked.length > 1
                            ? "A different thread, just for now."
                            : "This is the only ready task. You can return to the map to review blockers.",
                        );
                      }}
                    >
                      Skip for now <ArrowRight size={14} />
                    </button>
                    {mascot && <Pip className="focus-pip" />}
                  </section>
                ) : (
                  <section className="focus-card empty-focus">
                    {mascot && <Pip />}
                    <h2>
                      {!tasks.length
                        ? "A first thread is waiting to be found."
                        : done === tasks.length
                          ? "A little less tangled."
                          : "Some threads need a little time."}
                    </h2>
                    <p>
                      {!tasks.length
                        ? "Start by putting a few thoughts into your space."
                        : done === tasks.length
                          ? "Every task in this space is complete. Take a breath."
                          : availableMinutes !== null &&
                              tasks.some((t) => available(t, tasks, edges))
                            ? "The ready work has estimates above your time budget. Clear the filter or change the available minutes."
                            : "Everything remaining is blocked, scheduled for later or waiting. Review prerequisites or confirm an external event to make work ready."}
                    </p>
                    <button
                      className="button primary"
                      onClick={() => setPage(tasks.length ? "Map" : "Dump")}
                    >
                      {tasks.length ? "Review the map" : "Capture my thoughts"}
                      <ArrowRight size={16} />
                    </button>
                  </section>
                )}
                <p className="focus-quote">
                  “You don’t need to solve everything.
                  <br />
                  Just find the first thread.”
                </p>
                <details className="ranking-details">
                  <summary>How was this chosen?</summary>
                  <p>
                    Only unfinished tasks with all prerequisites complete and no
                    waiting condition are eligible. Deadline urgency contributes
                    0–50 points, priority 0–20, unfinished descendants 0–24, and
                    lower effort 0–15 (unknown effort gets a neutral 7.5).
                    Future scheduled tasks and external events are excluded.
                    Ties use creation time, then task ID. Connections count only
                    after confirmation.
                  </p>
                </details>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <span>EVERY TANGLED THOUGHT HAS A FIRST THREAD.</span>
        <span>
          <ShieldCheck size={12} />
          {storageStatus}
        </span>
        <button className="text-button" onClick={() => setSettings(true)}>
          Made for a quieter mind <span>✧</span>
        </button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          {undo && (
            <button
              onClick={() => {
                setWorkspace(undo);
                setUndo(undefined);
                setSelected(undefined);
                setScenario(undefined);
                setNotice("Change undone.");
              }}
            >
              <RotateCcw size={14} /> Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {error && !settings && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="settings-dialog"
        onCancel={() => setSettings(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSettings(false);
        }}
      >
        <div className="spread">
          <span className="eyebrow">YOUR LITTLE SPACE</span>
          <button
            className="icon-button"
            aria-label="Close settings"
            onClick={() => setSettings(false)}
          >
            <X size={18} />
          </button>
        </div>
        <h2>Comfort &amp; care</h2>
        {error && (
          <div className="inline-error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        <p>
          Your saved tasks live in this browser’s IndexedDB. Magic Untangle
          sends only explicitly submitted text to Groq. The local parser and
          voice transcription stay on this device. There are no accounts or
          analytics. Export a copy before clearing browser data.
        </p>
        <label className="field">
          Workspace name
          <input
            maxLength={200}
            value={workspace.name}
            onChange={(e) => commit((w) => ({ ...w, name: e.target.value }))}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={mascot}
            onChange={(e) => setMascot(e.target.checked)}
          />
          <Leaf size={16} /> Keep Pip company
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={contrast}
            onChange={(e) => setContrast(e.target.checked)}
          />
          <Sun size={16} /> Higher contrast
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={motion}
            onChange={(e) => setMotion(e.target.checked)}
          />
          <VolumeX size={16} /> Reduce motion
        </label>
        <h3>A copy of your threads</h3>
        <div className="button-row">
          <button className="button secondary" onClick={exportData}>
            <Download size={15} /> Export JSON
          </button>
          <button
            className="button secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} /> Import JSON
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="Import workspace JSON"
          onChange={(e) => void importData(e.target.files?.[0])}
        />
        <h3>
          <BookOpen size={16} /> A little inspiration
        </h3>
        <button
          className="button secondary"
          onClick={() => {
            loadExample();
            setSettings(false);
          }}
        >
          Load “The Presentation Panic”
        </button>
        <button
          className="text-button"
          onClick={() => {
            if (
              !workspace.draft ||
              window.confirm(
                "Replace the draft with example text? Existing tasks stay.",
              )
            ) {
              commit((w) => ({ ...w, draft: exampleDump }));
              setPage("Dump");
              setSettings(false);
            }
          }}
        >
          Put example text in the editor
        </button>
        <details>
          <summary>Explore reasoning examples</summary>
          <div className="stack scenario-examples">
            <button
              className="button secondary"
              onClick={() => loadScenario("science")}
            >
              Science Fair
            </button>
            <button
              className="button secondary"
              onClick={() => loadScenario("cat")}
            >
              Cat Nobel Prize
            </button>
            <button
              className="button secondary"
              onClick={() => loadScenario("independent")}
            >
              Unrelated Tasks
            </button>
          </div>
        </details>
        <details>
          <summary>Recent activity ({workspace.history.length})</summary>
          <ol className="history-list">
            {workspace.history.slice(0, 20).map((h) => (
              <li key={h.id}>
                <span>{h.text}</span>
                <time>{new Date(h.at).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        </details>
        <button
          className="text-button danger delete-workspace"
          onClick={async () => {
            if (
              !window.confirm(
                "Permanently delete this workspace from this device? Export a backup first if you want to keep it.",
              )
            )
              return;
            try {
              await erase();
              setAutoSaveAllowed(true);
              setWorkspace(emptyWorkspace());
              setUndo(undefined);
              setSelected(undefined);
              setScenario(undefined);
              setSettings(false);
              setPage("Dump");
              setNotice("A fresh little space. Your workspace was deleted.");
            } catch {
              setError(
                "Could not delete local data. Try your browser’s site-data controls.",
              );
            }
          }}
        >
          <Trash2 size={14} /> Delete workspace
        </button>
      </dialog>
    </div>
  );
}
function ArrowUp() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 12 12 3M3 3h9v9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
