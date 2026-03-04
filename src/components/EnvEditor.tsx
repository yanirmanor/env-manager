import { useState, useMemo } from "react";
import type { EnvEntry, Project, PortStatus, ServiceMap } from "../types";
import { UrlToggle } from "./UrlToggle";
import type { RunningService } from "./UrlToggle";

const CREDENTIAL_PATTERNS = [
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "KEY",
  "PRIVATE",
  "CREDENTIAL",
];

const CATEGORY_BADGES: Record<string, string> = {
  Url: "bg-blue-900/30 text-blue-400 border border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50",
  Port: "bg-purple-100 text-purple-600 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-900/50",
  Host: "bg-cyan-100 text-cyan-600 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-900/50",
  Credential: "bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40",
  Flag: "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-900/50",
  Config: "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-app-border",
};

interface EnvEditorProps {
  entries: EnvEntry[];
  project: Project;
  selectedFile: string | null;
  ports: PortStatus[];
  serviceMap: ServiceMap | null;
  folderServices: RunningService[];
  onStageChange: (file: string, key: string, value: string) => void;
  onToggleUrl: (file: string, key: string, direction: string) => void;
}

export function EnvEditor({
  entries,
  selectedFile,
  ports,
  serviceMap,
  folderServices,
  onStageChange,
  onToggleUrl,
}: EnvEditorProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const isCredential = (key: string) =>
    CREDENTIAL_PATTERNS.some((p) => key.toUpperCase().includes(p));

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build per-entry suggestion map
  const suggestions = useMemo(() => {
    const map = new Map<string, { localUrl: string; serviceName: string }>();
    if (!serviceMap) return map;

    const runningPorts = new Set(ports.map((p) => p.port));

    for (const entry of entries) {
      if (!entry.is_url || entry.url_direction === "Local" || !entry.url_direction)
        continue;

      const mapping = serviceMap.services.find((s) =>
        s.env_keys.includes(entry.key),
      );
      if (!mapping) continue;

      const portMatch = mapping.local_url.match(/:(\d+)/);
      if (!portMatch) continue;

      const port = parseInt(portMatch[1], 10);
      if (runningPorts.has(port)) {
        const cellId = `${entry.file}::${entry.key}`;
        map.set(cellId, {
          localUrl: mapping.local_url,
          serviceName: mapping.name,
        });
      }
    }

    return map;
  }, [entries, serviceMap, ports]);

  // Filter entries to the selected file
  const fileEntries = selectedFile
    ? entries.filter((e) => e.file === selectedFile)
    : entries;

  const filteredEntries = filter
    ? fileEntries.filter(
        (e) =>
          e.key.toLowerCase().includes(filter.toLowerCase()) ||
          e.value.toLowerCase().includes(filter.toLowerCase()),
      )
    : fileEntries;

  const tableEntries = filteredEntries.filter((e) => !e.is_comment);

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-6 py-3 shrink-0">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter keys..."
          className="w-64 bg-white dark:bg-app-bg border border-light-border dark:border-app-border rounded px-3 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Env variable table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-light-border dark:border-app-border">
              <th className="pb-3 font-semibold w-1/3">Key</th>
              <th className="pb-3 font-semibold w-1/3">Value</th>
              <th className="pb-3 font-semibold w-24">Category</th>
              <th className="pb-3 font-semibold text-right w-24 px-4">Switch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border dark:divide-app-border">
            {tableEntries.map((entry) => {
              const cellId = `${entry.file}::${entry.key}`;
              const isCred = isCredential(entry.key);
              const isRevealed = revealedKeys.has(entry.key);
              const suggestion = suggestions.get(cellId);

              return (
                <tr key={cellId} className="env-row">
                  <td className="py-4 font-mono text-sm text-gray-700 dark:text-gray-300">
                    {entry.key}
                  </td>
                  <td className="py-4">
                    {isCred && !isRevealed ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400 dark:text-gray-600">
                          ••••••••••••••••••••••••••••••••
                        </span>
                        <button
                          onClick={() => toggleReveal(entry.key)}
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={entry.value}
                          onChange={(e) =>
                            onStageChange(entry.file, entry.key, e.target.value)
                          }
                          className="bg-transparent border-none focus:ring-0 text-sm text-gray-600 dark:text-gray-400 w-full p-0 focus:text-gray-900 dark:focus:text-white outline-none"
                        />
                        {isCred && isRevealed && (
                          <button
                            onClick={() => toggleReveal(entry.key)}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${CATEGORY_BADGES[entry.category] || CATEGORY_BADGES.Config}`}
                    >
                      {entry.category}
                    </span>
                  </td>
                  <td className="py-4 text-right px-4">
                    <div className="flex items-center justify-end gap-2">
                      {suggestion && (
                        <button
                          onClick={() =>
                            onToggleUrl(entry.file, entry.key, "local")
                          }
                          className="text-[10px] text-app-success bg-app-success/10 border border-app-success/30 rounded-full px-2 py-0.5 hover:bg-app-success/20 transition-colors whitespace-nowrap"
                          title={`Switch to ${suggestion.localUrl}`}
                        >
                          ↻ {suggestion.serviceName} running
                        </button>
                      )}
                      {entry.is_url && entry.url_direction ? (
                        <UrlToggle
                          direction={entry.url_direction}
                          folderServices={folderServices}
                          onToggle={(dir) =>
                            onToggleUrl(entry.file, entry.key, dir)
                          }
                        />
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {tableEntries.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
            {filter ? "No entries match your filter" : "No entries in this file"}
          </div>
        )}
      </div>
    </div>
  );
}
