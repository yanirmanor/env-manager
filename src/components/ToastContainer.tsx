import type { Toast } from "../types";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-slide-in ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <span>
            {toast.type === "success" ? "\u2713" : "\u2717"}
          </span>
          <span>{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
