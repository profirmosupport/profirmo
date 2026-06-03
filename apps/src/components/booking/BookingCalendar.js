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

export default function BookingCalendar({ selectedDate, onSelectDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

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
        return (
          <Pressable
            key={iso}
            onPress={() => onSelectDate(iso)}
            style={({ pressed }) => [
              styles.cell,
              active && styles.cellActive,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text
              style={[styles.weekday, active && styles.weekdayActive]}
              numberOfLines={1}
            >
              {d.toLocaleDateString('en-IN', { weekday: 'short' })}
            </Text>
            <Text style={[styles.day, active && styles.dayActive]}>
              {d.getDate()}
            </Text>
            <Text
              style={[styles.month, active && styles.monthActive]}
              numberOfLines={1}
            >
              {isToday
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
