import type { Article, ArticleUpload, GraphData } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchGraph(): Promise<GraphData> {
  return request<GraphData>("/api/graph");
}

export function fetchArticles(): Promise<Article[]> {
  return request<Article[]>("/api/articles");
}

export function uploadArticle(article: ArticleUpload): Promise<Article> {
  return request<Article>("/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(article),
  });
}

export async function deleteArticle(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/articles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(message || `Request failed (${response.status})`);
  }
}

export function retryArticle(id: string): Promise<Article> {
  return request<Article>(`/api/articles/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  });
}
