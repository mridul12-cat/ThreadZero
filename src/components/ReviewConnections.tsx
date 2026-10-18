import { useState } from "react";
import { Check, ArrowRight, X } from "lucide-react";
import type { Edge, Task } from "../storage/types";
export default function ReviewConnections({
  tasks,
  suggestions,
  onConfirm,
  onReject,
}: {
  tasks: Task[];
  suggestions: Edge[];
  onConfirm: (edges: Edge[]) => void;
  onReject: (edges: Edge[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const key = (e: Edge) => `${e.source}:${e.target}`;
  const explicit = suggestions.filter(
    (e) =>
      e.confidence === "explicit" &&
      e.evidence &&
      e.evidenceCategory === "prerequisite",
  );
  return (
    <section
      className="suggestions compact-connections"
      aria-label="Suggested connections"
    >
      <div className="spread">
        <h2>
          Suggested connections{" "}
          <span className="small">({suggestions.length})</span>
        </h2>
        <button
          className="button secondary"
          disabled={!explicit.length}
          onClick={() => onConfirm(explicit)}
        >
          Confirm all explicit ({explicit.length})
        </button>
      </div>
      <p>
        Only confirmed connections affect readiness. Inferred links always need
        individual review.
      </p>
      {!suggestions.length && (
        <p className="small muted">
          No pending connections. Independent threads can stay independent.
        </p>
      )}
      {suggestions.map((e) => (
        <div key={key(e)} className="suggestion compact-suggestion">
          <label className="connection-select">
            <input
              type="checkbox"
              aria-label={`Select connection ${tasks.find((t) => t.id === e.source)?.title} to ${tasks.find((t) => t.id === e.target)?.title}`}
              checked={selected.has(key(e))}
              onChange={(event) =>
                setSelected((old) => {
                  const next = new Set(old);
                  if (event.target.checked) next.add(key(e));
                  else next.delete(key(e));
                  return next;
                })
              }
            />
          </label>
          <div className="connection-content">
            <div className="connection-titles">
              {tasks.find((t) => t.id === e.source)?.title}
              <ArrowRight size={13} />
              {tasks.find((t) => t.id === e.target)?.title}
            </div>
            <span className="pill">
              {e.confidence === "explicit" &&
              e.evidence &&
              e.evidenceCategory === "prerequisite"
                ? "Explicit in your text"
                : "Inferred · please check"}
            </span>
            <details>
              <summary>Source & reasoning</summary>
              <p className="suggestion-explanation">
                {e.explanation ||
                  "A local parsing pattern suggested this relationship; please verify it."}
              </p>
              {e.evidence && <blockquote>{e.evidence}</blockquote>}
              <p className="small">
                {e.evidenceCategory ?? "Unclassified"} ·{" "}
                {e.confirmationStatus ?? "unconfirmed"}
              </p>
            </details>
          </div>
          <button
            className="icon-button"
            aria-label={`Confirm connection ${tasks.find((t) => t.id === e.source)?.title} to ${tasks.find((t) => t.id === e.target)?.title}`}
            onClick={() => onConfirm([e])}
          >
            <Check size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Reject suggested connection"
            onClick={() => onReject([e])}
          >
            <X size={17} />
          </button>
        </div>
      ))}
      {suggestions.length > 0 && (
        <button
          className="text-button danger"
          disabled={!suggestions.some((e) => selected.has(key(e)))}
          onClick={() => {
            onReject(suggestions.filter((e) => selected.has(key(e))));
            setSelected(new Set());
          }}
        >
          Reject selected suggestions
        </button>
      )}
    </section>
  );
}
