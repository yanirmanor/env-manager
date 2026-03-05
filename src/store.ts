import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type {
  ScanFolder,
  Project,
  EnvEntry,
  PortStatus,
  ServiceMap,
  PendingChange,
  Toast,
  Change,
} from "./types";
import {
  getScanFolders,
  addScanFolder,
  removeScanFolder,
  scanProjects,
  getEnvEntries,
  updateEntry,
  toggleUrl,
  toggleBulk,
  scanPorts,
  getServiceMap,
} from "./lib/tauri";

// Module-level runtime state (not serializable, not store state)
let portIntervalHandle: ReturnType<typeof setInterval> | null = null;
let nextToastId = 0;

interface AppState {
  // Projects slice
  folders: ScanFolder[];
  projects: Project[];
  projectsLoading: boolean;
  refreshProjects: () => Promise<void>;
  addFolder: (path: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;

  // Entries slice
  entries: EnvEntry[];
  pendingChanges: Record<string, PendingChange>;
  entriesLoading: boolean;
  loadEntries: (project: string) => Promise<void>;
  stageChange: (file: string, key: string, newValue: string) => void;
  saveChanges: () => Promise<void>;
  discardChanges: (project: string) => Promise<void>;
  handleToggleUrl: (
    file: string,
    key: string,
    direction: string,
  ) => Promise<void>;
  handleToggleBulk: (project: string, direction: string) => Promise<void>;

  // Ports slice
  ports: PortStatus[];
  portsLoading: boolean;
  refreshPorts: () => Promise<void>;
  startPortPolling: () => void;
  stopPortPolling: () => void;

  // Theme slice
  theme: "light" | "dark";
  toggleTheme: () => void;

  // Baseline slice
  baselines: Record<string, [string, string][]>;
  setBaseline: (projectPath: string, entries: EnvEntry[]) => void;
  getBaseline: (projectPath: string) => Map<string, string> | null;
  hasBaseline: (projectPath: string) => boolean;
  clearBaseline: (projectPath: string) => void;

  // ServiceMap slice
  serviceMap: ServiceMap | null;
  refreshServiceMap: () => Promise<void>;

  // Toast slice
  toasts: Toast[];
  showToast: (message: string, type?: "success" | "error") => void;
  dismissToast: (id: number) => void;

  // UI slice
  selectedProject: Project | null;
  selectedFile: string | null;
  diffMode: "changes" | "default" | null;
  search: string;
  restoredDefault: boolean;
  selectFile: (project: Project, file: string) => Promise<void>;
  setDiffMode: (mode: "changes" | "default" | null) => void;
  setSearch: (search: string) => void;
  setRestoredDefault: (restored: boolean) => void;
}

/** Apply a pending change inside an immer draft. Shared by stageChange and handleToggleUrl. */
function applyPending(
  s: AppState,
  file: string,
  key: string,
  newValue: string,
  originalOverride?: string,
) {
  const changeKey = `${file}::${key}`;
  const entry = s.entries.find((e) => e.file === file && e.key === key);
  const existing = s.pendingChanges[changeKey];
  const original =
    originalOverride ?? existing?.original ?? entry?.value ?? "";

  if (newValue === original) {
    delete s.pendingChanges[changeKey];
  } else {
    s.pendingChanges[changeKey] = { original, current: newValue };
  }

  if (entry) entry.value = newValue;
}

export const useStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // ---------- Projects ----------
        folders: [],
        projects: [],
        projectsLoading: true,

        refreshProjects: async () => {
          const folders = await getScanFolders();
          const results = await Promise.all(
            folders.map((f) => scanProjects(f.path)),
          );
          set((s) => {
            s.folders = folders;
            s.projects = results.flat();
            s.projectsLoading = false;
          });
        },

        addFolder: async (path) => {
          await addScanFolder(path);
          await get().refreshProjects();
        },

        removeFolder: async (path) => {
          await removeScanFolder(path);
          await get().refreshProjects();
        },

        // ---------- Entries ----------
        entries: [],
        pendingChanges: {},
        entriesLoading: false,

        loadEntries: async (project) => {
          set((s) => {
            s.entriesLoading = true;
            s.pendingChanges = {};
          });
          const e = await getEnvEntries(project);
          set((s) => {
            s.entries = e;
            s.entriesLoading = false;
          });
        },

        stageChange: (file, key, newValue) => {
          set((s) => applyPending(s, file, key, newValue));
        },

        saveChanges: async () => {
          const pending = get().pendingChanges;
          for (const [changeKey, change] of Object.entries(pending)) {
            const [file, key] = changeKey.split("::");
            await updateEntry(file, key, change.current);
          }
          set((s) => {
            s.pendingChanges = {};
          });
        },

        discardChanges: async (project) => {
          const pending = get().pendingChanges;
          for (const [changeKey, change] of Object.entries(pending)) {
            const [file, key] = changeKey.split("::");
            await updateEntry(file, key, change.original);
          }
          await get().loadEntries(project);
        },

        handleToggleUrl: async (file, key, direction) => {
          // Capture original before the async toggle so we track the pre-toggle value
          const entry = get().entries.find(
            (e) => e.file === file && e.key === key,
          );
          const originalValue = entry?.value;
          const newValue = await toggleUrl(file, key, direction);
          set((s) => applyPending(s, file, key, newValue, originalValue));
        },

        handleToggleBulk: async (project, direction) => {
          const changes: Change[] = await toggleBulk(project, direction);
          set((s) => {
            for (const entry of s.entries) {
              const change = changes.find(
                (c) => c.file === entry.file && c.key === entry.key,
              );
              if (change) entry.value = change.new_value;
            }
          });
        },

        // ---------- Ports ----------
        ports: [],
        portsLoading: false,

        refreshPorts: async () => {
          set((s) => {
            s.portsLoading = true;
          });
          const p = await scanPorts();
          set((s) => {
            s.ports = p;
            s.portsLoading = false;
          });
        },

        startPortPolling: () => {
          if (portIntervalHandle) clearInterval(portIntervalHandle);
          get().refreshPorts();
          portIntervalHandle = setInterval(() => get().refreshPorts(), 10000);
        },

        stopPortPolling: () => {
          if (portIntervalHandle) {
            clearInterval(portIntervalHandle);
            portIntervalHandle = null;
          }
        },

        // ---------- Theme ----------
        theme: "dark" as "light" | "dark",

        toggleTheme: () => {
          set((s) => {
            s.theme = s.theme === "dark" ? "light" : "dark";
          });
        },

        // ---------- Baseline ----------
        baselines: {},

        setBaseline: (projectPath, entries) => {
          set((s) => {
            s.baselines[projectPath] = entries
              .filter((e) => !e.is_comment)
              .map((e) => [`${e.file}::${e.key}`, e.value]);
          });
        },

        getBaseline: (projectPath) => {
          const data = get().baselines[projectPath];
          if (!data) return null;
          return new Map(data);
        },

        hasBaseline: (projectPath) => {
          return projectPath in get().baselines;
        },

        clearBaseline: (projectPath) => {
          set((s) => {
            delete s.baselines[projectPath];
          });
        },

        // ---------- ServiceMap ----------
        serviceMap: null,

        refreshServiceMap: async () => {
          try {
            const map = await getServiceMap();
            set((s) => {
              s.serviceMap = map;
            });
          } catch {
            set((s) => {
              s.serviceMap = null;
            });
          }
        },

        // ---------- Toast ----------
        toasts: [],

        showToast: (message, type = "success") => {
          const id = ++nextToastId;
          set((s) => {
            s.toasts.push({ id, message, type });
          });
          setTimeout(() => {
            set((s) => {
              s.toasts = s.toasts.filter((t) => t.id !== id);
            });
          }, 3000);
        },

        dismissToast: (id) => {
          set((s) => {
            s.toasts = s.toasts.filter((t) => t.id !== id);
          });
        },

        // ---------- UI ----------
        selectedProject: null,
        selectedFile: null,
        diffMode: null,
        search: "",
        restoredDefault: false,

        selectFile: async (project, file) => {
          set((s) => {
            s.selectedProject = project;
            s.selectedFile = file;
            s.diffMode = null;
            s.restoredDefault = false;
          });
          await get().loadEntries(project.path);
        },

        setDiffMode: (mode) => {
          set((s) => {
            s.diffMode = mode;
          });
        },

        setSearch: (search) => {
          set((s) => {
            s.search = search;
          });
        },

        setRestoredDefault: (restored) => {
          set((s) => {
            s.restoredDefault = restored;
          });
        },
      })),
      {
        name: "env-manager-storage",
        partialize: (state) => ({
          theme: state.theme,
          baselines: state.baselines,
        }),
      },
    ),
  ),
);

// Sync theme to DOM at module scope
const syncTheme = (theme: "light" | "dark") => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

// Initial sync
syncTheme(useStore.getState().theme);

// Subscribe to theme changes
useStore.subscribe(
  (s) => s.theme,
  (theme) => syncTheme(theme),
);
