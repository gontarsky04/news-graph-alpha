import type { Theme } from "reagraph";

/** Accent used for selection / focus — matches NewsGraph navbar */
export const ACCENT = "#38bdf8";

/**
 * Analytical dark theme — matches graph-libraries/reagraph-test.
 */
export const newsGraphTheme: Theme = {
  canvas: {
    background: "#0b1120",
    fog: "#0b1120",
  },
  node: {
    fill: "#64748b",
    activeFill: ACCENT,
    opacity: 0.92,
    selectedOpacity: 1,
    inactiveOpacity: 0.1,
    label: {
      color: "#e2e8f0",
      stroke: "#0b1120",
      activeColor: "#ffffff",
      strokeWidth: 2,
      padding: 1,
      radius: 2,
    },
    subLabel: {
      color: "#64748b",
      stroke: "#0b1120",
      activeColor: ACCENT,
    },
  },
  ring: {
    fill: "#334155",
    activeFill: ACCENT,
  },
  edge: {
    fill: "#334155",
    activeFill: "#64748b",
    opacity: 0.55,
    selectedOpacity: 0.85,
    inactiveOpacity: 0.06,
    label: {
      color: "#64748b",
      stroke: "#0b1120",
      activeColor: "#94a3b8",
      fontSize: 5,
    },
    subLabel: {
      color: "#475569",
      stroke: "#0b1120",
      activeColor: "#94a3b8",
      fontSize: 4,
    },
  },
  arrow: {
    fill: "#475569",
    activeFill: "#94a3b8",
  },
  lasso: {
    background: "rgba(56, 189, 248, 0.07)",
    border: "1px solid rgba(56, 189, 248, 0.45)",
  },
};

/** Softer entity colors — readable on dark backgrounds without feeling neon */
export const TYPE_COLORS: Record<string, string> = {
  Person: "#f97066",
  Organization: "#528bff",
  Location: "#47cd89",
  Event: "#fdb022",
  Topic: "#b692f6",
  Article: "#38bdf8",
};

export const TYPE_LABELS: Record<string, string> = {
  Person: "Person",
  Organization: "Organization",
  Location: "Location",
  Event: "Event",
  Topic: "Topic",
  Article: "Article",
};

export function getNodeColor(type: string): string {
  return TYPE_COLORS[type] ?? "#94a3b8";
}

export function getNodeSubLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/** Keep labels short so they don't dominate the layout */
export function formatNodeLabel(name: string, maxLength = 14): string {
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength - 1)}…`;
}

/** Reagraph size units — keep nodes compact and even (reagraph-test) */
export function reagraphNodeSize(relevancy: number): number {
  return 4 + Math.max(relevancy, 20) * 0.18;
}
