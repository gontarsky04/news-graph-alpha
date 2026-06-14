import { useEffect, useMemo, useState } from "react";
import type { Article } from "../../types";
import ArticleUploadButton from "./ArticleUploadButton";
import { DeleteIconButton } from "./DeleteIconButton";

interface ArticlesPanelProps {
  articles: Article[];
  uploading: boolean;
  retryingId: string | null;
  onUploadFiles: (files: File[]) => void;
  onDeleteArticle: (article: Article) => void;
  onRetryArticle: (article: Article) => void;
}

export default function ArticlesPanel({
  articles,
  uploading,
  retryingId,
  onUploadFiles,
  onDeleteArticle,
  onRetryArticle,
}: ArticlesPanelProps) {
  const [tagFilter, setTagFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    articles.forEach((a) => a.tags?.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [articles]);

  const filtered = useMemo(() => {
    if (!tagFilter) return articles;
    return articles.filter((a) => a.tags?.includes(tagFilter));
  }, [articles, tagFilter]);

  const selected = articles.find((a) => a.id === selectedId);

  useEffect(() => {
    if (selectedId && !articles.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [articles, selectedId]);

  return (
    <section className="dashboard-panel">
      <div className="panel-header">
        <h2>Articles</h2>
        <ArticleUploadButton
          uploading={uploading}
          onUpload={onUploadFiles}
          variant="inline"
        />
      </div>

      <p className="panel-hint">
        Wgraj plik JSON z artykułem lub listą artykułów (pola <code>title</code>,{" "}
        <code>body</code> itd.). Możesz też wybrać kilka plików naraz.
      </p>

      <div className="panel-grid">
        <div className="panel-list">
          <div className="filter-row">
            <label htmlFor="tag-filter">Filter by tag</label>
            <select
              id="tag-filter"
              className="dropdown"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <ArticleUploadButton
              uploading={uploading}
              onUpload={onUploadFiles}
              variant="dropzone"
            />
          ) : (
            <ul className="file-list">
              {filtered.map((article) => (
                <li key={article.id} className="file-list__row">
                  <button
                    type="button"
                    className={`file-list__btn ${
                      selectedId === article.id ? "file-list__btn--active" : ""
                    }`}
                    onClick={() => setSelectedId(article.id)}
                  >
                    📄 {article.title}
                  </button>
                  <span className={`status-pill status-pill--${article.status.toLowerCase()}`}>
                    {article.status}
                  </span>
                  {article.status === "FAILED" ? (
                    <button
                      type="button"
                      className="btn-secondary btn-secondary--compact"
                      disabled={retryingId === article.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryArticle(article);
                      }}
                    >
                      {retryingId === article.id ? "Retrying…" : "Retry"}
                    </button>
                  ) : null}
                  <DeleteIconButton
                    label={`Delete ${article.title}`}
                    onClick={() => onDeleteArticle(article)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel-detail">
          {selected ? (
            <>
              <div className="panel-detail__header">
                <h3>{selected.title}</h3>
                <DeleteIconButton
                  label={`Delete ${selected.title}`}
                  onClick={() => onDeleteArticle(selected)}
                />
              </div>
              {selected.source ? (
                <a href={selected.source} target="_blank" rel="noreferrer" className="article-link">
                  {selected.source}
                </a>
              ) : null}
              <p className="article-meta">
                {selected.author ? `${selected.author} · ` : ""}
                {selected.date ?? "No date"}
              </p>
              {selected.status === "FAILED" && selected.errorMessage ? (
                <p className="article-error">{selected.errorMessage}</p>
              ) : null}
              {selected.status === "FAILED" ? (
                <div className="panel-actions panel-actions--compact">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={retryingId === selected.id}
                    onClick={() => onRetryArticle(selected)}
                  >
                    {retryingId === selected.id ? "Retrying…" : "Retry processing"}
                  </button>
                </div>
              ) : null}
              {selected.tags?.length ? (
                <div className="tag-row">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="article-body-preview">{selected.body.slice(0, 600)}…</p>
            </>
          ) : (
            <p className="sidebar-empty">Select an article to view details</p>
          )}
        </div>
      </div>
    </section>
  );
}
