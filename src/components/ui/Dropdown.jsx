import { useEffect, useRef, useState } from 'react';

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
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          className={`
            absolute z-50 mt-1 min-w-[160px] py-1
            bg-bg-elevated border border-border-strong rounded-lg shadow-overlay
            animate-scale-in
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
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
                    ? 'text-brand-red hover:bg-brand-red/10'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}
                `}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setOpen(false);
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
        </div>
      )}
    </div>
  );
}
