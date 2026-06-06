'use client';

// Combobox — a single-select dropdown with a search input that filters the
// option list as you type. Replaces a native <select> wherever the option
// list is large (admin-managed cities / sub-categories).
//
// Props:
//   - label, name, value, onChange — standard form-control props
//   - options: Array<{ value: string, label: string }>
//   - placeholder: shown when nothing is selected
//   - error, hint, required, className, disabled, leftIcon
//   - emptyLabel: shown when the search yields no matches

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export default function Combobox({
  label,
  name,
  value = '',
  onChange,
  options = [],
  placeholder = 'Select…',
  error,
  hint,
  required = false,
  disabled = false,
  className = '',
  leftIcon = null,
  emptyLabel = 'No matches',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Selected option's label is what we show in the trigger button.
  const selectedLabel = useMemo(() => {
    const m = options.find((o) => String(o.value) === String(value));
    return m ? m.label : '';
  }, [options, value]);

  // Filter the option list against the current query (case-insensitive).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      String(o.label).toLowerCase().includes(q)
    );
  }, [options, query]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus the search box when the popover opens.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) setQuery('');
  }, [open]);

  function pick(optionValue) {
    if (typeof onChange === 'function') {
      onChange({ target: { name, value: optionValue } });
    }
    setOpen(false);
  }

  function clear(e) {
    e.stopPropagation();
    pick('');
  }

  const triggerClass = `flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-sm text-left transition focus:outline-none focus:ring-4 ${
    error
      ? 'border-red-300 text-red-700 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-200 text-slate-800 hover:border-amber-300 focus:border-amber-400 focus:ring-amber-100'
  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      <button
        type="button"
        id={name}
        name={name}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClass}
      >
        {(() => {
          // Prefer the selected option's own icon when present; fall
          // back to the combobox-level leftIcon otherwise.
          const sel = options.find((o) => String(o.value) === String(value));
          const icon = (sel && sel.icon) || leftIcon;
          return icon ? <span className="text-slate-500">{icon}</span> : null;
        })()}
        <span
          className={`flex-1 truncate ${
            selectedLabel ? 'text-slate-800' : 'text-slate-400'
          }`}
        >
          {selectedLabel || placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear selection"
            onClick={clear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') clear(e);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card-lg">
          <div className="border-b border-slate-100 px-2 py-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-2 text-sm text-slate-800 outline-none focus:border-amber-300 focus:bg-white"
              />
            </div>
          </div>
          <ul
            role="listbox"
            className="max-h-60 overflow-auto py-1"
            aria-activedescendant={value ? `combobox-opt-${value}` : undefined}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-400">
                {emptyLabel}
              </li>
            ) : (
              filtered.map((opt) => {
                const active = String(opt.value) === String(value);
                return (
                  <li
                    key={opt.value || '__empty__'}
                    id={`combobox-opt-${opt.value}`}
                    role="option"
                    aria-selected={active}
                  >
                    <button
                      type="button"
                      onClick={() => pick(opt.value)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition ${
                        active
                          ? 'bg-amber-50 text-amber-800'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.icon && (
                        <span className="shrink-0 text-slate-500">
                          {opt.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">{opt.label}</span>
                      {active && (
                        <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
