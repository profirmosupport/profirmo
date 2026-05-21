import { Inbox } from 'lucide-react';

/**
 * EmptyState — centered placeholder for empty lists/results.
 *
 * Props: { icon, title, description, action, className }
 *   `icon` is an optional React node (e.g. a lucide icon element).
 *   `action` is an optional React node (e.g. a Button).
 */
export default function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center ${className}`.trim()}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon || <Inbox size={24} />}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
