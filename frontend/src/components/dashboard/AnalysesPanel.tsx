import { useMemo } from "react";
import { Link } from "react-router-dom";
import AnalysisMeta from "../AnalysisMeta";
import type { Analysis, Article, GraphData } from "../../types";
import { filterGraphByArticleIds } from "../../utils/graphFilter";
import { DeleteIconButton } from "./DeleteIconButton";

interface AnalysesPanelProps {
  analyses: Analysis[];
  allAnalyses: Analysis[];
  articles: Article[];
  graphData: GraphData;
  onNewAnalysis: () => void;
  onCopyAnalysis: (id: string) => void;
  onUpdateAnalysis: (id: string, patch: Partial<Pick<Analysis, "name" | "articleIds">>) => void;
  onDeleteAnalysis: (analysis: Analysis) => void;
  onDeleteSnapshot: (snapshot: Analysis) => void;
  selectedAnalysisId: string | null;
  onSelectAnalysis: (id: string | null) => void;
}

function formatAnalysisDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function countAnalysisNodes(
  graphData: GraphData,
  analysis: Analysis,
  articles: Article[]
): number {
  const doneIds = analysis.articleIds.filter((id) =>
    articles.some((a) => a.id === id && a.status === "DONE")
  );
  return filterGraphByArticleIds(graphData, doneIds).nodes.length;
}

export function AnalysesPanel({
  analyses,
  allAnalyses,
  articles,
  graphData,
  onNewAnalysis,
  onCopyAnalysis,
  onUpdateAnalysis,
  onDeleteAnalysis,
  onDeleteSnapshot,
  selectedAnalysisId,
  onSelectAnalysis,
}: AnalysesPanelProps) {
  const selected = analyses.find((a) => a.id === selectedAnalysisId);
  const doneArticles = articles.filter((a) => a.status === "DONE");

  const snapshotsByParent = useMemo(() => {
    const map = new Map<string, Analysis[]>();
    for (const item of allAnalyses) {
      if (!item.isSnapshot || !item.parentAnalysisId) continue;
      const list = map.get(item.parentAnalysisId) ?? [];
      list.push(item);
      map.set(item.parentAnalysisId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return map;
  }, [allAnalyses]);

  const toggleArticleInAnalysis = (articleId: string) => {
    if (!selected || selected.isSnapshot) return;
    const next = new Set(selected.articleIds);
    if (next.has(articleId)) next.delete(articleId);
    else next.add(articleId);
    onUpdateAnalysis(selected.id, { articleIds: [...next] });
  };

  const toggleSelection = (id: string) => {
    onSelectAnalysis(selectedAnalysisId === id ? null : id);
  };

  return (
    <section className="dashboard-panel">
      <div className="panel-header">
        <div className="panel-header__intro">
          <h2>Created Graphs</h2>
          <p className="panel-header__subtitle">Your analysis graphs and their snapshots.</p>
        </div>
        <div className="panel-header__actions">
          <button type="button" className="btn-primary" onClick={onNewAnalysis}>
            + New Analysis
          </button>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel-list">
          {analyses
            .filter((a) => !a.isSnapshot)
            .map((analysis) => {
              const isExpanded = selectedAnalysisId === analysis.id;
              const snapshots = snapshotsByParent.get(analysis.id) ?? [];
              const nodeCount = countAnalysisNodes(graphData, analysis, articles);

              return (
                <div
                  key={analysis.id}
                  className={`analysis-card-block ${
                    isExpanded ? "analysis-card-block--expanded" : ""
                  }`}
                >
                  <div
                    className={`analysis-card analysis-card--with-actions ${
                      isExpanded ? "analysis-card--active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="analysis-card__select"
                      onClick={() => toggleSelection(analysis.id)}
                      aria-expanded={isExpanded}
                    >
                      <strong>{analysis.name}</strong>
                      <AnalysisMeta
                        articleCount={analysis.articleIds.length}
                        nodeCount={nodeCount}
                        snapshotCount={snapshots.length}
                      />
                    </button>
                    <div className="analysis-row-actions">
                      <span className="meta-chip">
                        {formatAnalysisDate(analysis.createdAt)}
                      </span>
                      <DeleteIconButton
                        label={`Delete analysis ${analysis.name}`}
                        onClick={() => onDeleteAnalysis(analysis)}
                      />
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="analysis-card__expand">
                      <p className="analysis-card__snapshots-label">Snapshots:</p>
                      {snapshots.length === 0 ? (
                        <p className="analysis-card__snapshots-empty">
                          No snapshots yet — save one from the graph view.
                        </p>
                      ) : (
                        <ul className="analysis-snapshot-list">
                          {snapshots.map((snapshot) => {
                            const snapshotNodeCount = countAnalysisNodes(
                              graphData,
                              snapshot,
                              articles
                            );

                            return (
                            <li key={snapshot.id} className="analysis-snapshot-card">
                              <div className="analysis-card-row">
                                <Link
                                  to={`/analysis/${snapshot.id}`}
                                  className="analysis-snapshot-card__link"
                                >
                                  <strong className="analysis-snapshot-card__title">
                                    {snapshot.name}
                                  </strong>
                                  <span className="analysis-snapshot-card__subtitle">
                                    {snapshot.articleIds.length} articles ·{" "}
                                    {snapshotNodeCount} nodes
                                  </span>
                                </Link>
                                <div className="analysis-row-actions">
                                  <span className="meta-chip">
                                    {formatAnalysisDate(snapshot.createdAt)}
                                  </span>
                                  <DeleteIconButton
                                    label={`Delete snapshot ${snapshot.name}`}
                                    onClick={() => onDeleteSnapshot(snapshot)}
                                  />
                                </div>
                              </div>
                            </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>

        <div className="panel-detail">
          {selected ? (
            <>
              <div className="panel-detail__header">
                <h3>{selected.name}</h3>
              </div>
              {!selected.isSnapshot ? (
                <>
                  <p className="panel-hint">Artykuły w tej analizie:</p>
                  {doneArticles.length === 0 ? (
                    <p className="sidebar-empty">Brak przetworzonych artykułów</p>
                  ) : (
                    <ul className="modal__article-list modal__article-list--compact">
                      {doneArticles.map((article) => (
                        <li key={article.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selected.articleIds.includes(article.id)}
                              onChange={() => toggleArticleInAnalysis(article.id)}
                            />{" "}
                            {article.title}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <ul className="file-list">
                  {articles
                    .filter((a) => selected.articleIds.includes(a.id))
                    .map((article) => (
                      <li key={article.id}>
                        {article.title}
                        <span className="article-meta">{article.status}</span>
                      </li>
                    ))}
                </ul>
              )}
              <div className="panel-actions">
                <Link
                  to={`/analysis/${selected.id}`}
                  className="btn-primary btn-link"
                >
                  Open analysis
                </Link>
                {!selected.isSnapshot ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onCopyAnalysis(selected.id)}
                  >
                    Duplicate
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="sidebar-empty">
              Wybierz analizę lub utwórz nową z wybranych artykułów.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
