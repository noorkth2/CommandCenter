import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

/**
 * Small centered confirmation dialog for destructive actions.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onConfirm: () => void | Promise<void>,
 *   title?: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   loading?: boolean,
 * }} props
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  loading = false,
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTimeout(() => confirmBtnRef.current?.focus(), 50);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-sm bg-bg-elevated border border-border-strong rounded-xl
                   shadow-overlay p-6 animate-scale-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center">
            <AlertTriangle size={18} className="text-brand-red" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-title" className="font-semibold text-text-primary text-sm mb-1">
              {title}
            </h3>
            <p id="confirm-message" className="text-sm text-text-muted leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            ref={confirmBtnRef}
            variant="danger"
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
