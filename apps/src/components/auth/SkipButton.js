// SkipButton — top-right "Skip" pill on every auth screen. Tapping
// flips the auth context into guest mode (RootNavigator then switches
// to ClientTabs). Pure UI element — calling code wires `onPress`.

import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function SkipButton({ onPress, tone = 'light' }) {
  const dark = tone === 'dark';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        dark ? styles.btnDark : styles.btnLight,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.label, dark ? styles.labelDark : styles.labelLight]}>
        Skip
      </Text>
      <Feather
        name="chevron-right"
        size={12}
        color={dark ? '#ffffff' : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  btnLight: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: colors.border,
  },
  btnDark: {
    // Solid dark fill — reads cleanly on bright hero photos.
    backgroundColor: colors.ink,
    borderColor: colors.inkSoft,
  },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.3 },
  labelLight: { color: colors.textSecondary },
  labelDark: { color: '#ffffff' },
});
