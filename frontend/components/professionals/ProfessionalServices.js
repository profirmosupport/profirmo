import { CheckCircle2, Layers } from 'lucide-react';
import Card from '@/components/common/Card';

/**
 * ProfessionalServices — checklist of services offered.
 *
 * Props: { professional }
 */
export default function ProfessionalServices({ professional }) {
  const services =
    (professional && Array.isArray(professional.servicesOffered)
      ? professional.servicesOffered
      : []) || [];

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Layers size={18} className="text-blue-600" />
        <h2 className="text-base font-semibold text-slate-900">
          Services offered
        </h2>
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-slate-500">No services listed yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <li
              key={service}
              className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
            >
              <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
              <span className="text-sm font-medium text-slate-700">
                {service}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
