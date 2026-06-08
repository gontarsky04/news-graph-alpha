import type { GraphData } from "../types";

/**
 * Subgraph reachable within `maxDepth` hops from selected Article node ids.
 */
export function filterGraphByArticleIds(
  graph: GraphData,
  articleIds: string[],
  maxDepth = 2
): GraphData {
  if (articleIds.length === 0) {
    return { nodes: [], relationships: [] };
  }

  const includedNodes = new Set<string>(articleIds);
  let frontier = new Set<string>(articleIds);

  for (let depth = 0; depth < maxDepth; depth++) {
    const next = new Set<string>();
    for (const rel of graph.relationships) {
      const touches = frontier.has(rel.from) || frontier.has(rel.to);
      if (!touches) continue;

      for (const id of [rel.from, rel.to]) {
        if (!includedNodes.has(id)) {
          includedNodes.add(id);
          next.add(id);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  const nodes = graph.nodes.filter((n) => includedNodes.has(n.id));
  const relationships = graph.relationships.filter(
    (r) => includedNodes.has(r.from) && includedNodes.has(r.to)
  );

  return { nodes, relationships };
}
