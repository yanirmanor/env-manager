import { useCallback, useEffect, useState } from "react";
import type { Project, ScanFolder } from "../types";
import {
  getScanFolders,
  addScanFolder,
  removeScanFolder,
  scanProjects,
} from "../lib/tauri";

export function useProjects() {
  const [folders, setFolders] = useState<ScanFolder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFolders = useCallback(async () => {
    const f = await getScanFolders();
    setFolders(f);
    return f;
  }, []);

  const loadProjects = useCallback(async (folders: ScanFolder[]) => {
    setLoading(true);
    const allProjects: Project[] = [];
    for (const folder of folders) {
      const p = await scanProjects(folder.path);
      allProjects.push(...p);
    }
    setProjects(allProjects);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const f = await loadFolders();
    await loadProjects(f);
  }, [loadFolders, loadProjects]);

  const addFolder = useCallback(
    async (path: string) => {
      await addScanFolder(path);
      await refresh();
    },
    [refresh],
  );

  const removeFolder = useCallback(
    async (path: string) => {
      await removeScanFolder(path);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { folders, projects, loading, addFolder, removeFolder, refresh };
}
