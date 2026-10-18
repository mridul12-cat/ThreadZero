import { useMemo, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  type Node,
  type NodeProps,
  type NodeChange,
  type ReactFlowInstance,
  type Edge as FlowEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check, Lock, Clock, ArrowUpRight, Sparkles } from "lucide-react";
import { calendarContext } from "../parser/context";
import { stateOf, pathMembers } from "../graph/engine";
import { constellationLayout } from "../graph/layout";
import type { Task, Edge } from "../storage/types";
type ThreadNode = Node<
  {
    task: Task;
    state: string;
    recommended: boolean;
    highlight: boolean;
    muted: boolean;
  },
  "thread"
>;
type ClusterNode = Node<{ label: string }, "cluster">;
type FlowNode = ThreadNode | ClusterNode;
function TaskNode({ data }: NodeProps<ThreadNode>) {
  const { task, state, recommended, highlight, muted } = data;
  return (
    <div
      className={`thread-node ${state.toLowerCase()} ${recommended ? "recommended" : ""} ${highlight ? "path-highlight" : ""} ${muted ? "path-muted" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-status">
        {recommended ? (
          <Sparkles size={12} />
        ) : state === "Complete" ? (
          <Check size={12} />
        ) : task.kind === "WAITING_EVENT" ? (
          <Clock size={12} />
        ) : state === "Blocked" ? (
          <Lock size={12} />
        ) : (
          <span className="status-dot" />
        )}
        {recommended
          ? "YOUR FIRST THREAD"
          : task.kind === "WAITING_EVENT" && state !== "Complete"
            ? "EXTERNAL EVENT · NOT RECEIVED"
            : state.toUpperCase()}
      </div>
      <strong title={task.title}>{task.title}</strong>
      <div className="node-bottom">
        <span>
          {task.estimatedMinutes === null ? "" : `${task.estimatedMinutes} min`}
          {task.due ? ` · due ${task.due.slice(5)}` : ""}
          {task.scheduledStart
            ? ` · starts ${task.scheduledStart.slice(5)}`
            : ""}
        </span>
        <ArrowUpRight size={14} />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function Cluster({ data }: NodeProps<ClusterNode>) {
  return <div className="cluster-label">{data.label}</div>;
}
const nodeTypes = { thread: TaskNode, cluster: Cluster };
export default function ThreadMap({
  tasks,
  edges,
  suggestions = [],
  recommended,
  selected,
  onSelect,
  onConnect,
  onRemoveEdge,
}: {
  tasks: Task[];
  edges: Edge[];
  suggestions?: Edge[];
  recommended?: string;
  selected?: string;
  onSelect: (id: string) => void;
  onConnect: (edge: Edge) => void;
  onRemoveEdge: (edge: Edge) => void;
}) {
  const today = calendarContext().today;
  const [scope, setScope] = useState("all");
  const flow = useRef<ReactFlowInstance<FlowNode> | null>(null);
  const structure = useRef("");
  const path = useMemo(
    () => (selected ? pathMembers(selected, edges) : new Set<string>()),
    [selected, edges],
  );
  const shown = useMemo(
    () =>
      scope === "path" && selected
        ? tasks.filter((t) => path.has(t.id))
        : tasks,
    [tasks, scope, selected, path],
  );
  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (e) =>
          shown.some((t) => t.id === e.source) &&
          shown.some((t) => t.id === e.target),
      ),
    [shown, edges],
  );
  const pending = useMemo(
    () =>
      suggestions.filter(
        (e) =>
          shown.some((t) => t.id === e.source) &&
          shown.some((t) => t.id === e.target),
      ),
    [shown, suggestions],
  );
  const auto = useMemo(
    () => constellationLayout(shown, visibleEdges, pending),
    [shown, visibleEdges, pending],
  );
  const key =
    shown.map((t) => t.id).join("|") +
    visibleEdges.map((e) => e.source + e.target).join("|") +
    pending.map((e) => e.source + e.target).join("|");
  const initial = useMemo<FlowNode[]>(
    () => [
      ...auto.clusters.map((c) => ({
        id: c.id,
        type: "cluster" as const,
        data: { label: c.label },
        position: { x: c.x, y: c.y },
        style: { width: c.width, height: c.height },
        className: "graph-cluster",
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        zIndex: -1,
      })),
      ...auto.nodes.map((n) => {
        const task = shown.find((t) => t.id === n.id)!;
        return {
          ...n,
          type: "thread" as const,
          data: {
            task,
            state: stateOf(task, tasks, edges, today),
            recommended: n.id === recommended,
            highlight: !!selected && path.has(n.id),
            muted: !!selected && !path.has(n.id),
          },
        };
      }),
    ],
    [auto, shown, tasks, edges, recommended, selected, path, today],
  );
  const [nodes, setNodes] = useState<FlowNode[]>(initial);
  useEffect(() => {
    const changed = structure.current !== key;
    structure.current = key;
    setNodes((old) =>
      initial.map((n) => ({
        ...n,
        position: changed
          ? n.position
          : (old.find((p) => p.id === n.id)?.position ?? n.position),
      })),
    );
  }, [initial, key]);
  function fit(all = false) {
    void flow.current?.fitView({
      padding: 0.12,
      minZoom: all ? 0.01 : 0.75,
      maxZoom: 1,
      duration: 0,
    });
  }
  const renderedEdges: FlowEdge[] = [
    ...pending.map((e) => ({
      id: `suggestion:${e.source}:${e.target}`,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      selectable: false,
      deletable: false,
      focusable: false,
      label:
        e.confidence === "inferred" ? "Possible · review" : "Explicit · review",
      className:
        selected && !(path.has(e.source) && path.has(e.target))
          ? "path-muted"
          : "",
      style: { stroke: "#9a86b1", strokeWidth: 1.8, strokeDasharray: "3 6" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#9a86b1" },
      labelStyle: { fontSize: 10, fill: "#68556f" },
    })),
    ...visibleEdges.map((e) => ({
      id: `${e.source}:${e.target}`,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      className:
        selected && !(path.has(e.source) && path.has(e.target))
          ? "path-muted"
          : "",
      style: {
        stroke: e.source === recommended ? "#c59c47" : "#ab95bf",
        strokeWidth:
          selected && path.has(e.source) && path.has(e.target) ? 3 : 1.8,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#ab95bf" },
    })),
  ];
  return (
    <>
      <div className="graph-tools">
        <button onClick={() => fit()}>Readable view</button>
        <button onClick={() => fit(true)}>Fit entire map</button>
        <button
          onClick={() => {
            setNodes(initial);
            fit();
          }}
        >
          Reset layout
        </button>
        {recommended && (
          <button
            onClick={() =>
              void flow.current?.fitView({
                nodes: [{ id: recommended }],
                padding: 0.5,
                minZoom: 0.9,
                maxZoom: 1,
              })
            }
          >
            First thread
          </button>
        )}
        <select
          aria-label="Map branch"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="all">All branches</option>
          <option value="path" disabled={!selected}>
            Selected path
          </option>
        </select>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={renderedEdges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          flow.current = instance;
        }}
        onNodesChange={(changes: NodeChange<FlowNode>[]) =>
          setNodes((n) => applyNodeChanges(changes, n))
        }
        onNodeClick={(_, node) => {
          if (node.type === "thread") onSelect(node.id);
        }}
        onConnect={(c) => onConnect({ source: c.source, target: c.target })}
        onEdgesDelete={(deleted) =>
          deleted
            .filter((e) => !e.id.startsWith("suggestion:"))
            .forEach((e) =>
              onRemoveEdge({ source: e.source, target: e.target }),
            )
        }
        fitView
        minZoom={0.01}
        maxZoom={1.5}
        fitViewOptions={{ padding: 0.12, minZoom: 0.75, maxZoom: 1 }}
        nodesConnectable
        nodesDraggable
        connectOnClick={false}
        deleteKeyCode={["Backspace", "Delete"]}
        aria-label="Task dependency map. Arrows point from prerequisite to dependent task."
      >
        <Background color="#d9d0df" gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <span className="graph-hint">
        Pan to explore · dotted lines are proposals · zoom out to see every
        branch
      </span>
    </>
  );
}
