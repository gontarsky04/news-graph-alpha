import { Link, useLocation } from "react-router-dom";
import type { Analysis } from "../../types";
import { DeleteIconButton } from "./DeleteIconButton";

interface SnapshotsSidebarProps {
  analyses: Analysis[];
  selectedId?: string;
  onDeleteSnapshot: (snapshot: Analysis) => void;
}

export default function SnapshotsSidebar({
  analyses,
  selectedId,
  onDeleteSnapshot,
}: SnapshotsSidebarProps) {
  const location = useLocation();
  const snapshots = analyses.filter((a) => a.isSnapshot);
  const regular = analyses.filter((a) => !a.isSnapshot);

  return (
    <aside className="sidebar dashboard-sidebar">
      <div className="sidebar-section">
        <h3>SNAPSHOTS</h3>
        {snapshots.length === 0 ? (
          <p className="sidebar-empty">No snapshots yet</p>
        ) : (
          <ul className="nav-list">
            {snapshots.map((item) => (
              <li key={item.id} className="nav-list__row">
                <Link
                  to={`/analysis/${item.id}`}
                  className={`nav-list__link ${
                    location.pathname.includes(item.id) ? "nav-list__link--active" : ""
                  }`}
                >
                  📸 {item.name}
                </Link>
                <DeleteIconButton
                  label={`Delete snapshot ${item.name}`}
                  onClick={() => onDeleteSnapshot(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar-section">
        <h3>ANALYSES</h3>
        <ul className="nav-list">
          <li>
            <Link
              to="/analysis/global"
              className={`nav-list__link ${
                selectedId === "global" || location.pathname.endsWith("/global")
                  ? "nav-list__link--active"
                  : ""
              }`}
            >
              🌐 Global graph
            </Link>
          </li>
          {regular.map((item) => (
            <li key={item.id}>
              <Link
                to={`/analysis/${item.id}`}
                className={`nav-list__link ${
                  selectedId === item.id ? "nav-list__link--active" : ""
                }`}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
