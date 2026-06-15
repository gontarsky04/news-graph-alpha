import { useCallback, useEffect, useState } from "react";
import type { Analysis } from "../types";

const STORAGE_KEY = "newsgraph-analyses";

function loadAnalyses(): Analysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Analysis[]) : [];
  } catch {
    return [];
  }
}

function saveAnalyses(analyses: Analysis[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
}

export function useAnalyses() {
  const [analyses, setAnalyses] = useState<Analysis[]>(loadAnalyses);

  useEffect(() => {
    saveAnalyses(analyses);
  }, [analyses]);

  const createAnalysis = useCallback((name: string, articleIds: string[]) => {
    const analysis: Analysis = {
      id: `analysis-${Date.now()}`,
      name,
      articleIds,
      createdAt: new Date().toISOString(),
    };
    setAnalyses((prev) => [analysis, ...prev]);
    return analysis;
  }, []);

  const createSnapshot = useCallback(
    (name: string, articleIds: string[], parentAnalysisId: string) => {
      const snapshot: Analysis = {
        id: `snapshot-${Date.now()}`,
        name,
        articleIds,
        createdAt: new Date().toISOString(),
        isSnapshot: true,
        parentAnalysisId,
      };
      setAnalyses((prev) => [snapshot, ...prev]);
      return snapshot;
    },
    []
  );

  const copyAnalysis = useCallback((id: string) => {
    const source = analyses.find((a) => a.id === id);
    if (!source) return null;
    const copy: Analysis = {
      ...source,
      id: `analysis-${Date.now()}`,
      name: `${source.name} (copy)`,
      createdAt: new Date().toISOString(),
      isSnapshot: false,
    };
    setAnalyses((prev) => [copy, ...prev]);
    return copy;
  }, [analyses]);

  const getAnalysis = useCallback(
    (id: string) => analyses.find((a) => a.id === id),
    [analyses]
  );

  const updateAnalysis = useCallback(
    (id: string, patch: Partial<Pick<Analysis, "name" | "articleIds">>) => {
      setAnalyses((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
      );
    },
    []
  );

  const deleteAnalysis = useCallback((id: string) => {
    setAnalyses((prev) =>
      prev.filter((a) => a.id !== id && a.parentAnalysisId !== id)
    );
  }, []);

  const removeArticleFromAnalyses = useCallback((articleId: string) => {
    setAnalyses((prev) =>
      prev.map((a) => ({
        ...a,
        articleIds: a.articleIds.filter((id) => id !== articleId),
      }))
    );
  }, []);

  return {
    analyses,
    createAnalysis,
    createSnapshot,
    copyAnalysis,
    getAnalysis,
    updateAnalysis,
    deleteAnalysis,
    removeArticleFromAnalyses,
  };
}
