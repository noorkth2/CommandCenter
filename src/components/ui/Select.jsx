import { forwardRef } from 'react';

/**
 * Select dropdown component.
 *
 * @param {{ label?: string, error?: string, hint?: string, options: {value: string, label: string}[], placeholder?: string } & React.SelectHTMLAttributes<HTMLSelectElement>} props
 */
const Select = forwardRef(function Select(
  { label, error, hint, options = [], placeholder, className = '', id, ...props },
  ref
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {props.required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`input-base appearance-none cursor-pointer ${
          error ? 'border-danger' : ''
        } ${className}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8799' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
        }}
        {...props}
      >
        {placeholder && (
          <option value="" style={{ background: '#1e1e24', color: '#5a5870' }}>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            style={{ background: '#1e1e24', color: '#e8e6f0' }}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
});

export default Select;
