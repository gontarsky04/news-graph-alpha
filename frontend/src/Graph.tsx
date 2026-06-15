import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas, type GraphCanvasRef } from "reagraph";
import {
  edgeKey,
  getInitialRevealedEdges,
  getNeighborhoodIds,
  getSelectionActives,
  isPrimaryNode,
} from "./graphTheme";
import {
  formatRelationshipLabel,
  getNodeColor,
  newsGraphTheme,
  reagraphNodeSize,
  TYPE_COLORS,
} from "./reagraphTheme";
import { renderGraphNode } from "./GraphNodeMesh";
import GraphRenderLayers from "./GraphRenderLayers";
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

  const revealEdgesForNode = useCallback(
    (nodeId: string) => {
      setRevealedEdges((prev) => {
        const next = new Set(prev);
        filteredData.relationships.forEach((rel, index) => {
          if (rel.from === nodeId || rel.to === nodeId) {
            next.add(edgeKey(rel.from, rel.to, index));
          }
        });
        return next;
      });
    },
    [filteredData.relationships]
  );

  const actives = useMemo(
    () =>
      selectedId
        ? getSelectionActives(selectedId, filteredData, revealedEdges)
        : undefined,
    [selectedId, filteredData, revealedEdges]
  );

  const activeSet = useMemo(
    () =>
      selectedId
        ? new Set(getNeighborhoodIds(selectedId, filteredData))
        : null,
    [selectedId, filteredData]
  );

  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    filteredData.relationships.forEach((r) => {
      ids.add(r.from);
      ids.add(r.to);
    });
    return ids;
  }, [filteredData.relationships]);

  const nodes = useMemo(
    () =>
      filteredData.nodes
        .filter(
          (node) =>
            connectedNodeIds.has(node.id) &&
            (isPrimaryNode(node.relevancy) ||
              node.id === selectedId ||
              (focusNodeId != null && node.id === focusNodeId))
        )
        .map((node) => ({
          id: node.id,
          label: "",
          fill: getNodeColor(node.type),
          size: reagraphNodeSize(node.relevancy),
          labelVisible: false,
          data: node,
        })),
    [activeSet, connectedNodeIds, filteredData.nodes, focusNodeId, selectedId]
  );

  const visibleNodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  const edges = useMemo(
    () =>
      filteredData.relationships
        .map((rel, index) => {
          const key = edgeKey(rel.from, rel.to, index);
          if (!revealedEdges.has(key)) return null;
          if (!visibleNodeIds.has(rel.from) || !visibleNodeIds.has(rel.to)) {
            return null;
          }

          const isNeighborEdge =
            selectedId != null &&
            (rel.from === selectedId || rel.to === selectedId);

          return {
            id: `e-${index}`,
            source: rel.from,
            target: rel.to,
            interpolation: "curved" as const,
            size: 1,
            ...(isNeighborEdge
              ? { label: formatRelationshipLabel(rel.type) }
              : {}),
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => edge != null),
    [filteredData.relationships, revealedEdges, selectedId, visibleNodeIds]
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
      revealEdgesForNode(node.id);
    },
    [revealEdgesForNode]
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
        layoutType="radialOut2d"
        labelType="all"
        edgeLabelPosition="inline"
        edgeInterpolation="curved"
        edgeArrowPosition="end"
        renderNode={renderGraphNode}
        animated
        draggable
        selections={selectedId ? [selectedId] : []}
        actives={actives}
        onNodeClick={(node) => {
          setSelectedId(node.id);
          onNodeSelect?.(node.id);
          revealEdgesForNode(node.id);
        }}
        onNodeDoubleClick={handleNodeDoubleClick}
        onCanvasClick={() => {
          setSelectedId(null);
          onNodeSelect?.(null);
        }}
      >
        <GraphRenderLayers />
      </GraphCanvas>

      <div className="graph-legend" aria-label="Entity type legend">
        <span className="graph-legend__title">Entity types</span>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="graph-legend__item">
            <span className="graph-legend__swatch" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}
