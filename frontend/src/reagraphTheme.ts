import type { Theme } from "reagraph";

/** Accent used for selection / focus — matches NewsGraph navbar */
export const ACCENT = "#38bdf8";

/**
 * Analytical dark theme — matches graph-libraries/reagraph-test.
 */
export const newsGraphTheme: Theme = {
  canvas: {
    background: "#0b1120",
    fog: "#ffffff",
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
      color: "#94a3b8",
      stroke: "#0b1120",
      activeColor: "#94a3b8",
    },
  },
  ring: {
    fill: "#334155",
    activeFill: ACCENT,
  },
  edge: {
    fill: "#64748b",
    activeFill: "#64748b",
    opacity: 0.55,
    selectedOpacity: 0.55,
    inactiveOpacity: 0.06,
    label: {
      color: "#94a3b8",
      stroke: "#0b1120",
      activeColor: "#e2e8f0",
      fontSize: 6,
    },
    subLabel: {
      color: "#475569",
      stroke: "#0b1120",
      activeColor: "#94a3b8",
      fontSize: 4,
    },
  },
  arrow: {
    fill: "#94a3b8",
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

/** Brighten a hex color while keeping its hue — used for selection instead of a flat accent. */
export function intensifyNodeColor(hex: string, amount = 1.22): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const brighten = (channel: number) =>
    Math.min(1, channel * amount + (1 - channel) * 0.12);

  const toHex = (channel: number) =>
    Math.round(brighten(channel) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getNodeSubLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function formatRelationshipLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export interface NodeLabelDisplay {
  text: string;
  fontSize: number;
}

const LONG_NAME_CHARS = 18;
const NODE_LABEL_FONT = 6;
const NODE_LABEL_FONT_SMALL = 5;

/** Wrap long names onto two lines and use a smaller font so the full name stays visible. */
export function formatNodeLabelDisplay(name: string): NodeLabelDisplay {
  const trimmed = name.trim();
  if (trimmed.length <= LONG_NAME_CHARS) {
    return { text: trimmed, fontSize: NODE_LABEL_FONT };
  }

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    const target = Math.ceil(trimmed.length / 2);
    let firstLine = words[0];
    let index = 1;

    while (index < words.length - 1) {
      const next = `${firstLine} ${words[index]}`;
      if (next.length >= target) break;
      firstLine = next;
      index += 1;
    }

    const secondLine = words.slice(index).join(" ");
    return { text: `${firstLine}\n${secondLine}`, fontSize: NODE_LABEL_FONT_SMALL };
  }

  const mid = Math.ceil(trimmed.length / 2);
  return {
    text: `${trimmed.slice(0, mid)}\n${trimmed.slice(mid)}`,
    fontSize: NODE_LABEL_FONT_SMALL,
  };
}

/** Reagraph size units — keep nodes compact and even (reagraph-test) */
export function reagraphNodeSize(relevancy: number): number {
  return 4 + Math.max(relevancy, 20) * 0.18;
}
