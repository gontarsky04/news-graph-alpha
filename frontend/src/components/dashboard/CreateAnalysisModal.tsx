import { useMemo, useState } from "react";
import type { Article } from "../../types";

interface CreateAnalysisModalProps {
  articles: Article[];
  onClose: () => void;
  onCreate: (name: string, articleIds: string[]) => void;
}

export default function CreateAnalysisModal({
  articles,
  onClose,
  onCreate,
}: CreateAnalysisModalProps) {
  const doneArticles = useMemo(
    () => articles.filter((a) => a.status === "DONE"),
    [articles]
  );

  const [name, setName] = useState(`Analysis ${new Date().toLocaleDateString()}`);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(doneArticles.map((a) => a.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="create-analysis-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="create-analysis-title">Nowa analiza</h3>
        <p className="modal__hint">
          Zaznacz artykuły, z których chcesz zbudować graf. Wyświetlimy encje powiązane
          z tymi artykułami (do 2 kroków w grafie).
        </p>

        <label className="modal__field">
          Nazwa
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="modal__input"
          />
        </label>

        {doneArticles.length === 0 ? (
          <p className="sidebar-empty">
            Brak artykułów ze statusem DONE. Najpierw wgraj i przetwórz artykuły.
          </p>
        ) : (
          <ul className="modal__article-list">
            {doneArticles.map((article) => (
              <li key={article.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(article.id)}
                    onChange={() => toggle(article.id)}
                  />{" "}
                  {article.title}
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="modal__actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!name.trim() || selected.size === 0}
            onClick={() => onCreate(name.trim(), [...selected])}
          >
            Utwórz analizę ({selected.size} artykułów)
          </button>
        </div>
      </div>
    </div>
  );
}
