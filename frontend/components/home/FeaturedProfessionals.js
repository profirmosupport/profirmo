import { BadgeCheck, MapPin, ArrowRight } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import { professionals } from '@/data/mockData';
import { formatRate, getInitials } from '@/utils/formatters';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-indigo-100 text-indigo-700',
];

/**
 * FeaturedProfessionals — the 4 highest-rated professionals.
 */
export default function FeaturedProfessionals() {
  const topProfessionals = [...professionals]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Top-rated professionals
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Consult the experts our clients rate the highest.
            </p>
          </div>
          <Button href="/professionals" variant="outline" size="md">
            View all professionals
            <ArrowRight size={16} />
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {topProfessionals.map((pro, index) => (
            <Card key={pro.id} hover className="flex flex-col">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    AVATAR_COLORS[index % AVATAR_COLORS.length]
                  }`}
                >
                  {getInitials(pro.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold text-slate-800">
                      {pro.name}
                    </h3>
                    {pro.verified && (
                      <BadgeCheck
                        size={16}
                        className="flex-shrink-0 text-blue-600"
                      />
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {pro.professionType}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                <MapPin size={13} />
                {pro.city}
              </div>

              <div className="mt-3">
                <RatingStars
                  rating={pro.rating}
                  count={pro.reviewsCount}
                  size="sm"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {formatRate(pro.perMinuteRate)}
                </span>
                {pro.availableNow && (
                  <Badge variant="green">Available now</Badge>
                )}
              </div>

              <div className="mt-4 pt-1">
                <Button
                  href={`/professionals/${pro.id}`}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  View profile
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
