import { MapPin, Users, ArrowRight } from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import RatingStars from '@/components/common/RatingStars';
import { firms } from '@/data/mockData';
import { getInitials } from '@/utils/formatters';

const LOGO_COLORS = [
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-indigo-600 text-white',
];

/**
 * FeaturedFirms — a curated selection of 3 firms.
 */
export default function FeaturedFirms() {
  const featured = firms.slice(0, 3);

  return (
    <section className="bg-slate-50 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Trusted legal &amp; tax firms
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Established practices with vetted teams of specialists.
            </p>
          </div>
          <Button href="/firms" variant="outline" size="md">
            View all firms
            <ArrowRight size={16} />
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {featured.map((firm, index) => (
            <Card key={firm.id} hover className="flex flex-col">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                    LOGO_COLORS[index % LOGO_COLORS.length]
                  }`}
                >
                  {getInitials(firm.name)}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-800">
                    {firm.name}
                  </h3>
                  <div className="mt-1">
                    <Badge
                      variant={
                        firm.firmType === 'Legal Firm' ? 'blue' : 'green'
                      }
                    >
                      {firm.firmType}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">{firm.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} />
                  {firm.city}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users size={13} />
                  {firm.professionalCount} professionals
                </span>
              </div>

              <div className="mt-3">
                <RatingStars
                  rating={firm.rating}
                  count={firm.reviewsCount}
                  size="sm"
                />
              </div>

              <div className="mt-4 pt-1">
                <Button
                  href={`/firms/${firm.id}`}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  View firm
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
