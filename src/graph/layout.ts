import dagre from "@dagrejs/dagre";
import type { Task, Edge } from "../storage/types";
import { validateEdge } from "./engine";
export const CARD_WIDTH = 260,
  CARD_HEIGHT = 160;
export interface Cluster {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function constellationLayout(
  tasks: Task[],
  edges: Edge[],
  suggestions: Edge[] = [],
  shelfWidth = 1100,
) {
  const visual = [...edges];
  for (const edge of suggestions)
    if (!validateEdge(edge, tasks, visual)) visual.push(edge);
  const seen = new Set<string>(),
    components: Task[][] = [],
    independent: Task[] = [];
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    const ids = new Set<string>(),
      queue = [task.id];
    while (queue.length) {
      const id = queue.pop()!;
      if (ids.has(id)) continue;
      ids.add(id);
      seen.add(id);
      for (const e of visual) {
        if (e.source === id) queue.push(e.target);
        if (e.target === id) queue.push(e.source);
      }
    }
    const component = tasks.filter((t) => ids.has(t.id));
    if (component.length === 1) independent.push(...component);
    else components.push(component);
  }
  const nodes: { id: string; position: { x: number; y: number } }[] = [],
    clusters: Cluster[] = [];
  let x = 25,
    y = 85,
    rowHeight = 0;
  function place(width: number, height: number) {
    if (x > 25 && x + width > shelfWidth) {
      x = 25;
      y += rowHeight + 38;
      rowHeight = 0;
    }
    const position = { x, y };
    x += width + 34;
    rowHeight = Math.max(rowHeight, height);
    return position;
  }
  components.forEach((component, index) => {
    const ids = new Set(component.map((t) => t.id));
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: "LR",
      ranksep: 85,
      nodesep: 55,
      marginx: 30,
      marginy: 50,
      ranker: "network-simplex",
    });
    component.forEach((t) =>
      graph.setNode(t.id, { width: CARD_WIDTH, height: CARD_HEIGHT }),
    );
    visual
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .forEach((e) => graph.setEdge(e.source, e.target));
    dagre.layout(graph);
    const bounds = graph.graph();
    const width = bounds.width ?? 350,
      height = bounds.height ?? 260;
    const offset = place(width, height);
    clusters.push({
      id: `cluster-${index}`,
      label: `CONNECTED THREADS ${index + 1}`,
      x: offset.x,
      y: offset.y,
      width,
      height,
    });
    for (const t of component) {
      const n = graph.node(t.id);
      nodes.push({
        id: t.id,
        position: {
          x: offset.x + n.x - CARD_WIDTH / 2,
          y: offset.y + n.y - CARD_HEIGHT / 2,
        },
      });
    }
  });
  if (independent.length) {
    const columns = Math.min(
        3,
        Math.max(1, Math.floor((shelfWidth - 60) / (CARD_WIDTH + 35))),
        independent.length,
      ),
      width = columns * (CARD_WIDTH + 35) + 25,
      height =
        Math.ceil(independent.length / columns) * (CARD_HEIGHT + 35) + 45;
    const offset = place(width, height);
    clusters.push({
      id: "cluster-independent",
      label: "INDEPENDENT THREADS",
      x: offset.x,
      y: offset.y,
      width,
      height,
    });
    independent.forEach((t, i) =>
      nodes.push({
        id: t.id,
        position: {
          x: offset.x + 30 + (i % columns) * (CARD_WIDTH + 35),
          y: offset.y + 48 + Math.floor(i / columns) * (CARD_HEIGHT + 35),
        },
      }),
    );
  }
  return { nodes, clusters };
}
