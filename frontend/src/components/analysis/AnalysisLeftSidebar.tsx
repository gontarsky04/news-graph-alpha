import { formatRelationshipLabel } from "../../reagraphTheme";
import { ENTITY_TYPES, type GraphFilters } from "../../types";

interface AnalysisLeftSidebarProps {
  filters: GraphFilters;
  availableRelationshipTypes: string[];
  onToggleNodeType: (type: string) => void;
  onToggleRelType: (type: string) => void;
}

export default function AnalysisLeftSidebar({
  filters,
  availableRelationshipTypes,
  onToggleNodeType,
  onToggleRelType,
}: AnalysisLeftSidebarProps) {
  return (
    <aside className="sidebar left-sidebar">
      <div className="sidebar-section">
        <h3>ENTITY TYPES</h3>
        {ENTITY_TYPES.map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={filters.nodeTypes.has(type)}
              onChange={() => onToggleNodeType(type)}
            />{" "}
            {type}
          </label>
        ))}
      </div>

      <div className="sidebar-section">
        <h3>RELATIONSHIP TYPES</h3>
        {availableRelationshipTypes.map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={filters.relationshipTypes.has(type)}
              onChange={() => onToggleRelType(type)}
            />{" "}
            {formatRelationshipLabel(type)}
          </label>
        ))}
      </div>
    </aside>
  );
}
