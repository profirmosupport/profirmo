/**
 * Card — white panel with border and rounded corners.
 *
 * Props: { children, className, hover=false, padding=true }
 */
export default function Card({
  children,
  className = '',
  hover = false,
  padding = true,
}) {
  const base = 'bg-white border border-slate-200 rounded-xl';
  const hoverClasses = hover
    ? 'transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan'
    : '';
  const padClasses = padding ? 'p-5' : '';

  return (
    <div className={`${base} ${hoverClasses} ${padClasses} ${className}`.trim()}>
      {children}
    </div>
  );
}
