import Link from 'next/link';

const VARIANTS = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600 border border-transparent',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-400 border border-transparent',
  outline:
    'bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400 border border-slate-300',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400 border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 border border-transparent',
};

const SIZES = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2',
};

/**
 * Button — renders a Next.js Link when `href` is provided, otherwise a
 * native <button>. Always merges `className`.
 *
 * Props: { children, variant='primary', size='md', type='button', href,
 *          onClick, disabled, className, ...rest }
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  href,
  onClick,
  disabled = false,
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';
  const classes = `${base} ${VARIANTS[variant] || VARIANTS.primary} ${
    SIZES[size] || SIZES.md
  } ${className}`.trim();

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
}
