import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchArticles, fetchGraph } from "../api/client";
import AnalysisLeftSidebar from "../components/analysis/AnalysisLeftSidebar";
import AnalysisRightSidebar from "../components/analysis/AnalysisRightSidebar";
import Navbar from "../components/layout/Navbar";
import Graph from "../Graph";
import { useAnalyses } from "../hooks/useAnalyses";
import {
  ENTITY_TYPES,
  type Article,
  type GraphData,
  type GraphFilters,
} from "../types";
import { filterNodes, parseSearch } from "../utils/search";
import { filterGraphByArticleIds } from "../utils/graphFilter";

const emptyGraph: GraphData = { nodes: [], relationships: [] };

const defaultFilters = (): GraphFilters => ({
  nodeTypes: new Set(ENTITY_TYPES),
  relationshipTypes: new Set<string>(),
});

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const { getAnalysis, createSnapshot } = useAnalyses();
  const analysis = id === "global" ? null : getAnalysis(id ?? "");

  const [graphData, setGraphData] = useState<GraphData>(emptyGraph);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>(defaultFilters);
  const [search, setSearch] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graph, articleList] = await Promise.all([fetchGraph(), fetchArticles()]);
      setGraphData(graph);
      setArticles(articleList);
      const relTypes = [...new Set(graph.relationships.map((r) => r.type))];
      setFilters({
        nodeTypes: new Set(ENTITY_TYPES),
        relationshipTypes: new Set(relTypes),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const analysisArticles = useMemo(() => {
    if (!analysis) return articles.filter((a) => a.status === "DONE");
    return articles.filter((a) => analysis.articleIds.includes(a.id));
  }, [analysis, articles]);

  const displayGraph = useMemo(() => {
    if (!analysis) return graphData;
    return filterGraphByArticleIds(
      graphData,
      analysis.articleIds.filter((articleId) =>
        analysisArticles.some((a) => a.id === articleId && a.status === "DONE")
      )
    );
  }, [analysis, analysisArticles, graphData]);

  useEffect(() => {
    const relTypes = [...new Set(displayGraph.relationships.map((r) => r.type))];
    setFilters({
      nodeTypes: new Set(ENTITY_TYPES),
      relationshipTypes: new Set(relTypes),
    });
  }, [displayGraph, id]);

  const availableRelationshipTypes = useMemo(
    () => [...new Set(displayGraph.relationships.map((r) => r.type))].sort(),
    [displayGraph.relationships]
  );

  const selectedNode = useMemo(
    () => displayGraph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [displayGraph.nodes, selectedNodeId]
  );

  const selectedArticle = useMemo(() => {
    if (!selectedNode || selectedNode.type !== "Article") return null;
    return articles.find((a) => a.id === selectedNode.id) ?? null;
  }, [articles, selectedNode]);

  const selectedConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    const nodeById = new Map(displayGraph.nodes.map((n) => [n.id, n]));
    return displayGraph.relationships
      .filter((r) => r.from === selectedNodeId || r.to === selectedNodeId)
      .map((r) => {
        const otherId = r.from === selectedNodeId ? r.to : r.from;
        const other = nodeById.get(otherId);
        return {
          type: r.type,
          otherName: other?.name ?? otherId,
          otherType: other?.type ?? "Unknown",
          direction: (r.from === selectedNodeId ? "outgoing" : "incoming") as
            | "outgoing"
            | "incoming",
        };
      });
  }, [displayGraph.nodes, displayGraph.relationships, selectedNodeId]);

  const parsedSearch = useMemo(() => parseSearch(search), [search]);

  useEffect(() => {
    if (!parsedSearch.query && !parsedSearch.typeFilter) {
      setFocusNodeId(null);
      return;
    }
    const matches = filterNodes(displayGraph.nodes, parsedSearch);
    if (matches.length > 0) {
      setFocusNodeId(matches[0].id);
    }
  }, [parsedSearch, displayGraph.nodes]);

  const toggleNodeType = (type: string) => {
    setFilters((prev) => {
      const next = new Set(prev.nodeTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...prev, nodeTypes: next };
    });
  };

  const toggleRelType = (type: string) => {
    setFilters((prev) => {
      const next = new Set(prev.relationshipTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...prev, relationshipTypes: next };
    });
  };

  const title =
    id === "global" ? "Global graph" : analysis?.name ?? "Analysis";

  return (
    <div className="app-layout">
      <Navbar
        variant="analysis"
        searchValue={search}
        onSearchChange={setSearch}
        onSaveSnapshot={() => {
          const articleIds = analysisArticles.map((a) => a.id);
          createSnapshot(`Snapshot ${new Date().toLocaleString()}`, articleIds);
          alert("Snapshot saved — visible on dashboard sidebar");
        }}
        onCreateNode={() => alert("Create node — coming soon")}
      />
      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="analysis-title-bar">
        <h1>{title}</h1>
        <span>
          {analysisArticles.length} articles · {displayGraph.nodes.length} nodes
        </span>
      </div>

      <div className="main-content">
        <AnalysisLeftSidebar
          filters={filters}
          availableRelationshipTypes={availableRelationshipTypes}
          onToggleNodeType={toggleNodeType}
          onToggleRelType={toggleRelType}
        />
        <main className="graph-container">
          {loading ? (
            <div className="graph-empty">Loading graph…</div>
          ) : (
            <Graph
              graphData={displayGraph}
              filters={filters}
              focusNodeId={focusNodeId}
              onNodeSelect={setSelectedNodeId}
            />
          )}
        </main>
        <AnalysisRightSidebar
          selectedNode={selectedNode}
          selectedArticle={selectedArticle}
          connections={selectedConnections}
          analysisArticles={analysisArticles}
        />
      </div>
    </div>
  );
}
