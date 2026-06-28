'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Calendar, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useLanguage } from '@/components/LanguageProvider';
import { updateProfessionalDetails } from '@/services/profileService';
import { INSTANT_BOOKING_MULTIPLIER } from '@/utils/constants';
import { formatCurrency } from '@/utils/formatters';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// 30-minute increments from 00:00 to 23:30. Fed into both the From and To
// dropdowns; To-options are filtered client-side to only show entries
// after the selected From.
const TIME_OPTIONS = (() => {
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      out.push(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      );
    }
  }
  return out;
})();

/**
 * AvailabilityManager — available-now toggle, editable rate, and weekly slots.
 * Props: { professional, onSaved }
 *
 * Saves to PUT /api/profile/professional, which persists to
 * professional_details.{availability, consultationFee, availableNow}.
 */
// Build the slotsByDay map from a `professional` object (handles both new-
// model `availability` and legacy `availabilitySlots`).
function buildSlotsByDay(pro) {
  const map = {};
  DAYS.forEach((d) => {
    map[d] = [];
  });
  const source = Array.isArray(pro && pro.availability)
    ? pro.availability
    : Array.isArray(pro && pro.availabilitySlots)
      ? pro.availabilitySlots
      : [];
  source.forEach((entry) => {
    if (entry && entry.day && map[entry.day] !== undefined) {
      map[entry.day] = Array.isArray(entry.slots) ? [...entry.slots] : [];
    }
  });
  return map;
}

// Pull the explicit "day off" set out of the same availability array.
// We store off days as entries with `enabled: false` so the public
// /api/professionals/:id endpoint can decide whether to show / hide
// each day on the booking calendar.
function buildDaysOff(pro) {
  const off = new Set();
  const source = Array.isArray(pro && pro.availability) ? pro.availability : [];
  source.forEach((entry) => {
    if (entry && entry.day && entry.enabled === false) {
      off.add(entry.day);
    }
  });
  return off;
}

// Pick the initial rate from a `professional` object (consultationFee then
// legacy perMinuteRate).
function pickRate(pro) {
  if (!pro) return '';
  if (pro.consultationFee !== undefined && pro.consultationFee !== null) {
    return String(pro.consultationFee);
  }
  if (pro.perMinuteRate !== undefined && pro.perMinuteRate !== null) {
    return String(pro.perMinuteRate);
  }
  return '';
}

export default function AvailabilityManager({ professional, onSaved }) {
  const { t } = useLanguage();
  const pro = professional || {};
  const [availableNow, setAvailableNow] = useState(
    pro.availableNow === false ? false : true
  );
  const [rate, setRate] = useState(() => pickRate(pro));
  const [slotsByDay, setSlotsByDay] = useState(() => buildSlotsByDay(pro));
  // Days the pro has explicitly marked off — blocks new bookings and
  // hides the day from the public availability list.
  const [daysOff, setDaysOff] = useState(() => buildDaysOff(pro));
  // Draft for the "add slot" row: a day + a start/end time range. Stored
  // as "HH:MM-HH:MM" strings in slotsByDay so consumers (public profile,
  // booking widget) just render the label as-is.
  const [draft, setDraft] = useState({
    day: 'Monday',
    start: '09:00',
    end: '17:00',
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // The professional record arrives asynchronously after mount (and refreshes
  // after a save). Keep the form fields in sync with the latest values so the
  // saved data is visible on page refresh.
  // Re-syncs only when the underlying record's identity changes OR when the
  // saved values themselves change — avoids fighting in-progress local edits.
  useEffect(() => {
    if (!professional || !professional.id) return;
    setAvailableNow(professional.availableNow === false ? false : true);
    setRate(pickRate(professional));
    setSlotsByDay(buildSlotsByDay(professional));
    setDaysOff(buildDaysOff(professional));
  }, [
    professional && professional.id,
    professional && professional.availableNow,
    professional && professional.consultationFee,
    professional && JSON.stringify(professional.availability),
  ]);

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      // Keep the same array shape — one entry per day. Off days are
      // explicitly marked `enabled: false` (with empty slots) so the
      // public profile can render "Day off" instead of falling back
      // to "No slots listed".
      const availability = DAYS.map((day) => {
        if (daysOff.has(day)) {
          return { day, enabled: false, slots: [] };
        }
        return { day, enabled: true, slots: slotsByDay[day] || [] };
      }).filter(
        (entry) =>
          // Drop fully-empty on-days so we don't pollute the payload
          // with rows that mean nothing.
          entry.enabled === false || entry.slots.length > 0
      );
      const payload = {
        availableNow,
        availability,
      };
      const parsedRate = rate === '' ? null : Number(rate);
      if (parsedRate !== null && Number.isFinite(parsedRate)) {
        payload.consultationFee = parsedRate;
      }
      await updateProfessionalDetails(payload);
      setFeedback({ type: 'success', message: 'Availability saved.' });
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Could not save availability.',
      });
    } finally {
      setSaving(false);
    }
  }

  function addSlot() {
    const { day, start, end } = draft;
    if (!start || !end) return;
    if (start >= end) {
      setFeedback({
        type: 'error',
        message: 'End time must be after start time.',
      });
      return;
    }
    const range = `${start}-${end}`;
    // Adding a slot to a day implicitly un-marks it as off — saves
    // the pro from having to toggle "Unmark off" first.
    if (daysOff.has(day)) {
      setDaysOff((prev) => {
        const next = new Set(prev);
        next.delete(day);
        return next;
      });
    }
    setSlotsByDay((prev) => {
      const existing = prev[day] || [];
      if (existing.includes(range)) return prev;
      return {
        ...prev,
        [day]: [...existing, range].sort(),
      };
    });
    setFeedback(null);
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
          {t('dash.availability.title')}
        </h3>
        <p className="text-sm text-slate-500">
          {t('dash.availability.subtitle')}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3 sm:flex-1">
          <div>
            <p className="text-sm font-medium text-slate-800">
              {t('dash.availability.availableNow')}
            </p>
            <p className="text-xs text-slate-500">
              {availableNow
                ? t('dash.availability.availableOn')
                : t('dash.availability.availableOff')}
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
        <div className="sm:w-64">
          <Input
            label={t('dash.availability.rateLabel')}
            name="perMinuteRate"
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={t('dash.availability.ratePlaceholder')}
            min="0"
          />
          {/* Instant-consultation earnings hint — shown below the rate
              input so the pro understands they make 2× per minute when
              someone books them on the spot. The number on the right
              previews their actual instant rate using the current input. */}
          <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
            <Zap size={12} className="mt-0.5 shrink-0 fill-amber-500 text-amber-600" />
            <span className="flex-1">
              For instant consultations you earn{' '}
              <strong>{INSTANT_BOOKING_MULTIPLIER}× this rate</strong>
              {Number(rate) > 0 && (
                <>
                  {' '}— {formatCurrency(Number(rate) * INSTANT_BOOKING_MULTIPLIER)}/min
                </>
              )}
              . The client is charged the same {INSTANT_BOOKING_MULTIPLIER}×
              multiplier.
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Calendar size={16} className="text-slate-400" />
          {t('dash.availability.weekly')}
        </p>
        {/* Default-availability notice — explains the implicit 09:00-17:00
            window the public profile + booking widget fall back to when a
            day has no slots and isn't marked off. Mirrors the same rule
            enforced in ProfessionalAvailability.js + booking page. */}
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            If no slot is added for a day and the day isn&apos;t marked off,
            Pro Firmo shows your default availability of{' '}
            <strong>09:00&nbsp;–&nbsp;17:00</strong> on the public profile
            and booking calendar.
          </span>
        </div>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const isOff = daysOff.has(day);
            const toggleOff = () =>
              setDaysOff((prev) => {
                const next = new Set(prev);
                if (next.has(day)) next.delete(day);
                else next.add(day);
                return next;
              });
            return (
              <div
                key={day}
                className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${
                  isOff
                    ? 'border-rose-200 bg-rose-50/40'
                    : 'border-slate-200'
                }`}
              >
                <span className="w-28 shrink-0 text-sm font-medium text-slate-700">
                  {t(`dash.availability.day.${day}`)}
                </span>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {isOff ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      Day off
                    </span>
                  ) : (slotsByDay[day] || []).length === 0 ? (
                    <span className="text-xs text-slate-400">
                      {t('dash.availability.noSlots')}
                    </span>
                  ) : (
                    (slotsByDay[day] || []).map((time) => (
                      <span
                        key={time}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                      >
                        {time}
                        <button
                          type="button"
                          onClick={() => removeSlot(day, time)}
                          aria-label={t('dash.availability.removeSlot', {
                            time,
                            day: t(`dash.availability.day.${day}`),
                          })}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOff}
                  onClick={toggleOff}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isOff
                      ? 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-700'
                  }`}
                >
                  {isOff ? 'Unmark off' : 'Mark off'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-44">
            <label
              htmlFor="slot-day"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {t('dash.availability.day')}
            </label>
            <select
              id="slot-day"
              value={draft.day}
              onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {t(`dash.availability.day.${d}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-32">
            <label
              htmlFor="slot-start"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              From
            </label>
            <select
              id="slot-start"
              value={draft.start}
              onChange={(e) =>
                setDraft((d) => {
                  // Snap `end` forward if the new start runs past it, so we
                  // never end up with a start ≥ end pair the user has to
                  // manually correct.
                  const start = e.target.value;
                  const end = d.end > start ? d.end : start;
                  return { ...d, start, end };
                })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-32">
            <label
              htmlFor="slot-end"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              To
            </label>
            <select
              id="slot-end"
              value={draft.end}
              onChange={(e) =>
                setDraft((d) => ({ ...d, end: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {/* Only show times strictly after the chosen start so the
                  pair is always valid by construction. */}
              {TIME_OPTIONS.filter((opt) => opt > draft.start).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="md" onClick={addSlot}>
            <Plus size={15} />
            {t('dash.availability.addSlot')}
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
        {feedback && (
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              feedback.type === 'success'
                ? 'text-emerald-700'
                : 'text-red-700'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
            {feedback.message}
          </span>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : t('dash.common.save')}
        </Button>
      </div>
    </Card>
  );
}
