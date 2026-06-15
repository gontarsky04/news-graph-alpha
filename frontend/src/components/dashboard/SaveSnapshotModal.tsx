import { useState } from "react";

interface SaveSnapshotModalProps {
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function SaveSnapshotModal({ onClose, onSave }: SaveSnapshotModalProps) {
  const [name, setName] = useState(`Snapshot ${new Date().toLocaleDateString()}`);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="save-snapshot-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="save-snapshot-title">Save snapshot</h3>
        <p className="modal__hint">
          Give this graph state a name so you can return to it later from the dashboard.
        </p>

        <label className="modal__field">
          Title
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="modal__input"
            autoFocus
          />
        </label>

        <div className="modal__actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim())}
          >
            Save snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
