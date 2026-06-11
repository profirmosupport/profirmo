'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useLanguage } from '@/components/LanguageProvider';
import { updateProfessionalDetails } from '@/services/profileService';

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
  const [draft, setDraft] = useState({ day: 'Monday', time: '' });
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
    const time = draft.time.trim();
    if (!/^\d{1,2}:\d{2}$/.test(time)) return;
    // Adding a slot to a day implicitly un-marks it as off — saves
    // the pro from having to toggle "Unmark off" first.
    if (daysOff.has(draft.day)) {
      setDaysOff((prev) => {
        const next = new Set(prev);
        next.delete(draft.day);
        return next;
      });
    }
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
        <div className="sm:w-48">
          <Input
            label={t('dash.availability.rateLabel')}
            name="perMinuteRate"
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={t('dash.availability.ratePlaceholder')}
            min="0"
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Calendar size={16} className="text-slate-400" />
          {t('dash.availability.weekly')}
        </p>
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
          <div className="sm:w-40">
            <Input
              label={t('dash.availability.timeSlot')}
              name="slot-time"
              value={draft.time}
              onChange={(e) =>
                setDraft((d) => ({ ...d, time: e.target.value }))
              }
              placeholder={t('dash.availability.timePlaceholder')}
              hint={t('dash.availability.timeHint')}
            />
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
