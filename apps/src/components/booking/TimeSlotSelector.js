// TimeSlotSelector — grid of selectable HH:mm slots.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius } from '../../theme';

const DEFAULT_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
];

function formatSlot(value) {
  const [hStr, mStr] = String(value).split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (!Number.isFinite(h)) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function TimeSlotSelector({ slots, selectedSlot, onSelectSlot }) {
  const list = Array.isArray(slots) && slots.length > 0 ? slots : DEFAULT_SLOTS;
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
              {formatSlot(slot)}
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
    flexGrow: 0,
    flexShrink: 0,
    minWidth: '30%',
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
});
