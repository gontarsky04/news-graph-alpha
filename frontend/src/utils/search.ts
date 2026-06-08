import type { GraphNode } from "../types";

export interface ParsedSearch {
  typeFilter: string | null;
  query: string;
}

export function parseSearch(input: string): ParsedSearch {
  const trimmed = input.trim();
  const typeMatch = trimmed.match(/^type:(\w+)\s*(.*)$/i);
  if (typeMatch) {
    return {
      typeFilter: typeMatch[1],
      query: typeMatch[2].trim().toLowerCase(),
    };
  }
  return { typeFilter: null, query: trimmed.toLowerCase() };
}

export function filterNodes(nodes: GraphNode[], search: ParsedSearch): GraphNode[] {
  return nodes.filter((node) => {
    if (search.typeFilter && node.type.toLowerCase() !== search.typeFilter.toLowerCase()) {
      return false;
    }
    if (!search.query) return true;
    return (
      node.name.toLowerCase().includes(search.query) ||
      node.id.toLowerCase().includes(search.query)
    );
  });
}
