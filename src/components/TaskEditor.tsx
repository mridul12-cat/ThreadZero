import { Check, Trash2, X, Plus, Clock, ArrowRight } from "lucide-react";
import { useState } from "react";
import { blockers, descendants, stateOf } from "../graph/engine";
import type { Task, Edge } from "../storage/types";
export default function TaskEditor({
  task,
  tasks,
  edges,
  onChange,
  onDelete,
  onConnect,
  onRemove,
  onComplete,
  onScenario,
  onClose,
}: {
  task: Task;
  tasks: Task[];
  edges: Edge[];
  onChange: (t: Task) => void;
  onDelete: () => void;
  onConnect: (e: Edge) => void;
  onRemove: (e: Edge) => void;
  onComplete: () => void;
  onScenario: (mode: "finish" | "delay") => void;
  onClose: () => void;
}) {
  const [prereq, setPrereq] = useState("");
  const dependencies = edges.filter((e) => e.target === task.id);
  const blocked = blockers(task, tasks, edges);
  return (
    <aside className="inspector">
      <div className="spread">
        <span className="eyebrow">A CLOSER LOOK</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close task details"
        >
          <X size={18} />
        </button>
      </div>
      <label className="field">
        Task title
        <input
          maxLength={500}
          value={task.title}
          onChange={(e) =>
            e.target.value.trim() &&
            onChange({ ...task, title: e.target.value })
          }
        />
      </label>
      <span className={`pill ${stateOf(task, tasks, edges).toLowerCase()}`}>
        {stateOf(task, tasks, edges)}
      </span>
      <div className="two-fields">
        <label className="field">
          Estimated minutes (optional)
          <input
            type="number"
            min="1"
            max="1440"
            value={task.estimatedMinutes ?? ""}
            placeholder="Not estimated"
            onChange={(e) =>
              onChange({
                ...task,
                estimatedMinutes:
                  e.target.value === ""
                    ? null
                    : Math.max(
                        1,
                        Math.min(1440, Math.round(Number(e.target.value)) || 1),
                      ),
                estimateSource: e.target.value === "" ? null : "user",
              })
            }
          />
        </label>
        <label className="field">
          Priority
          <select
            value={task.priority}
            onChange={(e) =>
              onChange({
                ...task,
                priority: e.target.value as Task["priority"],
              })
            }
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className="field">
        Due date
        <input
          type="date"
          value={task.due || ""}
          onChange={(e) =>
            onChange({ ...task, due: e.target.value || undefined })
          }
        />
      </label>
      <label className="field">
        Thread type
        <select
          value={task.kind}
          onChange={(e) =>
            onChange({
              ...task,
              kind: e.target.value as Task["kind"],
              waiting: false,
              eventResolvedAt: null,
              status: "todo",
              completedAt: undefined,
            })
          }
        >
          <option value="ACTION">Action I can take</option>
          <option value="WAITING_EVENT">External event to confirm</option>
        </select>
      </label>
      {task.kind === "WAITING_EVENT" ? (
        <p className="small muted">
          This stays unresolved until you confirm it happened. Completing a
          reminder or request never receives it automatically.
        </p>
      ) : (
        <label className="check-label">
          <input
            type="checkbox"
            checked={task.waiting}
            onChange={(e) => onChange({ ...task, waiting: e.target.checked })}
          />
          <Clock size={15} /> Unavailable for now
        </label>
      )}
      <label className="field">
        Scheduled start (optional)
        <input
          type="date"
          value={task.scheduledStart ?? ""}
          onChange={(e) =>
            onChange({ ...task, scheduledStart: e.target.value || undefined })
          }
        />
      </label>
      <label className="field">
        Notes
        <textarea
          rows={2}
          maxLength={10000}
          value={task.notes}
          onChange={(e) => onChange({ ...task, notes: e.target.value })}
        />
      </label>
      <h3>Needs to happen first</h3>
      {!dependencies.length && (
        <p className="small muted">No prerequisites. A little room to begin.</p>
      )}
      {dependencies.map((e) => (
        <div className="dependency-item" key={e.source}>
          <span>{tasks.find((t) => t.id === e.source)?.title}</span>
          <button
            className="icon-button"
            aria-label={`Remove prerequisite ${tasks.find((t) => t.id === e.source)?.title}`}
            onClick={() => onRemove(e)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="inline-field">
        <select
          aria-label="Choose prerequisite"
          value={prereq}
          onChange={(e) => setPrereq(e.target.value)}
        >
          <option value="">Choose prerequisite…</option>
          {tasks
            .filter(
              (t) =>
                t.id !== task.id &&
                !dependencies.some((e) => e.source === t.id),
            )
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>
        <button
          className="icon-button"
          disabled={!prereq}
          aria-label="Add prerequisite"
          onClick={() => {
            onConnect({ source: prereq, target: task.id });
            setPrereq("");
          }}
        >
          <Plus size={18} />
        </button>
      </div>
      <p className="small muted">
        {blocked.length ? `${blocked.length} unfinished prerequisite(s). ` : ""}
        {descendants(task.id, edges).size} downstream task(s). Arrows mean
        “before”.
      </p>
      <div className="stack">
        <button className="button primary" onClick={onComplete}>
          <Check size={16} />
          {task.status === "done"
            ? task.kind === "WAITING_EVENT"
              ? "Mark unresolved"
              : "Reopen task"
            : task.kind === "WAITING_EVENT"
              ? "Confirm event received"
              : "Mark complete"}
        </button>
        <button
          className="button secondary"
          onClick={() => onScenario("finish")}
        >
          What if I finish this? <ArrowRight size={16} />
        </button>
        <button className="text-button" onClick={() => onScenario("delay")}>
          What if this gets delayed?
        </button>
        <button className="text-button danger" onClick={onDelete}>
          <Trash2 size={14} /> Delete task
        </button>
      </div>
      {task.source && (
        <details>
          <summary>Original thought</summary>
          <p className="small">{task.source}</p>
        </details>
      )}
    </aside>
  );
}
