import { Link } from "react-router-dom";
import LogoMark from "./LogoMark";

interface NavbarProps {
  variant: "dashboard" | "analysis";
  readOnly?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSaveSnapshot?: () => void;
  onCreateNode?: () => void;
}

export default function Navbar({
  variant,
  readOnly = false,
  searchValue = "",
  onSearchChange,
  onSaveSnapshot,
  onCreateNode,
}: NavbarProps) {
  return (
    <header className="topbar">
      <div className="logo-section">
        <Link to="/" className="logo-link" aria-label="NewsGraph home">
          <span className="logo-mark-wrap" aria-hidden="true">
            <LogoMark className="logo-mark" />
          </span>
          <span className="logo-wordmark">
            News<span className="logo-wordmark-accent">Graph</span>
          </span>
        </Link>
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

      {variant === "analysis" ? (
        <div className="actions-section">
          {!readOnly ? (
            <>
              <button type="button" className="btn-secondary" onClick={onCreateNode}>
                Create Node
              </button>
              <button type="button" className="btn-secondary" onClick={onSaveSnapshot}>
                Save Snapshot
              </button>
            </>
          ) : null}
          <Link to="/" className="btn-secondary btn-link">
            Dashboard
          </Link>
        </div>
      ) : (
        <div className="actions-section actions-section--spacer" aria-hidden="true" />
      )}
    </header>
  );
}
