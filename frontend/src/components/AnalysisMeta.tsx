interface AnalysisMetaProps {
  articleCount: number;
  nodeCount: number;
  snapshotCount?: number;
  className?: string;
}

export default function AnalysisMeta({
  articleCount,
  nodeCount,
  snapshotCount,
  className,
}: AnalysisMetaProps) {
  const classes = ["analysis-card__meta", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <span className="analysis-card__meta-item">
        <span className="analysis-card__meta-icon" aria-hidden>
          📄
        </span>
        {articleCount} articles
      </span>
      <span className="analysis-card__meta-item">
        <span className="analysis-card__meta-dot" aria-hidden />
        {nodeCount} nodes
      </span>
      {snapshotCount != null ? (
        <span className="analysis-card__meta-item">
          <span
            className="analysis-card__meta-dot analysis-card__meta-dot--snapshot"
            aria-hidden
          />
          {snapshotCount} snapshots
        </span>
      ) : null}
    </div>
  );
}
