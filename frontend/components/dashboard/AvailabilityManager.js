'use client';

import { useState } from 'react';
import { Plus, X, Calendar } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * AvailabilityManager — available-now toggle, editable rate, and weekly slots.
 * Props: { professional }
 */
export default function AvailabilityManager({ professional }) {
  const pro = professional || {};
  const [availableNow, setAvailableNow] = useState(!!pro.availableNow);
  const [rate, setRate] = useState(
    pro.perMinuteRate !== undefined ? String(pro.perMinuteRate) : ''
  );
  const [slotsByDay, setSlotsByDay] = useState(() => {
    const map = {};
    DAYS.forEach((d) => {
      map[d] = [];
    });
    (pro.availabilitySlots || []).forEach((entry) => {
      if (entry && entry.day) {
        map[entry.day] = Array.isArray(entry.slots) ? [...entry.slots] : [];
      }
    });
    return map;
  });
  const [draft, setDraft] = useState({ day: 'Monday', time: '' });

  function addSlot() {
    const time = draft.time.trim();
    if (!/^\d{1,2}:\d{2}$/.test(time)) return;
    setSlotsByDay((prev) => {
      const existing = prev[draft.day] || [];
      if (existing.includes(time)) return prev;
      return {
        ...prev,
        [draft.day]: [...existing, time].sort(),
      };
    });
    setDraft((d) => ({ ...d, time: '' }));
  }

  function removeSlot(day, time) {
    setSlotsByDay((prev) => ({
      ...prev,
      [day]: (prev[day] || []).filter((t) => t !== time),
    }));
  }

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Availability & rate
        </h3>
        <p className="text-sm text-slate-500">
          Control whether you appear as available and set your consultation
          rate.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3 sm:flex-1">
          <div>
            <p className="text-sm font-medium text-slate-800">Available now</p>
            <p className="text-xs text-slate-500">
              {availableNow
                ? 'Clients can book instant consultations.'
                : 'You are currently shown as offline.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={availableNow}
            onClick={() => setAvailableNow((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              availableNow ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                availableNow ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <div className="sm:w-48">
          <Input
            label="Per-minute rate (₹)"
            name="perMinuteRate"
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 50"
            min="0"
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Calendar size={16} className="text-slate-400" />
          Weekly availability
        </p>
        <div className="space-y-2">
          {DAYS.map((day) => (
            <div
              key={day}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center"
            >
              <span className="w-28 shrink-0 text-sm font-medium text-slate-700">
                {day}
              </span>
              <div className="flex flex-wrap gap-2">
                {(slotsByDay[day] || []).length === 0 && (
                  <span className="text-xs text-slate-400">No slots</span>
                )}
                {(slotsByDay[day] || []).map((time) => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                  >
                    {time}
                    <button
                      type="button"
                      onClick={() => removeSlot(day, time)}
                      aria-label={`Remove ${time} on ${day}`}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-44">
            <label
              htmlFor="slot-day"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Day
            </label>
            <select
              id="slot-day"
              value={draft.day}
              onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-40">
            <Input
              label="Time slot"
              name="slot-time"
              value={draft.time}
              onChange={(e) =>
                setDraft((d) => ({ ...d, time: e.target.value }))
              }
              placeholder="HH:MM"
              hint="24-hour format"
            />
          </div>
          <Button variant="outline" size="md" onClick={addSlot}>
            <Plus size={15} />
            Add slot
          </Button>
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
        <Button>Save changes</Button>
      </div>
    </Card>
  );
}
