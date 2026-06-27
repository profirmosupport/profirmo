// TimeSlotSelector — grid of selectable bookable windows. Each slot is
// a "HH:MM-HH:MM" range string (hourly buckets are produced upstream by
// expandSlotsToHourly in utils/availability.js). Legacy "HH:MM" single-
// time strings are still accepted and rendered via formatSlotLabel.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius } from '../../theme';
import { formatSlotLabel } from '../../utils/availability';

export default function TimeSlotSelector({ slots, selectedSlot, onSelectSlot }) {
  const list = Array.isArray(slots) ? slots : [];
  if (list.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No bookable windows for the selected day.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.grid}>
      {list.map((slot) => {
        const active = selectedSlot === slot;
        return (
          <Pressable
            key={slot}
            onPress={() => onSelectSlot(slot)}
            style={({ pressed }) => [
              styles.slot,
              active && styles.slotActive,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text
              style={[styles.slotText, active && styles.slotTextActive]}
              numberOfLines={1}
            >
              {formatSlotLabel(slot)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '47%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  slotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  slotText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  slotTextActive: { color: colors.textInverse },
  empty: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
