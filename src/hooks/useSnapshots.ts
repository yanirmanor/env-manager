import { useCallback, useEffect, useState } from "react";
import type { SnapshotInfo } from "../types";
import {
  listSnapshots,
  saveSnapshot,
  restoreSnapshot,
} from "../lib/tauri";

export function useSnapshots() {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const s = await listSnapshots();
    setSnapshots(s);
    setLoading(false);
  }, []);

  const save = useCallback(
    async (name: string) => {
      await saveSnapshot(name);
      await refresh();
    },
    [refresh],
  );

  const restore = useCallback(
    async (name: string) => {
      await restoreSnapshot(name);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { snapshots, loading, save, restore, refresh };
}
