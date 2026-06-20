'use client';

import { useMemo, useState } from 'react';
import { Calculator, ArrowLeftRight } from 'lucide-react';

const RATES = ['0.25', '3', '5', '12', '18', '28'];

function inr(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function GSTCalculatorClient() {
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('18');
  const [mode, setMode] = useState('forward'); // forward | reverse
  const [supply, setSupply] = useState('intra'); // intra | inter

  const result = useMemo(() => {
    const a = Number(String(amount).replace(/[^0-9.]/g, ''));
    const r = Number(rate);
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(r)) return null;
    if (mode === 'forward') {
      const tax = (a * r) / 100;
      return { base: a, tax, total: a + tax, rate: r };
    }
    // reverse — extract GST from a tax-inclusive amount.
    const base = (a * 100) / (100 + r);
    const tax = a - base;
    return { base, tax, total: a, rate: r };
  }, [amount, rate, mode]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Calculator size={16} className="text-amber-600" />
          Calculator
        </h2>
        {/* Forward / reverse toggle */}
        <div
          role="group"
          aria-label="Calculation mode"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold"
        >
          <button
            type="button"
            onClick={() => setMode('forward')}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === 'forward'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Add GST
          </button>
          <button
            type="button"
            onClick={() => setMode('reverse')}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === 'reverse'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <ArrowLeftRight size={11} />
              Extract GST
            </span>
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
            {mode === 'forward'
              ? 'Base amount (before GST) ₹'
              : 'GST-inclusive amount ₹'}
          </span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
            GST rate (%)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRate(r)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  rate === r
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'
                }`}
              >
                {r}%
              </button>
            ))}
          </div>
        </label>
      </div>

      {/* Supply-type toggle */}
      <div className="mt-5">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
          Supply type
        </span>
        <div
          role="group"
          aria-label="Supply type"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold"
        >
          <button
            type="button"
            onClick={() => setSupply('intra')}
            className={`rounded-md px-3 py-1.5 transition ${
              supply === 'intra'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Intra-state (CGST + SGST)
          </button>
          <button
            type="button"
            onClick={() => setSupply('inter')}
            className={`rounded-md px-3 py-1.5 transition ${
              supply === 'inter'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Inter-state (IGST)
          </button>
        </div>
      </div>

      {/* Result */}
      {result ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cell label="Base amount" value={`₹${inr(result.base)}`} />
          <Cell
            label={`GST @ ${result.rate}%`}
            value={`₹${inr(result.tax)}`}
            tint="amber"
          />
          <Cell
            label="Final amount"
            value={`₹${inr(result.total)}`}
            tint="teal"
            emphasised
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          Enter a valid amount to see the breakdown.
        </p>
      )}

      {result ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Tax breakdown
          </p>
          {supply === 'intra' ? (
            <ul className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-slate-600">CGST ({(result.rate / 2).toFixed(2)}%)</span>
                <span className="font-semibold text-slate-900">
                  ₹{inr(result.tax / 2)}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-600">SGST ({(result.rate / 2).toFixed(2)}%)</span>
                <span className="font-semibold text-slate-900">
                  ₹{inr(result.tax / 2)}
                </span>
              </li>
            </ul>
          ) : (
            <ul className="mt-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-slate-600">IGST ({result.rate}%)</span>
                <span className="font-semibold text-slate-900">
                  ₹{inr(result.tax)}
                </span>
              </li>
            </ul>
          )}
          <p className="mt-3 text-[11px] leading-snug text-slate-500">
            Indicative only — verify against your accounting system and the
            applicable rate notification for your HSN / SAC code. Cess (if
            any) is not included.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ label, value, tint, emphasised }) {
  const palette = {
    amber: 'bg-amber-50 border-amber-200',
    teal: 'bg-teal-50 border-teal-200',
  };
  return (
    <div
      className={`rounded-xl border p-4 ${
        palette[tint] || 'bg-white border-slate-200'
      } ${emphasised ? 'ring-2 ring-teal-100' : ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
