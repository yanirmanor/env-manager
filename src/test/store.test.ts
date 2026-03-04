import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store";
import type { EnvEntry, Project, ScanFolder, PortStatus, ServiceMap } from "../types";

const mockInvoke = vi.mocked(invoke);

// Helper to reset the store between tests
function resetStore() {
  useStore.setState(useStore.getInitialState());
  localStorage.clear();
}

const mockFolder: ScanFolder = { path: "/test/folder", name: "folder" };
const mockProject: Project = {
  name: "test-project",
  path: "/test/folder/project",
  env_files: [".env"],
  folder: "/test/folder",
  status: "NoUrls",
};

const mockEntries: EnvEntry[] = [
  {
    key: "API_URL",
    value: "http://remote.com",
    file: "/test/.env",
    line_number: 1,
    category: "Url",
    is_comment: false,
    raw_line: "API_URL=http://remote.com",
    is_url: true,
    url_direction: "Staging",
  },
  {
    key: "PORT",
    value: "3000",
    file: "/test/.env",
    line_number: 2,
    category: "Port",
    is_comment: false,
    raw_line: "PORT=3000",
    is_url: false,
    url_direction: null,
  },
];

const mockPorts: PortStatus[] = [
  { port: 3000, process_name: "node", pid: 1234, service_name: "api" },
];

const mockServiceMap: ServiceMap = {
  services: [
    {
      name: "api",
      remote_url: "http://remote.com",
      local_url: "http://localhost:3000",
      env_keys: ["API_URL"],
    },
  ],
  ignore_domains: [],
};

describe("Store", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    useStore.getState().stopPortPolling();
    vi.useRealTimers();
  });

  // ---------- Projects slice ----------
  describe("Projects slice", () => {
    it("refreshProjects loads folders and projects", async () => {
      mockInvoke
        .mockResolvedValueOnce([mockFolder]) // get_scan_folders
        .mockResolvedValueOnce([mockProject]); // scan_projects

      await useStore.getState().refreshProjects();

      const state = useStore.getState();
      expect(state.folders).toEqual([mockFolder]);
      expect(state.projects).toEqual([mockProject]);
      expect(state.projectsLoading).toBe(false);
    });

    it("addFolder calls Tauri and refreshes", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // add_scan_folder
        .mockResolvedValueOnce([mockFolder]) // get_scan_folders
        .mockResolvedValueOnce([mockProject]); // scan_projects

      await useStore.getState().addFolder("/test/folder");

      expect(mockInvoke).toHaveBeenCalledWith("add_scan_folder", {
        path: "/test/folder",
      });
      expect(useStore.getState().folders).toEqual([mockFolder]);
    });

    it("removeFolder calls Tauri and refreshes", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // remove_scan_folder
        .mockResolvedValueOnce([]) // get_scan_folders
        .mockResolvedValueOnce([]); // scan_projects

      await useStore.getState().removeFolder("/test/folder");

      expect(mockInvoke).toHaveBeenCalledWith("remove_scan_folder", {
        path: "/test/folder",
      });
      expect(useStore.getState().projects).toEqual([]);
    });
  });

  // ---------- Entries slice ----------
  describe("Entries slice", () => {
    it("loadEntries fetches entries and clears pending changes", async () => {
      vi.useRealTimers();

      // Pre-populate some pending changes
      useStore.setState({
        pendingChanges: { "file::key": { original: "a", current: "b" } },
      });

      // Verify invoke is properly mocked
      vi.resetAllMocks();
      mockInvoke.mockResolvedValue(mockEntries);

      // Call loadEntries and verify
      const promise = useStore.getState().loadEntries("/test/project");
      await promise;

      expect(mockInvoke).toHaveBeenCalledWith("get_env_entries", {
        project: "/test/project",
      });
      expect(useStore.getState().pendingChanges).toEqual({});
      expect(useStore.getState().entriesLoading).toBe(false);
      expect(useStore.getState().entries.length).toBe(2);
      expect(useStore.getState().entries[0].key).toBe("API_URL");
      vi.useFakeTimers();
    });

    it("stageChange tracks pending change", () => {
      useStore.setState({ entries: mockEntries });

      useStore.getState().stageChange("/test/.env", "API_URL", "http://new.com");

      const pending = useStore.getState().pendingChanges;
      expect(pending["/test/.env::API_URL"]).toEqual({
        original: "http://remote.com",
        current: "http://new.com",
      });
    });

    it("stageChange reverts when value matches original", () => {
      useStore.setState({ entries: mockEntries });

      // Stage a change
      useStore.getState().stageChange("/test/.env", "API_URL", "http://new.com");
      expect(
        Object.keys(useStore.getState().pendingChanges).length,
      ).toBe(1);

      // Revert to original
      useStore.getState().stageChange("/test/.env", "API_URL", "http://remote.com");
      expect(
        Object.keys(useStore.getState().pendingChanges).length,
      ).toBe(0);
    });

    it("saveChanges writes all pending changes via Tauri and clears them", async () => {
      useStore.setState({
        entries: mockEntries,
        pendingChanges: {
          "/test/.env::API_URL": {
            original: "http://remote.com",
            current: "http://localhost:3000",
          },
        },
      });

      mockInvoke.mockResolvedValue(undefined);

      await useStore.getState().saveChanges();

      expect(mockInvoke).toHaveBeenCalledWith("update_entry", {
        file: "/test/.env",
        key: "API_URL",
        value: "http://localhost:3000",
      });
      expect(useStore.getState().pendingChanges).toEqual({});
    });

    it("discardChanges reverts changes on disk and reloads", async () => {
      useStore.setState({
        entries: mockEntries,
        pendingChanges: {
          "/test/.env::API_URL": {
            original: "http://remote.com",
            current: "http://localhost:3000",
          },
        },
      });

      mockInvoke
        .mockResolvedValueOnce(undefined) // updateEntry (revert)
        .mockResolvedValueOnce(mockEntries); // getEnvEntries (reload)

      await useStore.getState().discardChanges("/test/project");

      // Should revert to original
      expect(mockInvoke).toHaveBeenCalledWith("update_entry", {
        file: "/test/.env",
        key: "API_URL",
        value: "http://remote.com",
      });
      expect(useStore.getState().pendingChanges).toEqual({});
    });

    it("toggleUrl updates entry and tracks pending change", async () => {
      useStore.setState({ entries: mockEntries });

      mockInvoke.mockResolvedValueOnce("http://localhost:3000");

      await useStore.getState().handleToggleUrl("/test/.env", "API_URL", "local");

      expect(mockInvoke).toHaveBeenCalledWith("toggle_url", {
        file: "/test/.env",
        key: "API_URL",
        direction: "local",
      });

      const pending = useStore.getState().pendingChanges;
      expect(pending["/test/.env::API_URL"]).toEqual({
        original: "http://remote.com",
        current: "http://localhost:3000",
      });
    });
  });

  // ---------- Ports slice ----------
  describe("Ports slice", () => {
    it("refreshPorts fetches port list", async () => {
      mockInvoke.mockResolvedValueOnce(mockPorts);

      await useStore.getState().refreshPorts();

      expect(useStore.getState().ports).toEqual(mockPorts);
      expect(useStore.getState().portsLoading).toBe(false);
    });

    it("startPortPolling sets up interval; cleanup stops it", async () => {
      mockInvoke.mockResolvedValue(mockPorts);

      useStore.getState().startPortPolling();

      // Initial call
      await vi.advanceTimersByTimeAsync(0);
      expect(mockInvoke).toHaveBeenCalledWith("scan_ports");

      // After 10 seconds
      const callsBefore = mockInvoke.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockInvoke.mock.calls.length).toBeGreaterThan(callsBefore);

      // Stop polling
      useStore.getState().stopPortPolling();
      const callsAfterStop = mockInvoke.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockInvoke.mock.calls.length).toBe(callsAfterStop);
    });
  });

  // ---------- Theme slice ----------
  describe("Theme slice", () => {
    it("toggleTheme switches between light and dark", () => {
      useStore.setState({ theme: "dark" });

      useStore.getState().toggleTheme();
      expect(useStore.getState().theme).toBe("light");

      useStore.getState().toggleTheme();
      expect(useStore.getState().theme).toBe("dark");
    });
  });

  // ---------- Baseline slice ----------
  describe("Baseline slice", () => {
    it("setBaseline stores baseline entries", () => {
      useStore.getState().setBaseline("/project", mockEntries);

      expect(useStore.getState().baselines["/project"]).toEqual([
        ["/test/.env::API_URL", "http://remote.com"],
        ["/test/.env::PORT", "3000"],
      ]);
    });

    it("getBaseline returns Map from stored data", () => {
      useStore.getState().setBaseline("/project", mockEntries);

      const baseline = useStore.getState().getBaseline("/project");
      expect(baseline).toBeInstanceOf(Map);
      expect(baseline?.get("/test/.env::API_URL")).toBe("http://remote.com");
    });

    it("hasBaseline / clearBaseline work correctly", () => {
      expect(useStore.getState().hasBaseline("/project")).toBe(false);

      useStore.getState().setBaseline("/project", mockEntries);
      expect(useStore.getState().hasBaseline("/project")).toBe(true);

      useStore.getState().clearBaseline("/project");
      expect(useStore.getState().hasBaseline("/project")).toBe(false);
    });
  });

  // ---------- ServiceMap slice ----------
  describe("ServiceMap slice", () => {
    it("refreshServiceMap fetches service map", async () => {
      mockInvoke.mockResolvedValueOnce(mockServiceMap);

      await useStore.getState().refreshServiceMap();

      expect(useStore.getState().serviceMap).toEqual(mockServiceMap);
    });

    it("refreshServiceMap sets null on error", async () => {
      useStore.setState({ serviceMap: mockServiceMap });
      mockInvoke.mockRejectedValueOnce(new Error("fail"));

      await useStore.getState().refreshServiceMap();

      expect(useStore.getState().serviceMap).toBeNull();
    });
  });

  // ---------- Toast slice ----------
  describe("Toast slice", () => {
    it("showToast adds toast, auto-removes after timeout", async () => {
      useStore.getState().showToast("Hello");

      expect(useStore.getState().toasts).toHaveLength(1);
      expect(useStore.getState().toasts[0].message).toBe("Hello");
      expect(useStore.getState().toasts[0].type).toBe("success");

      await vi.advanceTimersByTimeAsync(3000);
      expect(useStore.getState().toasts).toHaveLength(0);
    });

    it("dismissToast removes immediately", () => {
      useStore.getState().showToast("Hello");
      const id = useStore.getState().toasts[0].id;

      useStore.getState().dismissToast(id);

      expect(useStore.getState().toasts).toHaveLength(0);
    });
  });

  // ---------- UI slice ----------
  describe("UI slice", () => {
    it("selectFile sets project, file, resets diff/restored flags, and loads entries", async () => {
      mockInvoke.mockResolvedValueOnce(mockEntries);

      useStore.setState({ showDiff: true, restoredDefault: true });

      useStore.getState().selectFile(mockProject, ".env");

      const state = useStore.getState();
      expect(state.selectedProject).toEqual(mockProject);
      expect(state.selectedFile).toBe(".env");
      expect(state.showDiff).toBe(false);
      expect(state.restoredDefault).toBe(false);
    });
  });

  // ---------- Apply Changes bug regression test ----------
  describe("Apply Changes bug fix", () => {
    it("saveChanges reads from pendingChanges (no args), writes to Tauri, and clears", async () => {
      useStore.setState({
        entries: mockEntries,
        pendingChanges: {
          "/test/.env::API_URL": {
            original: "http://remote.com",
            current: "http://localhost:3000",
          },
          "/test/.env::PORT": {
            original: "3000",
            current: "4000",
          },
        },
      });

      mockInvoke.mockResolvedValue(undefined);

      await useStore.getState().saveChanges();

      // Verify both entries were written
      expect(mockInvoke).toHaveBeenCalledWith("update_entry", {
        file: "/test/.env",
        key: "API_URL",
        value: "http://localhost:3000",
      });
      expect(mockInvoke).toHaveBeenCalledWith("update_entry", {
        file: "/test/.env",
        key: "PORT",
        value: "4000",
      });

      // Pending changes should be empty
      expect(useStore.getState().pendingChanges).toEqual({});
    });
  });
});
