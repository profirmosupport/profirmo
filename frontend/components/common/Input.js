/**
 * Input — labelled text input with error and hint support.
 *
 * Props: { label, name, type='text', value, onChange, placeholder, error,
 *          required, hint, className, ...rest }
 */
export default function Input({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  hint,
  className = '',
  ...rest
}) {
  const inputId = name || label;
  const base =
    'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 ' +
    'transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500';
  const stateClasses = error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200';

  return (
    <div className={`w-full ${className}`.trim()}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        className={`${base} ${stateClasses}`}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
