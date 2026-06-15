import type { Article, GraphNode } from "../../types";

interface NodeConnection {
  type: string;
  otherName: string;
  otherType: string;
  direction: "outgoing" | "incoming";
}

interface AnalysisRightSidebarProps {
  selectedNode: GraphNode | null;
  selectedArticle: Article | null;
  connections: NodeConnection[];
}

export default function AnalysisRightSidebar({
  selectedNode,
  selectedArticle,
  connections,
}: AnalysisRightSidebarProps) {
  return (
    <aside className="sidebar right-sidebar">
      {selectedNode ? (
        <div className="sidebar-section">
          <h3>INSPECT NODE</h3>
          <p className="node-detail__name">{selectedNode.name}</p>
          <p className="node-detail__type">{selectedNode.type}</p>
          <p className="node-detail__id">{selectedNode.id}</p>
          <p className="node-detail__relevancy">Relevancy: {selectedNode.relevancy}</p>

          {connections.length > 0 ? (
            <div className="connections-list">
              <h4>Relationships ({connections.length})</h4>
              <ul>
                {connections.map((conn, index) => (
                  <li key={`${conn.type}-${conn.otherName}-${index}`}>
                    <span className="connection-type">{conn.type}</span>
                    <span className="connection-arrow">
                      {conn.direction === "outgoing" ? "→" : "←"}
                    </span>
                    <span className="connection-target">
                      {conn.otherName}
                      <span className="connection-target-type"> ({conn.otherType})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedNode.type === "Article" && selectedArticle ? (
            <div className="article-preview">
              <h4>Article content</h4>
              {selectedArticle.source ? (
                <a
                  href={selectedArticle.source}
                  target="_blank"
                  rel="noreferrer"
                  className="article-link"
                >
                  {selectedArticle.title}
                </a>
              ) : (
                <strong>{selectedArticle.title}</strong>
              )}
              <p className="article-meta">
                {selectedArticle.author ? `${selectedArticle.author} · ` : ""}
                {selectedArticle.date}
              </p>
              <p className="article-body-preview">{selectedArticle.body}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="sidebar-section">
          <h3>INSPECT NODE</h3>
          <p className="sidebar-empty">Click a node to inspect it and see relationship types</p>
        </div>
      )}
    </aside>
  );
}
