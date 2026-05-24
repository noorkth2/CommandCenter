import { forwardRef } from 'react';

/**
 * Primary Button component.
 *
 * @param {{ variant?: 'primary'|'secondary'|'danger'|'ghost'|'icon', size?: 'sm'|'md'|'lg', loading?: boolean, children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled,
    className,
    children,
    ...props
  },
  ref
) {
  const base = 'btn';
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
    icon: 'btn-icon',
  };
  const sizes = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(base, variants[variant], variant !== 'icon' && sizes[size], className)}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-3.5 w-3.5 opacity-70"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {variant !== 'icon' && <span className="opacity-70">Loading…</span>}
        </>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;

// Convenience export for clsx (avoid installing separate dep)
export function clsx(...args) {
  return args
    .flat()
    .filter(Boolean)
    .join(' ');
}
