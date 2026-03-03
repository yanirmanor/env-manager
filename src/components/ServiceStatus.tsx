import { useState, useMemo, useCallback } from "react";
import { starService, unstarService } from "../lib/tauri";
import type { PortStatus, ServiceMap, Project, EnvEntry } from "../types";

interface ServiceStatusProps {
  ports: PortStatus[];
  serviceMap: ServiceMap | null;
  projects: Project[];
  entries: EnvEntry[];
  selectedProject: Project | null;
  onRefresh: () => void;
  onServiceMapChange: () => void;
}

interface StarFormState {
  port: number;
  name: string;
  remoteUrl: string;
}

export function ServiceStatus({
  ports,
  serviceMap,
  projects: _projects,
  entries: _entries,
  selectedProject,
  onRefresh,
  onServiceMapChange,
}: ServiceStatusProps) {
  const [starForm, setStarForm] = useState<StarFormState | null>(null);

  const starredPorts = useMemo(() => {
    const set = new Set<number>();
    if (serviceMap) {
      for (const s of serviceMap.services) {
        const m = s.local_url.match(/:(\d+)/);
        if (m) set.add(parseInt(m[1], 10));
      }
    }
    return set;
  }, [serviceMap]);

  const handleStar = useCallback(
    async (form: StarFormState) => {
      if (!form.name.trim() || !form.remoteUrl.trim()) return;
      try {
        await starService(form.name.trim(), form.remoteUrl.trim(), form.port);
        setStarForm(null);
        onServiceMapChange();
      } catch (e) {
        console.error("Failed to star service:", e);
      }
    },
    [onServiceMapChange],
  );

  const handleUnstar = useCallback(
    async (port: number) => {
      try {
        await unstarService(port);
        onServiceMapChange();
      } catch (e) {
        console.error("Failed to unstar service:", e);
      }
    },
    [onServiceMapChange],
  );

  // Group ports: starred services go under folder name, rest under OTHER
  const groupedPorts = useMemo(() => {
    const groups: Record<string, { port: PortStatus; serviceName: string }[]> =
      {};
    const folderLabel = selectedProject
      ? selectedProject.folder.toUpperCase()
      : "SERVICES";

    for (const port of ports) {
      let serviceName = port.service_name || port.process_name;
      let isRecognized = false;

      if (serviceMap) {
        const mapping = serviceMap.services.find((s) =>
          s.local_url.includes(`:${port.port}`),
        );
        if (mapping) {
          serviceName = mapping.name;
          isRecognized = true;
        }
      }

      if (!isRecognized && port.service_name) {
        isRecognized = true;
      }

      const groupKey = isRecognized ? folderLabel : "OTHER";
      (groups[groupKey] ||= []).push({ port, serviceName });
    }

    return groups;
  }, [ports, serviceMap, selectedProject]);

  const header = (
    <div className="flex items-center justify-between mb-3 px-2">
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
        Running Services
        {selectedProject && (
          <span className="font-normal normal-case tracking-normal ml-1 text-gray-400">
            ({selectedProject.folder})
          </span>
        )}
      </h3>
      <button
        onClick={onRefresh}
        className="text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="Refresh services"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
    </div>
  );

  if (ports.length === 0) {
    return (
      <div className="mt-8">
        {header}
        <p className="px-2 text-[12px] text-gray-500">
          {selectedProject
            ? "No services for this folder"
            : "No services detected"}
        </p>
      </div>
    );
  }

  const groupKeys = Object.keys(groupedPorts).sort((a, b) => {
    if (a === "OTHER") return 1;
    if (b === "OTHER") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="mt-8">
      {header}
      {groupKeys.map((group) => (
        <div key={group} className="mb-3">
          <div className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-2 mb-1">
            {group}
          </div>
          <div className="space-y-1.5 px-2">
            {groupedPorts[group].slice(0, 10).map(({ port, serviceName }) => {
              const isStarred = starredPorts.has(port.port);
              return (
                <div key={port.port}>
                  <div className="flex items-center text-[12px] text-gray-500 dark:text-gray-400">
                    {/* Star button */}
                    <button
                      onClick={() => {
                        if (isStarred) {
                          handleUnstar(port.port);
                        } else {
                          setStarForm({
                            port: port.port,
                            name: port.service_name || port.process_name || "",
                            remoteUrl: "",
                          });
                        }
                      }}
                      className={`mr-1.5 shrink-0 transition-colors ${
                        isStarred
                          ? "text-yellow-400 hover:text-yellow-300"
                          : "text-gray-400 dark:text-gray-600 hover:text-yellow-400"
                      }`}
                      title={isStarred ? "Unstar service" : "Star service"}
                    >
                      {isStarred ? (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                      )}
                    </button>
                    <span
                      className={`w-2 h-2 rounded-full mr-2 shrink-0 ${
                        port.service_name
                          ? "bg-app-success"
                          : "bg-gray-500 dark:bg-gray-600"
                      }`}
                    />
                    <span className="font-mono text-gray-600 dark:text-gray-300">
                      :{port.port}
                    </span>
                    <span
                      className={`ml-2 truncate ${
                        port.service_name
                          ? "text-blue-500 dark:text-blue-400"
                          : ""
                      }`}
                    >
                      {serviceName}
                    </span>
                  </div>

                  {/* Inline star form */}
                  {starForm && starForm.port === port.port && (
                    <div className="ml-5 mt-1.5 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border border-light-border dark:border-app-border">
                      <input
                        type="text"
                        value={starForm.name}
                        onChange={(e) =>
                          setStarForm({ ...starForm, name: e.target.value })
                        }
                        placeholder="Service name"
                        className="block w-full mb-1.5 px-2 py-1 text-[11px] bg-white dark:bg-app-bg border border-light-border dark:border-app-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="text"
                        value={starForm.remoteUrl}
                        onChange={(e) =>
                          setStarForm({
                            ...starForm,
                            remoteUrl: e.target.value,
                          })
                        }
                        placeholder="e.g. api.staging.example.com"
                        className="block w-full mb-1.5 px-2 py-1 text-[11px] bg-white dark:bg-app-bg border border-light-border dark:border-app-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex space-x-1.5">
                        <button
                          onClick={() => handleStar(starForm)}
                          disabled={
                            !starForm.name.trim() || !starForm.remoteUrl.trim()
                          }
                          className="px-2 py-0.5 text-[10px] bg-primary text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setStarForm(null)}
                          className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
