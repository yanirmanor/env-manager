import { useCallback, useState } from "react";
import type { EnvEntry, Change } from "../types";
import {
  getEnvEntries,
  updateEntry,
  toggleUrl,
  toggleBulk,
} from "../lib/tauri";

export function useEnvEntries() {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, { original: string; current: string }>
  >(new Map());

  const loadEntries = useCallback(async (project: string) => {
    setLoading(true);
    setPendingChanges(new Map());
    const e = await getEnvEntries(project);
    setEntries(e);
    setLoading(false);
  }, []);

  const stageChange = useCallback(
    (file: string, key: string, newValue: string) => {
      const entry = entries.find((e) => e.file === file && e.key === key);
      if (!entry) return;

      setPendingChanges((prev) => {
        const next = new Map(prev);
        const changeKey = `${file}::${key}`;
        const existing = next.get(changeKey);
        const original = existing ? existing.original : entry.value;
        if (newValue === original) {
          next.delete(changeKey);
        } else {
          next.set(changeKey, { original, current: newValue });
        }
        return next;
      });

      setEntries((prev) =>
        prev.map((e) =>
          e.file === file && e.key === key ? { ...e, value: newValue } : e,
        ),
      );
    },
    [entries],
  );

  const saveChanges = useCallback(async () => {
    for (const [changeKey, change] of pendingChanges) {
      const [file, key] = changeKey.split("::");
      await updateEntry(file, key, change.current);
    }
    setPendingChanges(new Map());
  }, [pendingChanges]);

  const discardChanges = useCallback(
    async (project: string) => {
      // Revert all pending changes on disk (including toggles that wrote directly)
      for (const [changeKey, change] of pendingChanges) {
        const [file, key] = changeKey.split("::");
        await updateEntry(file, key, change.original);
      }
      await loadEntries(project);
    },
    [pendingChanges, loadEntries],
  );

  const handleToggleUrl = useCallback(
    async (file: string, key: string, direction: string) => {
      // Capture original value before toggle
      const entry = entries.find((e) => e.file === file && e.key === key);
      const changeKey = `${file}::${key}`;

      const newValue = await toggleUrl(file, key, direction);

      // Track the change in pendingChanges so footer buttons work
      if (entry) {
        setPendingChanges((prev) => {
          const next = new Map(prev);
          const existing = next.get(changeKey);
          const original = existing ? existing.original : entry.value;
          if (newValue === original) {
            next.delete(changeKey);
          } else {
            next.set(changeKey, { original, current: newValue });
          }
          return next;
        });
      }

      setEntries((prev) =>
        prev.map((e) =>
          e.file === file && e.key === key ? { ...e, value: newValue } : e,
        ),
      );
    },
    [entries],
  );

  const handleToggleBulk = useCallback(
    async (project: string, direction: string) => {
      const changes: Change[] = await toggleBulk(project, direction);
      setEntries((prev) =>
        prev.map((e) => {
          const change = changes.find(
            (c) => c.file === e.file && c.key === e.key,
          );
          return change ? { ...e, value: change.new_value } : e;
        }),
      );
    },
    [],
  );

  return {
    entries,
    loading,
    pendingChanges,
    loadEntries,
    stageChange,
    saveChanges,
    discardChanges,
    handleToggleUrl,
    handleToggleBulk,
  };
}
