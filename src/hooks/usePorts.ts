import { useCallback, useEffect, useState } from "react";
import type { PortStatus } from "../types";
import { scanPorts } from "../lib/tauri";

export function usePorts() {
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const p = await scanPorts();
    setPorts(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { ports, loading, refresh };
}
