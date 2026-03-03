import { useState, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ProjectList } from "./components/ProjectList";
import { EnvEditor } from "./components/EnvEditor";
import { ServiceStatus } from "./components/ServiceStatus";
import { DiffView } from "./components/DiffView";
import { useProjects } from "./hooks/useProjects";
import { useEnvEntries } from "./hooks/useEnvEntries";
import { usePorts } from "./hooks/usePorts";
import { useTheme } from "./hooks/useTheme";
import { useDefaultBaseline } from "./hooks/useDefaultBaseline";
import { useServiceMap } from "./hooks/useServiceMap";
import type { Project } from "./types";

function App() {
  const { folders, projects, loading, addFolder, removeFolder, refresh } =
    useProjects();
  const {
    entries,
    pendingChanges,
    loadEntries,
    stageChange,
    saveChanges,
    discardChanges,
    handleToggleUrl,
  } = useEnvEntries();
  const { ports, refresh: refreshPorts } = usePorts();
  const { theme, toggle: toggleTheme } = useTheme();
  const { getDefault, setDefault, clearDefault, hasDefault } =
    useDefaultBaseline();
  const { serviceMap, refresh: refreshServiceMap } = useServiceMap();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [search, setSearch] = useState("");

  const handleSelectFile = useCallback(
    (project: Project, file: string) => {
      setSelectedProject(project);
      setSelectedFile(file);
      loadEntries(project.path);
      setShowDiff(false);
    },
    [loadEntries],
  );

  const handleAddFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      await addFolder(selected as string);
    }
  }, [addFolder]);

  const handleSave = useCallback(async () => {
    await saveChanges();
    if (selectedProject) {
      loadEntries(selectedProject.path);
    }
  }, [saveChanges, selectedProject, loadEntries]);

  const handleDiscard = useCallback(async () => {
    if (selectedProject) {
      await discardChanges(selectedProject.path);
    }
  }, [selectedProject, discardChanges]);

  const handleSetDefault = useCallback(() => {
    if (selectedProject) {
      setDefault(selectedProject.path, entries);
    }
  }, [selectedProject, entries, setDefault]);

  const handleClearDefault = useCallback(() => {
    if (selectedProject) {
      clearDefault(selectedProject.path);
    }
  }, [selectedProject, clearDefault]);

  // Compute diff data: compare against default baseline or pending changes
  const diffData = useMemo(() => {
    if (!selectedProject) return pendingChanges;

    const baseline = getDefault(selectedProject.path);
    if (!baseline) return pendingChanges;

    // Compare current entries against stored default
    const diff = new Map<string, { original: string; current: string }>();
    for (const entry of entries) {
      if (entry.is_comment) continue;
      const cellId = `${entry.file}::${entry.key}`;
      const defaultValue = baseline.get(cellId);
      if (defaultValue !== undefined && defaultValue !== entry.value) {
        diff.set(cellId, { original: defaultValue, current: entry.value });
      }
    }
    return diff;
  }, [selectedProject, entries, pendingChanges, getDefault]);

  const projectHasDefault =
    selectedProject != null && hasDefault(selectedProject.path);
  const hasDiffableChanges = diffData.size > 0;

  // Compute running services for toggle dropdown: all running ports
  const folderServices = useMemo(() => {
    if (!selectedProject) return [];

    const seen = new Set<number>();
    const services: { name: string; port: number; localUrl: string }[] = [];

    // 1. Service map entries that are currently running (richer names)
    if (serviceMap) {
      for (const mapping of serviceMap.services) {
        const portMatch = mapping.local_url.match(/:(\d+)/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1], 10);
        if (!ports.some((p) => p.port === port)) continue;

        services.push({ name: mapping.name, port, localUrl: mapping.local_url });
        seen.add(port);
      }
    }

    // 2. All remaining running ports
    for (const p of ports) {
      if (seen.has(p.port)) continue;
      services.push({
        name: p.service_name || p.process_name,
        port: p.port,
        localUrl: `http://localhost:${p.port}`,
      });
    }

    return services;
  }, [selectedProject, serviceMap, ports]);

  const filteredProjects = search
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.folder.toLowerCase().includes(search.toLowerCase()),
      )
    : projects;

  return (
    <div className="flex h-screen flex-col bg-light-base text-gray-700 dark:bg-app-bg dark:text-gray-300 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 border-b border-light-border dark:border-app-border flex items-center justify-between px-4 bg-light-surface dark:bg-app-sidebar shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white font-bold text-sm">
              EM
            </div>
            <h1 className="font-bold text-gray-900 dark:text-white tracking-tight">
              Env Manager
            </h1>
          </div>
          <div className="h-6 w-[1px] bg-light-border dark:bg-app-border mx-2" />
          <div className="flex space-x-1">
            <button
              onClick={refresh}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
            >
              Scan
            </button>
          </div>
        </div>

        {/* Center search */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="block w-full pl-10 pr-3 py-1.5 bg-white dark:bg-app-bg border border-light-border dark:border-app-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-xs text-gray-500">
            Folders:{" "}
            {folders.map((f) => (
              <span key={f.path} className="mr-2">
                <span className="text-gray-700 dark:text-gray-300">
                  {f.name}
                </span>
                <span
                  onClick={() => removeFolder(f.path)}
                  className="text-app-danger cursor-pointer ml-1"
                  title="Remove folder"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
          <button
            onClick={handleAddFolder}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>Add Folder</span>
          </button>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded border border-light-border dark:border-app-border text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-light-surface dark:bg-app-sidebar border-r border-light-border dark:border-app-border flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-4">
            <ProjectList
              projects={filteredProjects}
              loading={loading}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
            />
            <ServiceStatus
              ports={ports}
              serviceMap={serviceMap}
              projects={projects}
              entries={entries}
              selectedProject={selectedProject}
              onRefresh={refreshPorts}
              onServiceMapChange={refreshServiceMap}
            />
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedProject ? (
            <>
              {/* Top actions bar */}
              <div className="h-12 border-b border-light-border dark:border-app-border flex items-center justify-between px-6 bg-light-card dark:bg-app-card shrink-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-gray-900 dark:text-white font-semibold">
                    {selectedProject.name}
                  </h2>
                  <span className="text-gray-400 dark:text-gray-600">/</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    {selectedFile
                      ? selectedFile.split("/").pop()
                      : "All files"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <EnvEditor
                  entries={entries}
                  project={selectedProject}
                  selectedFile={selectedFile}
                  ports={ports}
                  serviceMap={serviceMap}
                  folderServices={folderServices}
                  onStageChange={stageChange}
                  onToggleUrl={handleToggleUrl}
                />
              </div>

              {/* Footer */}
              <footer className="h-16 border-t border-light-border dark:border-app-border bg-light-card dark:bg-app-card flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSave}
                    disabled={pendingChanges.size === 0}
                    className="px-6 py-2 rounded bg-primary hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save Changes
                    {pendingChanges.size > 0 && (
                      <span className="ml-2 bg-white/20 rounded-full px-2 py-0.5 text-xs">
                        {pendingChanges.size}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleDiscard}
                    disabled={pendingChanges.size === 0}
                    className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <div className="h-6 w-[1px] bg-light-border dark:bg-app-border mx-1" />
                  <button
                    onClick={handleSetDefault}
                    className="px-4 py-2 rounded border border-light-border dark:border-app-border hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium transition-colors"
                  >
                    Set as Default
                  </button>
                  {projectHasDefault && (
                    <button
                      onClick={handleClearDefault}
                      className="text-xs text-gray-500 hover:text-app-danger transition-colors underline"
                    >
                      Clear Default
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowDiff(true)}
                  disabled={!hasDiffableChanges}
                  className="px-8 py-2 rounded border border-primary text-primary hover:bg-primary/10 text-sm font-bold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Diff Changes
                </button>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <p className="text-lg">Select a project from the sidebar</p>
                <p className="mt-2 text-sm">
                  {projects.length === 0
                    ? "Add a scan folder to get started"
                    : `${projects.length} projects found`}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Diff overlay */}
      {showDiff && (
        <DiffView
          pendingChanges={diffData}
          baselineLabel={projectHasDefault ? "default" : "disk"}
          onClose={() => setShowDiff(false)}
          onApply={async () => {
            await handleSave();
            setShowDiff(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
