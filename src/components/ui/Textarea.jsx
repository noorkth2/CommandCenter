import { forwardRef } from 'react';

/**
 * Textarea component with auto-growing support.
 *
 * @param {{ label?: string, error?: string, hint?: string, rows?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>} props
 */
const Textarea = forwardRef(function Textarea(
  { label, error, hint, rows = 4, className = '', id, ...props },
  ref
) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={textareaId} className="form-label">
          {label}
          {props.required && <span className="text-brand-red ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={`textarea-base ${
          error ? 'border-brand-red focus:border-brand-red focus:ring-brand-red/30' : ''
        } ${className}`}
        {...props}
      />
      {hint && !error && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
});

export default Textarea;
