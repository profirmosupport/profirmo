// CheckboxRow — single labeled toggle. Used for the Tax expertise
// booleans (GST, Income Tax, Corporate Tax, …) on Pro signup step 2.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function CheckboxRow({ label, value, onChange }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View
        style={[
          styles.box,
          value && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        {value ? (
          <Feather name="check" size={12} color={colors.textInverse} />
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  label: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textPrimary },
});
