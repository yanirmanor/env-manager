import { useState, useRef, useEffect } from "react";

export interface RunningService {
  name: string;
  port: number;
  localUrl: string;
}

interface UrlToggleProps {
  direction: string;
  folderServices: RunningService[];
  onToggle: (direction: string) => void;
}

export function UrlToggle({ direction, folderServices, onToggle }: UrlToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isLocal = direction === "Local";
  const hasServices = folderServices.length > 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // No services → simple toggle button (old behavior)
  if (!hasServices) {
    return (
      <button
        onClick={() => onToggle(isLocal ? "remote" : "local")}
        className={`text-[10px] font-bold px-2 py-1 rounded tracking-tight transition-all ${
          isLocal
            ? "bg-app-local/10 hover:bg-app-local/20 border border-app-local text-app-local"
            : "bg-app-remote/10 hover:bg-app-remote/20 border border-app-remote/50 text-app-remote"
        }`}
        title={isLocal ? "Switch to remote" : "Switch to local"}
      >
        ● {isLocal ? "LOCAL" : "REMOTE"}
      </button>
    );
  }

  // Has services → dropdown
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`text-[10px] font-bold px-2 py-1 rounded tracking-tight transition-all ${
          isLocal
            ? "bg-app-local/10 hover:bg-app-local/20 border border-app-local text-app-local"
            : "bg-app-remote/10 hover:bg-app-remote/20 border border-app-remote/50 text-app-remote"
        }`}
      >
        ● {isLocal ? "LOCAL" : "REMOTE"}{" "}
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white dark:bg-app-card border border-light-border dark:border-app-border rounded-lg shadow-xl py-1">
          {/* Direction options */}
          <button
            onClick={() => { onToggle("remote"); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
              !isLocal
                ? "text-app-remote font-semibold bg-app-remote/5"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${!isLocal ? "bg-app-remote" : "bg-gray-400"}`} />
            Remote
          </button>

          {/* Running services */}
          <div className="border-t border-light-border dark:border-app-border my-1" />
          <div className="px-3 py-1 text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">
            Running Services
          </div>
          {folderServices.map((svc) => (
            <button
              key={svc.port}
              onClick={() => { onToggle("local"); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-app-success shrink-0" />
              <span className="truncate">{svc.name}</span>
              <span className="ml-auto font-mono text-[10px] text-gray-400 dark:text-gray-600">
                :{svc.port}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
