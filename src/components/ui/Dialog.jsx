import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

/**
 * Right slide-over panel component.
 * Used for all create/edit forms throughout the app.
 *
 * @param {{ open: boolean, onClose: () => void, title: string, subtitle?: string, children: React.ReactNode, footer?: React.ReactNode, width?: string }} props
 */
export default function Dialog({ open, onClose, title, subtitle, children, footer, width = '600px' }) {
  const panelRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Trap focus within panel
  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) focusable[0].focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="slide-over-backdrop animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="slide-over-panel animate-slide-in-right"
        style={{ width: `min(${width}, 100vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="slide-over-header">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <Button variant="icon" onClick={onClose} aria-label="Close panel">
            <X size={16} />
          </Button>
        </div>

        {/* Body */}
        <div className="slide-over-body">{children}</div>

        {/* Footer */}
        {footer && <div className="slide-over-footer">{footer}</div>}
      </div>
    </>
  );
}
