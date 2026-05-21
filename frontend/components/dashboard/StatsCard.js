'use client';

import Card from '@/components/common/Card';

const VARIANTS = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  red: 'bg-red-100 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
};

/**
 * StatsCard — metric card with icon chip, big value, label and optional hint.
 * Props: { label, value, icon, hint, variant }
 */
export default function StatsCard({
  label,
  value,
  icon,
  hint,
  variant = 'blue',
}) {
  const chip = VARIANTS[variant] || VARIANTS.blue;

  return (
    <Card hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${chip}`}
          >
            {icon}
          </span>
        )}
      </div>
    </Card>
  );
}
