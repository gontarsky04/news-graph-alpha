import { Link } from "react-router-dom";
import type { Analysis, Article } from "../../types";
import { DeleteIconButton } from "./DeleteIconButton";

interface AnalysesPanelProps {
  analyses: Analysis[];
  articles: Article[];
  onNewAnalysis: () => void;
  onCopyAnalysis: (id: string) => void;
  onUpdateAnalysis: (id: string, patch: Partial<Pick<Analysis, "name" | "articleIds">>) => void;
  onDeleteAnalysis: (analysis: Analysis) => void;
  selectedAnalysisId: string | null;
  onSelectAnalysis: (id: string) => void;
}

export function AnalysesPanel({
  analyses,
  articles,
  onNewAnalysis,
  onCopyAnalysis,
  onUpdateAnalysis,
  onDeleteAnalysis,
  selectedAnalysisId,
  onSelectAnalysis,
}: AnalysesPanelProps) {
  const selected = analyses.find((a) => a.id === selectedAnalysisId);
  const doneArticles = articles.filter((a) => a.status === "DONE");

  const toggleArticleInAnalysis = (articleId: string) => {
    if (!selected || selected.isSnapshot) return;
    const next = new Set(selected.articleIds);
    if (next.has(articleId)) next.delete(articleId);
    else next.add(articleId);
    onUpdateAnalysis(selected.id, { articleIds: [...next] });
  };

  return (
    <section className="dashboard-panel">
      <div className="panel-header">
        <h2>Analyses</h2>
        <button type="button" className="btn-primary" onClick={onNewAnalysis}>
          + New Analysis
        </button>
      </div>

      <p className="panel-hint">
        Analiza to graf zbudowany tylko z wybranych artykułów. Zaznacz artykuły przy tworzeniu
        lub edytuj listę poniżej.
      </p>

      <div className="panel-grid">
        <div className="panel-list">
          <Link to="/analysis/global" className="analysis-card analysis-card--featured">
            <strong>Global graph</strong>
            <span>All articles · full knowledge graph</span>
          </Link>
          {analyses
            .filter((a) => !a.isSnapshot)
            .map((analysis) => (
              <div
                key={analysis.id}
                className={`analysis-card-row ${
                  selectedAnalysisId === analysis.id ? "analysis-card-row--active" : ""
                }`}
              >
                <button
                  type="button"
                  className="analysis-card"
                  onClick={() => onSelectAnalysis(analysis.id)}
                >
                  <strong>{analysis.name}</strong>
                  <span>{analysis.articleIds.length} articles</span>
                </button>
                <DeleteIconButton
                  label={`Delete analysis ${analysis.name}`}
                  onClick={() => onDeleteAnalysis(analysis)}
                />
              </div>
            ))}
        </div>

        <div className="panel-detail">
          {selected ? (
            <>
              <div className="panel-detail__header">
                <h3>{selected.name}</h3>
                {!selected.isSnapshot ? (
                  <DeleteIconButton
                    label={`Delete analysis ${selected.name}`}
                    onClick={() => onDeleteAnalysis(selected)}
                  />
                ) : null}
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
