import { useState, useEffect, useCallback } from "react";
import type { ServiceMap } from "../types";
import { getServiceMap } from "../lib/tauri";

export function useServiceMap() {
  const [serviceMap, setServiceMap] = useState<ServiceMap | null>(null);

  const refresh = useCallback(async () => {
    try {
      const map = await getServiceMap();
      setServiceMap(map);
    } catch {
      setServiceMap(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { serviceMap, refresh };
}
