import { forwardRef } from 'react';

/**
 * Input component with consistent dark-theme styling.
 *
 * @param {{ label?: string, error?: string, hint?: string } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
const Input = forwardRef(function Input({ label, error, hint, className = '', id, ...props }, ref) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {props.required && <span className="text-brand-red ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input-base ${error ? 'border-brand-red focus:border-brand-red focus:ring-brand-red/30' : ''} ${className}`}
        {...props}
      />
      {hint && !error && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
});

export default Input;
