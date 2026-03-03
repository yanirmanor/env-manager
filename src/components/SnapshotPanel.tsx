import { useState } from "react";
import type { SnapshotInfo } from "../types";

interface SnapshotPanelProps {
  snapshots: SnapshotInfo[];
  onSave: (name: string) => Promise<void>;
  onRestore: (name: string) => Promise<void>;
  onClose: () => void;
}

export function SnapshotPanel({
  snapshots,
  onSave,
  onRestore,
  onClose,
}: SnapshotPanelProps) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await onSave(newName.trim());
    setNewName("");
    setSaving(false);
  };

  return (
    <div className="border-b border-light-border dark:border-app-border bg-light-surface/80 dark:bg-app-sidebar/80 px-4 py-3 shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Snapshots
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Close
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Snapshot name (e.g. all-remote)"
          className="rounded bg-white dark:bg-app-bg border border-light-border dark:border-app-border px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSave}
          disabled={saving || !newName.trim()}
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {snapshots.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {snapshots.map((snap) => (
            <button
              key={snap.id}
              onClick={() => onRestore(snap.name)}
              className="rounded border border-light-border dark:border-app-border bg-light-card dark:bg-gray-800 px-3 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              title={`${snap.file_count} files — ${new Date(snap.created_at).toLocaleDateString()}`}
            >
              {snap.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
