import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas, type GraphCanvasRef } from "reagraph";
import {
  edgeKey,
  getInitialRevealedEdges,
  getNeighborhoodIds,
  isPrimaryNode,
} from "./graphTheme";
import {
  formatNodeLabel,
  getNodeColor,
  getNodeSubLabel,
  newsGraphTheme,
  reagraphNodeSize,
  TYPE_COLORS,
} from "./reagraphTheme";
import type { GraphData, GraphFilters } from "./types";

interface GraphProps {
  graphData: GraphData;
  filters: GraphFilters;
  focusNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
}

export default function Graph({
  graphData,
  filters,
  focusNodeId,
  onNodeSelect,
}: GraphProps) {
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const [revealedEdges, setRevealedEdges] = useState(() =>
    getInitialRevealedEdges(graphData)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    const nodes = graphData.nodes.filter((n) => filters.nodeTypes.has(n.type));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const relTypes = filters.relationshipTypes;
    const relationships = graphData.relationships.filter(
      (r) =>
        nodeIds.has(r.from) &&
        nodeIds.has(r.to) &&
        (relTypes.size === 0 || relTypes.has(r.type))
    );
    return { nodes, relationships };
  }, [graphData, filters]);

  useEffect(() => {
    setRevealedEdges(getInitialRevealedEdges(filteredData));
    setSelectedId(null);
  }, [filteredData]);

  useEffect(() => {
    if (!focusNodeId) return;

    setSelectedId(focusNodeId);
    onNodeSelect?.(focusNodeId);
    setRevealedEdges((prev) => {
      const next = new Set(prev);
      filteredData.relationships.forEach((rel, index) => {
        if (rel.from === focusNodeId || rel.to === focusNodeId) {
          next.add(edgeKey(rel.from, rel.to, index));
        }
      });
      return next;
    });
  }, [focusNodeId, filteredData.relationships, onNodeSelect]);

  const actives = useMemo(
    () =>
      selectedId ? getNeighborhoodIds(selectedId, filteredData) : undefined,
    [selectedId, filteredData]
  );

  const activeSet = useMemo(
    () =>
      selectedId
        ? new Set(getNeighborhoodIds(selectedId, filteredData))
        : null,
    [selectedId, filteredData]
  );

  const nodes = useMemo(
    () =>
      filteredData.nodes
        .filter(
          (node) =>
            isPrimaryNode(node.relevancy) ||
            node.id === selectedId ||
            (focusNodeId != null && node.id === focusNodeId)
        )
        .map((node) => {
          const isFocused = !activeSet || activeSet.has(node.id);
          const isSelected = selectedId === node.id;

          return {
            id: node.id,
            label: formatNodeLabel(node.name),
            subLabel: isSelected ? getNodeSubLabel(node.type) : undefined,
            fill: getNodeColor(node.type),
            size: reagraphNodeSize(node.relevancy),
            labelVisible: isFocused,
            data: node,
          };
        }),
    [activeSet, filteredData.nodes, focusNodeId, selectedId]
  );

  const visibleNodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  const edges = useMemo(
    () =>
      filteredData.relationships
        .map((rel, index) => ({
          id: `e-${index}`,
          source: rel.from,
          target: rel.to,
          label: rel.type,
          interpolation: "curved" as const,
          size: 1,
          key: edgeKey(rel.from, rel.to, index),
        }))
        .filter(
          (edge) =>
            revealedEdges.has(edge.key) &&
            visibleNodeIds.has(edge.source) &&
            visibleNodeIds.has(edge.target)
        )
        .map(({ key: _key, ...edge }) => edge),
    [filteredData.relationships, revealedEdges, visibleNodeIds]
  );

  // Reagraph lays out asynchronously; one delayed fit avoids an empty camera box.
  useEffect(() => {
    if (nodes.length === 0) return;

    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      graphRef.current?.centerGraph(undefined, { animated: false });
      graphRef.current?.fitNodesInView(undefined, { animated: false });
    };

    const timer = window.setTimeout(fit, 2200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [nodes.length, edges.length]);

  const handleNodeDoubleClick = useCallback(
    (node: { id: string }) => {
      setRevealedEdges((prev) => {
        const next = new Set(prev);
        filteredData.relationships.forEach((rel, index) => {
          if (rel.from === node.id || rel.to === node.id) {
            next.add(edgeKey(rel.from, rel.to, index));
          }
        });
        return next;
      });
    },
    [filteredData.relationships]
  );

  if (filteredData.nodes.length === 0) {
    return (
      <div className="graph-empty">
        <p>No nodes match current filters.</p>
        <p className="graph-empty__hint">Adjust filters or upload articles from the dashboard.</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="graph-empty">
        <p>No high-relevancy entities to display.</p>
        <p className="graph-empty__hint">
          Use search or double-click after loading more articles.
        </p>
      </div>
    );
  }

  return (
    <div className="graph-canvas">
      <GraphCanvas
        ref={graphRef}
        nodes={nodes}
        edges={edges}
        theme={newsGraphTheme}
        layoutType="forceatlas2"
        labelType="auto"
        edgeLabelPosition="natural"
        edgeInterpolation="curved"
        edgeArrowPosition="end"
        animated
        draggable
        selections={selectedId ? [selectedId] : []}
        actives={actives}
        onNodeClick={(node) => {
          setSelectedId(node.id);
          onNodeSelect?.(node.id);
        }}
        onNodeDoubleClick={handleNodeDoubleClick}
        onCanvasClick={() => {
          setSelectedId(null);
          onNodeSelect?.(null);
        }}
      />

      <div className="graph-legend" aria-label="Entity type legend">
        <span className="graph-legend__title">Entity types</span>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="graph-legend__item">
            <span className="graph-legend__swatch" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>

      <div className="graph-hint">
        Click to focus · Double-click to reveal connections
      </div>
    </div>
  );
}
