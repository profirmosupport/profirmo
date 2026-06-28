// ProAvailabilityScreen — mobile mirror of the web's
// /dashboard/professional/availability page, expanded with:
//
//   1. Online-bookings toggle      (acceptsOnlineBooking)
//   2. Available-right-now toggle  (availableNow)
//   3. Rate per minute (₹)         (consultationFee)
//   4. Weekly schedule             (availability[] = [
//                                     { day, startTime, endTime } ...
//                                   ])
//
// Weekly schedule defaults to 09:00 → 17:00 for every day (Mon → Sun),
// each day toggleable to "Day off". Saving rewrites the `availability`
// array on professionalDetail; the public profile + booking calendar
// read the same field, so changes ripple immediately.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import SearchableSelect from '../../components/auth/SearchableSelect';
import {
  getMyProfile,
  updateMyProfessionalProfile,
} from '../../services/profileService';
import { INSTANT_BOOKING_MULTIPLIER } from '../../config/constants';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

// 30-minute increments from 06:00 → 22:00 for the start/end dropdowns.
const TIME_OPTIONS = (() => {
  const out = [];
  for (let h = 6; h <= 22; h += 1) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      out.push({ value, label: formatLabel(value) });
    }
  }
  return out;
})();

function formatLabel(value) {
  if (!value) return '';
  const [hStr, mStr] = String(value).split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (!Number.isFinite(h)) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// Seed: every day on with the default 9–5 window. Used when the
// professionalDetail has no saved availability yet.
function defaultSchedule() {
  return DAYS.map((day) => ({
    day,
    enabled: true,
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
  }));
}

// Parse a single slot entry like "09:00", "9:00 AM - 5:00 PM",
// "09:00 - 17:00" into { start, end }. Multi-slot arrays use the
// first slot's start and the last slot's end so a saved list of
// discrete pills still shows as one continuous window.
function parseSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return {};
  const splitRange = (s) => {
    const parts = String(s || '').split(/\s*[-–]\s*/);
    return {
      start: parts[0] ? toHHMM(parts[0].trim()) : null,
      end: parts[1] ? toHHMM(parts[1].trim()) : null,
    };
  };
  const first = splitRange(slots[0]);
  const last = splitRange(slots[slots.length - 1]);
  return {
    start: first.start || null,
    end: last.end || first.end || null,
  };
}

// Coerce a "9:00 AM" / "09:00" / "5pm" style string to "HH:MM".
function toHHMM(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const period = (m[3] || '').toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (m) {
    let h = Number(m[1]);
    const period = m[2].toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:00`;
  }
  return null;
}

// Normalise whatever's stored on professionalDetail.availability into
// our editor shape ([{ day, enabled, startTime, endTime } * 7]).
// Handles both the mobile-native shape (`startTime/endTime` on each
// entry) AND the web shape (`slots: ['09:00', '17:00']` or
// `slots: ['09:00 - 17:00']`). Days missing from the saved array
// fall back to the default 9–5 enabled window so the editor reads
// as "every day is on" by default.
function hydrateSchedule(raw) {
  const base = defaultSchedule();
  if (!Array.isArray(raw) || raw.length === 0) return base;
  const lookup = new Map();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const day = String(entry.day || '').trim();
    if (!day) continue;
    const parsed = parseSlots(entry.slots);
    const startTime = entry.startTime || parsed.start;
    const endTime = entry.endTime || parsed.end;
    lookup.set(day.toLowerCase(), {
      day,
      enabled: entry.enabled !== false,
      startTime: startTime || DEFAULT_START,
      endTime: endTime || DEFAULT_END,
    });
  }
  return base.map((row) => {
    const found = lookup.get(row.day.toLowerCase());
    return found || row; // Default to the 9-5 enabled row when not found.
  });
}

export default function ProAvailabilityScreen() {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [banner, setBanner] = useState({ text: '', tone: 'info' });

  // Rate + schedule editor state.
  const [feePerMin, setFeePerMin] = useState('');
  const [schedule, setSchedule] = useState(defaultSchedule());
  const [savingSchedule, setSavingSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProfile();
      const pd = (data && data.professionalDetail) || {};
      setDetail(pd);
      setFeePerMin(
        pd.consultationFee != null && pd.consultationFee !== ''
          ? String(pd.consultationFee)
          : ''
      );
      setSchedule(hydrateSchedule(pd.availability));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const accepting = detail ? detail.acceptsOnlineBooking !== false : true;
  const availableNow = detail ? Boolean(detail.availableNow) : false;

  async function flipFlag(field, nextValue, copy) {
    if (saving) return;
    setSaving(field);
    setBanner({ text: '', tone: 'info' });
    try {
      await updateMyProfessionalProfile({ [field]: nextValue });
      setDetail((d) => ({ ...(d || {}), [field]: nextValue }));
      setBanner({ text: copy, tone: 'success' });
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not save. Try again.',
        tone: 'error',
      });
    } finally {
      setSaving('');
    }
  }

  function updateRow(idx, patch) {
    setSchedule((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  }

  async function saveScheduleAndRate() {
    if (savingSchedule) return;
    setSavingSchedule(true);
    setBanner({ text: '', tone: 'info' });
    try {
      const fee = Number(feePerMin);
      const payload = {
        consultationFee:
          feePerMin === '' || !Number.isFinite(fee) ? null : fee,
        // Save in a shape readable by BOTH editors:
        //   • mobile reads startTime/endTime first
        //   • web reads the slots array (one "HH:MM - HH:MM" entry)
        // Day-off rows keep `enabled: false` with empty slots so a
        // future un-mark can restore the window.
        availability: schedule.map((row) => ({
          day: row.day,
          enabled: row.enabled,
          startTime: row.enabled ? row.startTime : null,
          endTime: row.enabled ? row.endTime : null,
          slots: row.enabled ? [`${row.startTime} - ${row.endTime}`] : [],
        })),
      };
      await updateMyProfessionalProfile(payload);
      setBanner({ text: 'Rate and schedule saved.', tone: 'success' });
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not save schedule.',
        tone: 'error',
      });
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <ScreenContainer hasNavHeader keyboard contentStyle={styles.page}>
      {loading && !detail ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.intro}>
            Pause incoming bookings, mark yourself available now, set your
            per-minute rate, and define when clients can book each week.
          </Text>

          {banner.text ? (
            <View
              style={[
                styles.banner,
                banner.tone === 'success'
                  ? styles.bannerSuccess
                  : styles.bannerError,
              ]}
            >
              <Feather
                name={
                  banner.tone === 'success' ? 'check-circle' : 'alert-circle'
                }
                size={14}
                color={banner.tone === 'success' ? '#047857' : colors.danger}
              />
              <Text
                style={[
                  styles.bannerText,
                  banner.tone === 'success'
                    ? { color: '#047857' }
                    : { color: colors.danger },
                ]}
              >
                {banner.text}
              </Text>
              <Pressable
                onPress={() => setBanner({ text: '', tone: 'info' })}
                hitSlop={6}
              >
                <Feather
                  name="x"
                  size={12}
                  color={banner.tone === 'success' ? '#047857' : colors.danger}
                />
              </Pressable>
            </View>
          ) : null}

          {/* Online bookings toggle */}
          <Card>
            <ToggleRow
              icon="calendar"
              title="Online bookings"
              body={
                accepting
                  ? 'On — clients can book you from your card and profile.'
                  : 'Paused — the Book button is hidden across the site.'
              }
              note="Pauses NEW bookings only. Existing bookings, notes and payouts are untouched."
              on={accepting}
              disabled={saving === 'acceptsOnlineBooking'}
              onChange={(next) =>
                flipFlag(
                  'acceptsOnlineBooking',
                  next,
                  next
                    ? 'Online bookings resumed.'
                    : 'Online bookings paused.'
                )
              }
            />
          </Card>

          {/* Available now toggle */}
          <Card>
            <ToggleRow
              icon="zap"
              title="Available right now"
              body={
                availableNow
                  ? 'You appear with the "Available now" badge in listings.'
                  : 'Showing as offline — instant-consultation badge hidden.'
              }
              note="Use this for instant consultations — clients can book and call within minutes."
              on={availableNow}
              disabled={saving === 'availableNow'}
              onChange={(next) =>
                flipFlag(
                  'availableNow',
                  next,
                  next
                    ? 'Marked as available now.'
                    : 'Marked as offline.'
                )
              }
            />
          </Card>

          {/* Rate per minute */}
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionIcon}>
                <Feather name="credit-card" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Rate per minute</Text>
                <Text style={styles.sectionSub}>
                  What clients pay per minute of consultation.
                </Text>
              </View>
            </View>
            <AuthInput
              label="Per-minute rate (₹)"
              icon="credit-card"
              keyboardType="numeric"
              placeholder="e.g. 50"
              value={feePerMin}
              onChangeText={(v) => setFeePerMin(v.replace(/[^0-9.]/g, ''))}
              hint="Total consultation cost = rate × selected duration."
            />
            <View style={styles.instantHint}>
              <Feather
                name="zap"
                size={12}
                color={colors.warning}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.instantHintText}>
                For instant consultations you earn{' '}
                <Text style={styles.instantHintStrong}>
                  {INSTANT_BOOKING_MULTIPLIER}× this rate
                </Text>
                {Number(feePerMin) > 0
                  ? ` — ₹${
                      Number(feePerMin) * INSTANT_BOOKING_MULTIPLIER
                    }/min`
                  : ''}
                . The client is charged the same {INSTANT_BOOKING_MULTIPLIER}×
                multiplier.
              </Text>
            </View>
          </Card>

          {/* Weekly schedule */}
          <Card>
            <View style={styles.sectionHead}>
              <View style={styles.sectionIcon}>
                <Feather name="calendar" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Weekly availability</Text>
                <Text style={styles.sectionSub}>
                  Default: 9:00 AM → 5:00 PM each day. Toggle a day off to
                  block bookings.
                </Text>
              </View>
            </View>

            {schedule.map((row, idx) => (
              <View key={row.day} style={styles.dayRow}>
                <View style={styles.dayHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayName}>{row.day}</Text>
                    <Text style={styles.dayState}>
                      {row.enabled
                        ? `${formatLabel(row.startTime)} – ${formatLabel(row.endTime)}`
                        : 'Day off'}
                    </Text>
                  </View>
                  <Switch
                    value={row.enabled}
                    onValueChange={(next) => updateRow(idx, { enabled: next })}
                    trackColor={{ false: '#cbd5e1', true: '#fcd34d' }}
                    thumbColor={row.enabled ? colors.primary : '#ffffff'}
                  />
                </View>
                {row.enabled ? (
                  <View style={styles.timeRow}>
                    <View style={styles.timeCol}>
                      <SearchableSelect
                        label="Start"
                        icon="clock"
                        options={TIME_OPTIONS}
                        value={row.startTime}
                        onChange={(v) => updateRow(idx, { startTime: v })}
                      />
                    </View>
                    <View style={styles.timeCol}>
                      <SearchableSelect
                        label="End"
                        icon="clock"
                        options={TIME_OPTIONS}
                        value={row.endTime}
                        onChange={(v) => updateRow(idx, { endTime: v })}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}

            <GradientButton
              title={savingSchedule ? 'Saving…' : 'Save rate & schedule'}
              loading={savingSchedule}
              onPress={saveScheduleAndRate}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      )}
    </ScreenContainer>
  );
}

function ToggleRow({ icon, title, body, note, on, disabled, onChange }) {
  return (
    <>
      <View style={styles.row}>
        <View
          style={[
            styles.iconBubble,
            on ? styles.iconOn : styles.iconOff,
          ]}
        >
          <Feather
            name={icon}
            size={18}
            color={on ? '#047857' : '#be123c'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <Switch
          value={on}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ false: '#cbd5e1', true: '#fcd34d' }}
          thumbColor={on ? colors.primary : '#ffffff'}
        />
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.md },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  intro: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOn: { backgroundColor: '#d1fae5' },
  iconOff: { backgroundColor: '#fee2e2' },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  body: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  note: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },

  // Sub-section headers for rate + schedule cards.
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sectionSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // Weekly schedule rows.
  dayRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  dayState: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },
  timeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeCol: { flex: 1 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerError: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  bannerSuccess: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: fontWeight.semibold },
  instantHint: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: colors.warningSoft,
  },
  instantHintText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: colors.warningSoftText,
  },
  instantHintStrong: {
    fontWeight: fontWeight.bold,
    color: colors.warningSoftText,
  },
});
