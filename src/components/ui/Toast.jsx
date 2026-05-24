import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

/**
 * Toast notification provider.
 * Wrap the app root with this to enable useToast() anywhere.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration ?? 6000),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  const typeConfig = {
    success: { icon: CheckCircle, colorClass: 'toast-success', iconColor: 'text-brand-green' },
    error: { icon: XCircle, colorClass: 'toast-error', iconColor: 'text-brand-red' },
    warning: { icon: AlertTriangle, colorClass: 'toast-warning', iconColor: 'text-brand-amber' },
    info: { icon: Info, colorClass: 'toast-info', iconColor: 'text-brand-blue' },
  };

  const { icon: Icon, colorClass, iconColor } = typeConfig[toast.type] ?? typeConfig.info;

  return (
    <div className={`toast ${colorClass} animate-slide-in-up`}>
      <Icon size={16} className={`${iconColor} flex-shrink-0 mt-0.5`} />
      <p className="text-sm text-text-primary flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Hook to access the toast notification system.
 * Must be used within a <ToastProvider>.
 *
 * @returns {{ success: (msg: string) => void, error: (msg: string) => void, warning: (msg: string) => void, info: (msg: string) => void }}
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
