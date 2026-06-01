const VARIANTS = {
  gray: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  violet: 'bg-violet-100 text-violet-700',
};

/**
 * Badge — small rounded pill label.
 *
 * Props: { children, variant='gray', className }
 *   variant: gray | blue | green | amber | red | violet
 */
export default function Badge({ children, variant = 'gray', className = '' }) {
  const variantClasses = VARIANTS[variant] || VARIANTS.gray;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
