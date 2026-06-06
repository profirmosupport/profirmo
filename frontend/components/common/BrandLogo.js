import Link from 'next/link';

// Shared Pro Firmo brand logo — used in the header, dashboard sidebar and
// auth pages so the logo is identical everywhere.
//
// Props:
//   href     - link target (default '/'); pass null to render without a link
//   onClick  - optional click handler (e.g. close a mobile menu)
//   variant  - 'light' (dark wordmark, for light backgrounds) | 'dark' (white wordmark)
//   size     - 'sm' | 'md'
export default function BrandLogo({
  href = '/',
  onClick,
  variant = 'light',
  size = 'md',
  className = '',
}) {
  const mark = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const markText = size === 'sm' ? 'text-[12px]' : 'text-[13px]';
  const word = size === 'sm' ? 'text-base' : 'text-lg';
  const wordColor = variant === 'dark' ? 'text-white' : 'text-slate-900';
  const accent = variant === 'dark' ? 'text-gradient-light' : 'text-gradient';
  const ring = variant === 'dark' ? 'ring-slate-900' : 'ring-white';

  const content = (
    <span className={`group flex items-center gap-2.5 ${className}`}>
      <span
        className={`relative grid ${mark} place-items-center rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-teal-600 font-extrabold tracking-tight text-white shadow-glow-sm transition group-hover:shadow-glow`}
      >
        <span className={markText}>PF</span>
        <span
          className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ${ring}`}
        />
      </span>
      {/* Wordmark — hidden on small screens so the mobile header
          shows just the brand mark, restored at the `sm` breakpoint
          and up. */}
      <span
        className={`hidden sm:inline ${word} font-bold tracking-tight ${wordColor}`}
      >
        Pro<span className={accent}> Firmo</span>
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label="Pro Firmo home"
      className="inline-flex"
    >
      {content}
    </Link>
  );
}
