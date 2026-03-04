import type { PendingChange } from "../types";

interface DiffViewProps {
  pendingChanges: Record<string, PendingChange>;
  baselineLabel?: "default" | "disk";
  onClose: () => void;
  onApply: () => void;
}

export function DiffView({
  pendingChanges,
  baselineLabel = "disk",
  onClose,
  onApply,
}: DiffViewProps) {
  const changeEntries = Object.entries(pendingChanges);

  if (changeEntries.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-12">
        <div className="bg-light-card dark:bg-app-card rounded-xl border border-light-border dark:border-app-border p-8 text-center shadow-2xl">
          <p className="text-gray-500 dark:text-gray-400">No pending changes</p>
          <button
            onClick={onClose}
            className="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const leftTitle =
    baselineLabel === "default" ? "Default Baseline" : "Current Environment";
  const subtitle =
    baselineLabel === "default"
      ? "Comparing against saved default"
      : "Comparing against last loaded state";

  // Classify changes
  const entries = changeEntries.map(([changeKey, change]) => {
    const [file, key] = changeKey.split("::");
    const fileName = file.split("/").pop() || file;
    const isAdded = change.original === "";
    const isRemoved = change.current === "";
    return { changeKey, file, key, fileName, ...change, isAdded, isRemoved };
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-light-card dark:bg-app-card w-full max-w-6xl h-full rounded-xl border border-light-border dark:border-app-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-light-border dark:border-app-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Staged Changes Diff
            </h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Split diff */}
        <div className="flex-1 overflow-hidden grid grid-cols-2">
          {/* Left */}
          <div className="border-r border-light-border dark:border-app-border flex flex-col">
            <div className="bg-gray-100/50 dark:bg-app-sidebar/50 px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">
              {leftTitle}
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-2 text-gray-600 dark:text-gray-400">
              {entries.map((entry) => {
                if (entry.isAdded) {
                  return (
                    <div key={entry.changeKey} className="p-1 text-gray-400 dark:text-gray-600 italic">
                      (not present)
                    </div>
                  );
                }
                if (entry.isRemoved) {
                  return (
                    <div
                      key={entry.changeKey}
                      className="p-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-l-2 border-red-500"
                    >
                      - {entry.key}={entry.original}
                    </div>
                  );
                }
                return (
                  <div
                    key={entry.changeKey}
                    className="p-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-l-2 border-red-500"
                  >
                    {entry.key}={entry.original}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Proposed Changes */}
          <div className="flex flex-col">
            <div className="bg-gray-100/50 dark:bg-app-sidebar/50 px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">
              Proposed Changes
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-2 text-gray-600 dark:text-gray-400">
              {entries.map((entry) => {
                if (entry.isRemoved) {
                  return (
                    <div key={entry.changeKey} className="p-1 text-gray-400 dark:text-gray-600 italic">
                      (removed)
                    </div>
                  );
                }
                if (entry.isAdded) {
                  return (
                    <div
                      key={entry.changeKey}
                      className="p-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 border-l-2 border-green-500"
                    >
                      + {entry.key}={entry.current}
                    </div>
                  );
                }
                return (
                  <div
                    key={entry.changeKey}
                    className="p-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-l-2 border-yellow-500"
                  >
                    {entry.key}={entry.current}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-light-border dark:border-app-border bg-gray-50/50 dark:bg-app-sidebar/30 flex justify-end">
          <button
            onClick={onApply}
            className="px-6 py-2 rounded bg-primary text-white text-sm font-bold hover:bg-blue-500 transition-colors"
          >
            Apply All Changes
          </button>
        </div>
      </div>
    </div>
  );
}
