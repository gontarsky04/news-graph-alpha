import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteArticle as deleteArticleApi, fetchArticles, retryArticle, uploadArticle } from "../api/client";
import { AnalysesPanel } from "../components/dashboard/AnalysesPanel";
import ArticlesPanel from "../components/dashboard/ArticlesPanel";
import { ConfirmDeleteModal } from "../components/dashboard/ConfirmDeleteModal";
import CreateAnalysisModal from "../components/dashboard/CreateAnalysisModal";
import SnapshotsSidebar from "../components/dashboard/SnapshotsSidebar";
import Navbar from "../components/layout/Navbar";
import { useAnalyses } from "../hooks/useAnalyses";
import type { Analysis, Article, ArticleUpload } from "../types";

type DashboardTab = "analyses" | "articles";

type DeleteTarget =
  | { kind: "article"; item: Article }
  | { kind: "analysis"; item: Analysis }
  | { kind: "snapshot"; item: Analysis };

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    analyses,
    createAnalysis,
    copyAnalysis,
    updateAnalysis,
    deleteAnalysis,
    removeArticleFromAnalyses,
  } = useAnalyses();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState<DashboardTab>("analyses");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [showCreateAnalysis, setShowCreateAnalysis] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refreshArticles = useCallback(async () => {
    try {
      setArticles(await fetchArticles());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load articles");
    }
  }, []);

  useEffect(() => {
    void refreshArticles();
  }, [refreshArticles]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploading(true);
      setError(null);
      try {
        let lastError: string | null = null;

        // Each file may hold a single article object or an array of them.
        const articles: ArticleUpload[] = [];
        for (const file of files) {
          try {
            const parsed = JSON.parse(await file.text());
            const items = Array.isArray(parsed) ? parsed : [parsed];
            articles.push(...(items as ArticleUpload[]));
          } catch {
            lastError = `Invalid JSON in ${file.name}`;
          }
        }

        // Upload sequentially: each article links against the graph built by
        // the previous ones, so concurrent uploads would race on dedup.
        for (const article of articles) {
          try {
            await uploadArticle(article);
          } catch (err) {
            lastError = err instanceof Error ? err.message : "Upload failed";
          }
        }

        await refreshArticles();
        setTab("articles");
        if (lastError) setError(lastError);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [refreshArticles]
  );

  const handleRetryArticle = useCallback(
    async (article: Article) => {
      setRetryingId(article.id);
      setError(null);
      try {
        await retryArticle(article.id);
        await refreshArticles();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Retry failed");
        await refreshArticles();
      } finally {
        setRetryingId(null);
      }
    },
    [refreshArticles]
  );

  const handleCreateAnalysis = (name: string, articleIds: string[]) => {
    const analysis = createAnalysis(name, articleIds);
    setSelectedAnalysisId(analysis.id);
    setShowCreateAnalysis(false);
    setTab("analyses");
    navigate(`/analysis/${analysis.id}`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      if (deleteTarget.kind === "article") {
        await deleteArticleApi(deleteTarget.item.id);
        removeArticleFromAnalyses(deleteTarget.item.id);
        await refreshArticles();
      } else {
        deleteAnalysis(deleteTarget.item.id);
        if (selectedAnalysisId === deleteTarget.item.id) {
          setSelectedAnalysisId(null);
        }
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const deleteModalCopy = (() => {
    if (!deleteTarget) return null;
    if (deleteTarget.kind === "article") {
      return {
        title: "Delete article",
        message: `The article "${deleteTarget.item.title}" will be deleted permanently from Neo4j. Do you confirm?`,
      };
    }
    if (deleteTarget.kind === "snapshot") {
      return {
        title: "Delete snapshot",
        message: `The snapshot "${deleteTarget.item.name}" will be deleted permanently. Do you confirm?`,
      };
    }
    return {
      title: "Delete analysis",
      message: `The analysis "${deleteTarget.item.name}" will be deleted permanently. Do you confirm?`,
    };
  })();

  return (
    <div className="app-layout">
      <Navbar
        variant="dashboard"
        searchValue={search}
        onSearchChange={setSearch}
        uploading={uploading}
        onUploadArticles={(files) => void handleUpload(files)}
      />
      {error ? <div className="banner banner--error">{error}</div> : null}
      {uploading || retryingId ? (
        <div className="banner banner--info">
          {retryingId
            ? "Ponowne przetwarzanie artykułu…"
            : "Ekstrakcja i linkowanie encji, zapis do Neo4j… (może potrwać do minuty na artykuł)"}
        </div>
      ) : null}

      <div className="dashboard-layout">
        <SnapshotsSidebar
          analyses={
            search
              ? analyses.filter((a) =>
                  a.name.toLowerCase().includes(search.toLowerCase())
                )
              : analyses
          }
          onDeleteSnapshot={(snapshot) =>
            setDeleteTarget({ kind: "snapshot", item: snapshot })
          }
        />

        <div className="dashboard-main">
          <div className="dashboard-tabs">
            <button
              type="button"
              className={`dashboard-tab ${tab === "analyses" ? "dashboard-tab--active" : ""}`}
              onClick={() => setTab("analyses")}
            >
              Analyses
            </button>
            <button
              type="button"
              className={`dashboard-tab ${tab === "articles" ? "dashboard-tab--active" : ""}`}
              onClick={() => setTab("articles")}
            >
              Articles
            </button>
          </div>

          {tab === "analyses" ? (
            <AnalysesPanel
              analyses={analyses}
              articles={articles}
              onNewAnalysis={() => setShowCreateAnalysis(true)}
              onCopyAnalysis={copyAnalysis}
              onUpdateAnalysis={updateAnalysis}
              onDeleteAnalysis={(analysis) =>
                setDeleteTarget({ kind: "analysis", item: analysis })
              }
              selectedAnalysisId={selectedAnalysisId}
              onSelectAnalysis={setSelectedAnalysisId}
            />
          ) : (
            <ArticlesPanel
              articles={articles}
              uploading={uploading}
              retryingId={retryingId}
              onUploadFiles={(files) => void handleUpload(files)}
              onDeleteArticle={(article) =>
                setDeleteTarget({ kind: "article", item: article })
              }
              onRetryArticle={(article) => void handleRetryArticle(article)}
            />
          )}
        </div>
      </div>

      {showCreateAnalysis ? (
        <CreateAnalysisModal
          articles={articles}
          onClose={() => setShowCreateAnalysis(false)}
          onCreate={handleCreateAnalysis}
        />
      ) : null}

      {deleteTarget && deleteModalCopy ? (
        <ConfirmDeleteModal
          title={deleteModalCopy.title}
          message={deleteModalCopy.message}
          confirming={deleting}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </div>
  );
}
