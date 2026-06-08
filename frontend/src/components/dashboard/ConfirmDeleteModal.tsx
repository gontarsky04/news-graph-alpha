interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}

export function ConfirmDeleteModal({
  title,
  message,
  onClose,
  onConfirm,
  confirming = false,
}: ConfirmDeleteModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--confirm"
        role="alertdialog"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-delete-title">{title}</h3>
        <p id="confirm-delete-message" className="modal__hint">
          {message}
        </p>
        <div className="modal__actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={confirming}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
