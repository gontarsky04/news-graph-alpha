export interface GraphNode {
  id: string;
  label: string;
  name: string;
  type: string;
  relevancy: number;
}

export interface GraphRelationship {
  from: string;
  to: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export type ProcessingStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface Article {
  id: string;
  title: string;
  source: string | null;
  author: string | null;
  date: string | null;
  body: string;
  tags: string[];
  status: ProcessingStatus;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  nodesCreated: number;
  relationshipsCreated: number;
}

export interface ArticleUpload {
  title: string;
  source?: string;
  author?: string;
  date?: string;
  body: string;
  tags?: string[];
}

export interface Analysis {
  id: string;
  name: string;
  articleIds: string[];
  createdAt: string;
  isSnapshot?: boolean;
}

export interface GraphFilters {
  nodeTypes: Set<string>;
  relationshipTypes: Set<string>;
}

export const ENTITY_TYPES = [
  "Person",
  "Organization",
  "Location",
  "Event",
  "Topic",
  "Article",
] as const;

export const RELATIONSHIP_TYPES = [
  "MENTIONS",
  "PUBLISHED_BY",
  "LEADS",
  "MEMBER_OF",
  "PARTICIPATED_IN",
  "ORGANIZED",
  "MET_WITH",
  "TOOK_PLACE_IN",
  "RELATED_TO",
] as const;
