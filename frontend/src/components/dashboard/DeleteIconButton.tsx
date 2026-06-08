interface DeleteIconButtonProps {
  label: string;
  onClick: () => void;
}

export function DeleteIconButton({ label, onClick }: DeleteIconButtonProps) {
  return (
    <button
      type="button"
      className="btn-icon btn-icon--danger"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}
