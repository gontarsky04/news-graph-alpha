import { Link } from "react-router-dom";
import ArticleUploadButton from "../dashboard/ArticleUploadButton";

interface NavbarProps {
  variant: "dashboard" | "analysis";
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSaveSnapshot?: () => void;
  onCreateNode?: () => void;
  uploading?: boolean;
  onUploadArticles?: (files: File[]) => void;
}

export default function Navbar({
  variant,
  searchValue = "",
  onSearchChange,
  onSaveSnapshot,
  onCreateNode,
  uploading = false,
  onUploadArticles,
}: NavbarProps) {
  return (
    <header className="topbar">
      <div className="logo-section">
        <Link to="/" className="logo-link">
          <h2>NewsGraph</h2>
        </Link>
        {variant === "analysis" ? (
          <span className="library-badge">Active Analysis</span>
        ) : null}
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder={
            variant === "analysis"
              ? "Search… e.g. type:Person Trump"
              : "Search snapshots, analyses, articles…"
          }
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>

      <div className="actions-section">
        {variant === "dashboard" ? (
          <>
            {onUploadArticles ? (
              <ArticleUploadButton
                uploading={uploading}
                onUpload={onUploadArticles}
                variant="navbar"
              />
            ) : null}
            <Link to="/analysis/global" className="btn-secondary btn-link">
              Open Graph
            </Link>
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={onCreateNode}>
              Create Node
            </button>
            <button type="button" className="btn-secondary" onClick={onSaveSnapshot}>
              Save Snapshot
            </button>
            <Link to="/" className="btn-secondary btn-link">
              Dashboard
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
