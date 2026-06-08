import type { GraphData, GraphNode } from "./types";

export const TYPE_COLORS: Record<string, string> = {
  Person: "#ef4444",
  Organization: "#3b82f6",
  Location: "#22c55e",
  Event: "#f59e0b",
  Topic: "#d946ef",
};

export const RELEVANCY_THRESHOLD = 20;

export function getNodeColor(type: string): string {
  return TYPE_COLORS[type] ?? "#94a3b8";
}

export function isPrimaryNode(relevancy: number): boolean {
  return relevancy > RELEVANCY_THRESHOLD;
}

/** Legacy export — kept so stale Vite HMR bundles do not break. */
export function getJumpstartNodeIds(data: GraphData): Set<string> {
  return new Set(
    data.nodes.filter((node) => isPrimaryNode(node.relevancy)).map((node) => node.id)
  );
}

export function nodePixelSize(relevancy: number): number {
  return Math.max(relevancy, 20) * 2;
}

export function buildNodeMap(data: GraphData): Map<string, GraphNode> {
  return new Map(data.nodes.map((node) => [node.id, node]));
}

export function edgeKey(from: string, to: string, index: number): string {
  return `${from}-${to}-${index}`;
}

export function getInitialRevealedEdges(data: GraphData): Set<string> {
  const nodeMap = buildNodeMap(data);
  const revealed = new Set<string>();

  data.relationships.forEach((rel, index) => {
    const source = nodeMap.get(rel.from);
    const target = nodeMap.get(rel.to);
    if (
      source &&
      target &&
      isPrimaryNode(source.relevancy) &&
      isPrimaryNode(target.relevancy)
    ) {
      revealed.add(edgeKey(rel.from, rel.to, index));
    }
  });

  return revealed;
}

export function getNeighborhoodIds(
  nodeId: string,
  data: GraphData
): string[] {
  const ids = new Set<string>([nodeId]);

  data.relationships.forEach((rel) => {
    if (rel.from === nodeId) ids.add(rel.to);
    if (rel.to === nodeId) ids.add(rel.from);
  });

  return [...ids];
}
