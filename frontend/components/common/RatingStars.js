import { Star } from 'lucide-react';

const SIZES = {
  sm: { icon: 14, text: 'text-xs' },
  md: { icon: 18, text: 'text-sm' },
  lg: { icon: 22, text: 'text-base' },
};

/**
 * RatingStars — renders 5 stars with a filled portion for the rating.
 *
 * Props: { rating=0, count, size='sm', showValue=true, className }
 */
export default function RatingStars({
  rating = 0,
  count,
  size = 'sm',
  showValue = true,
  className = '',
}) {
  const conf = SIZES[size] || SIZES.sm;
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));

  return (
    <span className={`inline-flex items-center gap-1 ${className}`.trim()}>
      <span className="inline-flex" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const fillFraction = Math.max(0, Math.min(1, safeRating - i));
          return (
            <span
              key={i}
              className="relative inline-block"
              style={{ width: conf.icon, height: conf.icon }}
            >
              <Star
                size={conf.icon}
                className="absolute inset-0 text-slate-300"
                fill="currentColor"
              />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillFraction * 100}%` }}
              >
                <Star
                  size={conf.icon}
                  className="text-amber-400"
                  fill="currentColor"
                />
              </span>
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className={`font-medium text-slate-700 ${conf.text}`}>
          {safeRating.toFixed(1)}
        </span>
      )}
      {count !== undefined && count !== null && (
        <span className={`text-slate-500 ${conf.text}`}>({count})</span>
      )}
    </span>
  );
}
