// ============================================================
// TOAST CONTEXT — Phase 8
// ============================================================
// Lightweight replacement for the scattered alert() calls used
// for error messages in earlier phases. No new dependency — just
// React state + a fixed-position stack, auto-dismissing.
//
// Usage:
//   const toast = useToast();
//   toast.error('Could not delete contact.');
//   toast.success('Invite sent.');
// ============================================================
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, type) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const value = {
    error: (message) => push(message, 'error'),
    success: (message) => push(message, 'success'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm bg-surface-dark ${
              t.type === 'error' ? 'border-status-error/40' : 'border-status-success/40'
            }`}
          >
            {t.type === 'error' ? (
              <XCircle size={16} className="text-status-error flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="text-status-success flex-shrink-0 mt-0.5" />
            )}
            <p className="flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted-text hover:text-white flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be used inside <ToastProvider>');
  }
  return ctx;
}
