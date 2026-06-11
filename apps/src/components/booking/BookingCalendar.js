// BookingCalendar — horizontal 14-day strip. Each cell shows weekday +
// day + month/today label and is brand-amber when selected.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

function toIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function BookingCalendar({
  selectedDate,
  onSelectDate,
  // Set / array of weekday names ('Monday', etc.) the pro marked off.
  // Disabled cells can't be tapped and render in a rose tone.
  disabledWeekdays,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const disabledSet =
    disabledWeekdays instanceof Set
      ? new Set([...disabledWeekdays].map((d) => String(d).toLowerCase()))
      : new Set(
          (Array.isArray(disabledWeekdays) ? disabledWeekdays : []).map(
            (d) => String(d).toLowerCase()
          )
        );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {days.map((d) => {
        const iso = toIso(d);
        const active = selectedDate === iso;
        const isToday = d.getTime() === today.getTime();
        const weekdayLong = d
          .toLocaleDateString('en-IN', { weekday: 'long' })
          .toLowerCase();
        const isOff = disabledSet.has(weekdayLong);
        return (
          <Pressable
            key={iso}
            disabled={isOff}
            onPress={() => (isOff ? null : onSelectDate(iso))}
            style={({ pressed }) => [
              styles.cell,
              isOff && styles.cellOff,
              !isOff && active && styles.cellActive,
              pressed && !isOff && { opacity: 0.88 },
            ]}
          >
            <Text
              style={[
                styles.weekday,
                active && !isOff && styles.weekdayActive,
                isOff && styles.weekdayOff,
              ]}
              numberOfLines={1}
            >
              {d.toLocaleDateString('en-IN', { weekday: 'short' })}
            </Text>
            <Text
              style={[
                styles.day,
                active && !isOff && styles.dayActive,
                isOff && styles.dayOff,
              ]}
            >
              {d.getDate()}
            </Text>
            <Text
              style={[
                styles.month,
                active && !isOff && styles.monthActive,
                isOff && styles.monthOff,
              ]}
              numberOfLines={1}
            >
              {isOff
                ? 'Off'
                : isToday
                  ? 'Today'
                  : d.toLocaleDateString('en-IN', { month: 'short' })}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  cell: {
    width: 64,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  cellActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  // Day-off cell — rose tint + non-interactive look.
  cellOff: {
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  weekdayOff: { color: '#be123c' },
  dayOff: { color: '#be123c' },
  monthOff: { color: '#be123c' },
  weekday: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  weekdayActive: { color: 'rgba(255,255,255,0.8)' },
  day: {
    marginTop: 2,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  dayActive: { color: colors.textInverse },
  month: {
    marginTop: 2,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  monthActive: { color: 'rgba(255,255,255,0.85)' },
});
