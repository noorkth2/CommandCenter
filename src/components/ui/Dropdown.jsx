import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dropdown menu component.
 * Renders a trigger element and a floating menu of items.
 *
 * @param {{
 *   trigger: React.ReactNode,
 *   items: { label: string, icon?: React.ReactNode, onClick: () => void, danger?: boolean, disabled?: boolean, separator?: boolean }[],
 *   align?: 'left'|'right'
 * }} props
 */
export default function Dropdown({ trigger, items = [], align = 'right' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  /** Computes and sets menu coordinates from the trigger element's bounding rect. */
  const computeCoords = (el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (align === 'right') {
      return { top: rect.bottom, right: window.innerWidth - rect.right };
    }
    return { top: rect.bottom, left: rect.left };
  };

  const handleTriggerClick = () => {
    if (open) {
      setOpen(false);
      setCoords(null);
    } else {
      // Compute coords synchronously BEFORE setting open=true so the first
      // render of the portal already has the correct position — no flicker.
      const c = computeCoords(triggerRef.current);
      setCoords(c);
      setOpen(true);
    }
  };

  // Keep coords in sync when the user scrolls or resizes the window.
  useEffect(() => {
    if (!open) return;
    const update = () => setCoords(computeCoords(triggerRef.current));
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, align]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
      setCoords(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setCoords(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <div ref={triggerRef} onClick={handleTriggerClick} className="cursor-pointer inline-block">
        {trigger}
      </div>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${coords.top + 4}px`,
            ...(align === 'right'
              ? { right: `${coords.right}px`, transformOrigin: 'top right' }
              : { left: `${coords.left}px`, transformOrigin: 'top left' }
            ),
          }}
          className="z-[9999] min-w-[160px] py-1 bg-bg-elevated border border-border-hover rounded-lg animate-scale-in"
          role="menu"
        >
          {items.map((item, idx) => {
            if (item.separator) {
              return <div key={idx} className="my-1 border-t border-border" />;
            }
            return (
              <button
                key={idx}
                disabled={item.disabled}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
                  transition-colors duration-100 cursor-pointer
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${item.danger
                    ? 'text-danger hover:bg-danger/10'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}
                `}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setOpen(false);
                    setCoords(null);
                  }
                }}
                role="menuitem"
              >
                {item.icon && (
                  <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                )}
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}


