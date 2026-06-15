import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { fetchArticles, fetchGraph } from "../api/client";
import AnalysisLeftSidebar from "../components/analysis/AnalysisLeftSidebar";
import AnalysisRightSidebar from "../components/analysis/AnalysisRightSidebar";
import AnalysisMeta from "../components/AnalysisMeta";
import SaveSnapshotModal from "../components/dashboard/SaveSnapshotModal";
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
  const analysis = getAnalysis(id ?? "");
  const isValidAnalysis = Boolean(id && id !== "global" && analysis);

  const [graphData, setGraphData] = useState<GraphData>(emptyGraph);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>(defaultFilters);
  const [search, setSearch] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [showSaveSnapshot, setShowSaveSnapshot] = useState(false);

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
    if (!analysis) return [];
    return articles.filter((a) => analysis.articleIds.includes(a.id));
  }, [analysis, articles]);

  const displayGraph = useMemo(() => {
    if (!analysis) return emptyGraph;
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

  const title = analysis?.name ?? "Analysis";

  const parentAnalysisId =
    analysis?.isSnapshot && analysis.parentAnalysisId
      ? analysis.parentAnalysisId
      : analysis?.id;

  const handleSaveSnapshot = (name: string) => {
    if (!analysis || !parentAnalysisId) return;
    const articleIds = analysisArticles.map((a) => a.id);
    createSnapshot(name, articleIds, parentAnalysisId);
    setShowSaveSnapshot(false);
  };

  if (!isValidAnalysis || !analysis) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-layout">
      <Navbar
        variant="analysis"
        readOnly={analysis.isSnapshot}
        searchValue={search}
        onSearchChange={setSearch}
        onSaveSnapshot={() => setShowSaveSnapshot(true)}
        onCreateNode={() => alert("Create node — coming soon")}
      />
      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="analysis-title-bar">
        <h1>{title}</h1>
        <AnalysisMeta
          className="analysis-title-bar__meta"
          articleCount={analysisArticles.length}
          nodeCount={displayGraph.nodes.length}
        />
      </div>

      <div className="main-content">
        <AnalysisLeftSidebar
          filters={filters}
          availableRelationshipTypes={availableRelationshipTypes}
          analysisArticles={analysisArticles}
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
        />
      </div>

      {showSaveSnapshot && !analysis.isSnapshot ? (
        <SaveSnapshotModal
          onClose={() => setShowSaveSnapshot(false)}
          onSave={handleSaveSnapshot}
        />
      ) : null}
    </div>
  );
}
