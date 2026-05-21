/**
 * Select — labelled native <select>.
 *
 * Props: { label, name, value, onChange, options, placeholder, error,
 *          required, className, ...rest }
 *   `options` is an array of { value, label }.
 */
export default function Select({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder,
  error,
  required = false,
  className = '',
  ...rest
}) {
  const selectId = name || label;
  const base =
    'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 ' +
    'transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50';
  const stateClasses = error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200';

  return (
    <div className={`w-full ${className}`.trim()}>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        className={`${base} ${stateClasses}`}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
