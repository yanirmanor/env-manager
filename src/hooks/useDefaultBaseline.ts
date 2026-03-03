import { useState, useCallback } from "react";
import type { EnvEntry } from "../types";

const STORAGE_PREFIX = "env-manager-default::";

type BaselineMap = Map<string, string>;

export function useDefaultBaseline() {
  const [, setTick] = useState(0);

  const getDefault = useCallback((projectPath: string): BaselineMap | null => {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectPath}`);
    if (!raw) return null;
    try {
      const parsed: [string, string][] = JSON.parse(raw);
      return new Map(parsed);
    } catch {
      return null;
    }
  }, []);

  const setDefault = useCallback(
    (projectPath: string, entries: EnvEntry[]) => {
      const map: [string, string][] = entries
        .filter((e) => !e.is_comment)
        .map((e) => [`${e.file}::${e.key}`, e.value]);
      localStorage.setItem(
        `${STORAGE_PREFIX}${projectPath}`,
        JSON.stringify(map),
      );
      setTick((t) => t + 1);
    },
    [],
  );

  const clearDefault = useCallback((projectPath: string) => {
    localStorage.removeItem(`${STORAGE_PREFIX}${projectPath}`);
    setTick((t) => t + 1);
  }, []);

  const hasDefault = useCallback((projectPath: string): boolean => {
    return localStorage.getItem(`${STORAGE_PREFIX}${projectPath}`) !== null;
  }, []);

  return { getDefault, setDefault, clearDefault, hasDefault };
}
