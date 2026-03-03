import { useState, useMemo } from "react";
import type { Project } from "../types";

const STATUS_COLORS: Record<string, string> = {
  AllLocal: "bg-app-success",
  AllRemote: "bg-app-remote",
  Mixed: "bg-app-warning",
  NoUrls: "bg-gray-500",
};

interface ProjectListProps {
  projects: Project[];
  loading: boolean;
  selectedFile: string | null;
  onSelectFile: (project: Project, file: string) => void;
}

export function ProjectList({
  projects,
  loading,
  selectedFile,
  onSelectFile,
}: ProjectListProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [nested, setNested] = useState(true);

  // Flat file list: all .env files across all projects (must be before early returns)
  const flatFiles = useMemo(() => {
    const items: { file: string; fileName: string; projectName: string; project: Project }[] = [];
    for (const project of projects) {
      for (const file of project.env_files) {
        const fileName = file.split("/").pop() || file;
        items.push({ file, fileName, projectName: project.name, project });
      }
    }
    items.sort((a, b) => {
      if (a.fileName === ".env" && b.fileName !== ".env") return -1;
      if (a.fileName !== ".env" && b.fileName === ".env") return 1;
      const nameCompare = a.fileName.localeCompare(b.fileName);
      if (nameCompare !== 0) return nameCompare;
      return a.projectName.localeCompare(b.projectName);
    });
    return items;
  }, [projects]);

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">Scanning...</div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No projects found. Add a scan folder.
      </div>
    );
  }

  const toggleProject = (path: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Sort env files: .env first, then alphabetical
  const sortEnvFiles = (files: string[]) => {
    return [...files].sort((a, b) => {
      const nameA = a.split("/").pop() || a;
      const nameB = b.split("/").pop() || b;
      if (nameA === ".env") return -1;
      if (nameB === ".env") return 1;
      return nameA.localeCompare(nameB);
    });
  };

  // Check if any file of a project is selected
  const isProjectSelected = (project: Project) =>
    project.env_files.some((f) => f === selectedFile);

  // Group by folder
  const grouped = projects.reduce<Record<string, Project[]>>((acc, p) => {
    (acc[p.folder] ||= []).push(p);
    return acc;
  }, {});

  const renderProject = (project: Project) => {
    const isExpanded = expandedProjects.has(project.path);
    const isActive = isProjectSelected(project);
    const sortedFiles = sortEnvFiles(project.env_files);

    return (
      <div key={project.path}>
        {/* Project row */}
        <button
          onClick={() => {
            toggleProject(project.path);
            // Auto-select if only 1 env file
            if (!expandedProjects.has(project.path) && sortedFiles.length === 1) {
              onSelectFile(project, sortedFiles[0]);
            }
          }}
          className={`flex w-full items-center justify-between px-2 py-1.5 rounded text-sm group transition-colors ${
            isActive
              ? "text-gray-900 dark:text-white bg-primary/10 dark:bg-primary/10 border-l-2 border-primary"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
          }`}
        >
          <span className="flex items-center min-w-0">
            <span
              className={`w-2 h-2 rounded-full mr-2 shrink-0 ${STATUS_COLORS[project.status]}`}
            />
            <span className="truncate">{project.name}</span>
          </span>
          <span
            className={`text-[10px] shrink-0 ml-1 ${
              isActive
                ? "bg-primary text-white px-1.5 rounded-full"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {project.env_files.length}
          </span>
        </button>

        {/* Env file list */}
        {isExpanded && (
          <div className="ml-4 mt-0.5 mb-1 space-y-0.5">
            {sortedFiles.map((file) => {
              const fileName = file.split("/").pop() || file;
              const isSelected = selectedFile === file;

              return (
                <button
                  key={file}
                  onClick={() => onSelectFile(project, file)}
                  className={`flex w-full items-center px-2 py-1 rounded text-xs font-mono transition-colors ${
                    isSelected
                      ? "text-primary font-semibold bg-primary/5"
                      : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  {fileName}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6">
      {/* Flat / Grouped toggle */}
      <div className="flex items-center justify-between mb-3 px-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Projects
        </span>
        <button
          onClick={() => setNested(!nested)}
          className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
          title={nested ? "Switch to flat file view" : "Switch to grouped view"}
        >
          {nested ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 7h4m4 0h10M3 12h4m4 0h10M3 17h4m4 0h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          )}
          {nested ? "Flat" : "Group"}
        </button>
      </div>

      {nested ? (
        /* Grouped view: folder headings → projects → files */
        Object.entries(grouped).map(([folder, folderProjects]) => (
          <div key={folder} className="mb-4">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">
              {folder}
            </h3>
            <nav className="space-y-0.5">
              {folderProjects.map(renderProject)}
            </nav>
          </div>
        ))
      ) : (
        /* Flat view: all .env files with project names */
        <nav className="space-y-0.5">
          {flatFiles.map((item) => {
            const isSelected = selectedFile === item.file;
            return (
              <button
                key={item.file}
                onClick={() => onSelectFile(item.project, item.file)}
                className={`flex w-full items-center justify-between px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                  isSelected
                    ? "text-primary font-semibold bg-primary/5"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                <span className="truncate">
                  {item.fileName}{" "}
                  <span className="text-gray-400 dark:text-gray-600 font-sans">
                    ({item.projectName})
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
