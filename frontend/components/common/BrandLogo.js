import Link from 'next/link';

// Shared Pro Firmo brand logo — used in the header, dashboard sidebar
// and auth pages so the logo is identical everywhere.
//
// Two presentations swap at the `lg` breakpoint to match the header's
// own mobile / desktop split:
//   - Mobile / tablet  -> the round PF brand mark image at
//                         /images/profirmo-logo.png, sized to fill the
//                         header height (no wordmark — saves room).
//   - Desktop (lg+)    -> the "Pro Firmo" wordmark only, enlarged to
//                         the maximum height the header can carry. No
//                         icon, no gradient square — the wordmark is
//                         the logo at this width.
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
  // Mark image fits inside the 64px (h-16) header — keep breathing
  // room at the top and bottom so it doesn't kiss the divider line.
  // Sizes are 14.5% smaller than the original h-14 / h-10 (10% + 5%
  // compounded) — 47.88 px and 34.2 px respectively.
  const mark = size === 'sm' ? 'h-[2.13rem] w-[2.13rem]' : 'h-[2.99rem] w-[2.99rem]';
  // Wordmark at desktop is big enough to anchor the nav row visually.
  // `sm` keeps the wordmark a touch smaller for the auth pages where
  // it sits inside a compact card.
  const word = size === 'sm' ? 'text-2xl' : 'text-3xl';
  const wordColor = variant === 'dark' ? 'text-white' : 'text-slate-900';
  const accent = variant === 'dark' ? 'text-gradient-light' : 'text-gradient';

  // "Live" indicator — pulsing green dot anchored to the logo's
  // top-right corner on both breakpoints. The outer span is an
  // `animate-ping` halo that fades out, the inner dot is solid so it
  // never disappears entirely (pure ping looks empty between frames).
  const LiveDot = () => (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-1 -top-1 flex h-2.5 w-2.5"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
    </span>
  );

  const content = (
    <span className={`group flex items-center gap-2.5 ${className}`}>
      {/* Mobile / tablet: brand mark image with a live-dot overlay. */}
      <span className={`relative inline-block lg:hidden ${mark}`}>
        {/* LCP image on mobile — eager + high priority so the browser
            schedules the fetch alongside CSS instead of after layout. The
            `<link rel="preload">` in app/layout.js does the same for the
            first hit; this hint pairs with it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/profirmo-logo.png"
          alt="Pro Firmo"
          width="48"
          height="48"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-contain"
        />
        <LiveDot />
      </span>
      {/* Desktop (lg+): wordmark with the same live-dot overlay
          anchored to its top-right corner. */}
      <span
        className={`relative hidden ${word} font-bold tracking-tight ${wordColor} lg:inline-block`}
      >
        Pro<span className={accent}> Firmo</span>
        <LiveDot />
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
