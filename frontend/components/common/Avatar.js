'use client';

import { useState, useEffect } from 'react';
import { resolveFileUrl } from '@/services/fileService';
import { getInitials } from '@/utils/formatters';

// Named sizes — circular avatar dimensions + initial-text sizing.
const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
  '2xl': 'h-32 w-32 text-3xl',
};

/**
 * Reusable circular profile avatar.
 * - Resolves relative `/uploads/...` paths to absolute URLs.
 * - Falls back to initials on a colored background when there is no image,
 *   or when the image URL is broken / deleted / fails to load.
 *
 * Props: { src, name, size='md', className, priority=false }
 *
 * When `priority` is true the avatar is treated as an LCP candidate —
 * loads eagerly with fetchPriority="high", suitable for the profile-header
 * avatar that sits above the fold on the professional / firm detail pages.
 */
export default function Avatar({
  src,
  name = '',
  size = 'md',
  className = '',
  priority = false,
}) {
  const [errored, setErrored] = useState(false);

  // Reset the error state if the source changes (e.g. after a new upload).
  useEffect(() => {
    setErrored(false);
  }, [src]);

  const url = src ? resolveFileUrl(src) : '';
  const sizeCls = SIZES[size] || SIZES.md;
  const showImage = Boolean(url) && !errored;

  return (
    <span
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-teal-600 font-semibold uppercase text-white ${sizeCls} ${className}`}
      aria-label={name || 'Profile'}
    >
      {showImage ? (
        <img
          src={url}
          alt={name || 'Profile'}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'async' : undefined}
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{getInitials(name) || '?'}</span>
      )}
    </span>
  );
}
