// ExpertiseTile — brand-palette tile used on the Area of Expertise
// grid. All tiles share the amber gradient and a thin amber border so
// the section reads as one cohesive brand block (mirroring the web's
// amber accent system). Icons are mapped by name so each tile still
// feels distinct.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const ICON_MAP = [
  { match: ['advocate', 'criminal', 'civil', 'litig'], icon: 'shield' },
  { match: ['divorce', 'family'], icon: 'heart' },
  { match: ['corporate', 'company'], icon: 'briefcase' },
  { match: ['tax consult', 'income tax', 'income'], icon: 'trending-up' },
  { match: ['gst'], icon: 'percent' },
  { match: ['registration'], icon: 'file-text' },
  { match: ['audit'], icon: 'check-circle' },
  { match: ['real estate', 'property'], icon: 'home' },
  { match: ['intellectual', 'patent', 'trademark'], icon: 'award' },
  { match: ['immigr'], icon: 'globe' },
  { match: ['labour', 'employment'], icon: 'users' },
];

function iconFor(name) {
  const lower = String(name || '').toLowerCase();
  for (const m of ICON_MAP) {
    if (m.match.some((x) => lower.includes(x))) return m.icon;
  }
  return 'tag';
}

export default function ExpertiseTile({ label, parent, onPress }) {
  const icon = iconFor(label);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <LinearGradient
        // Amber → deep amber, with a soft inner shadow handled by the
        // top-right decorative circles. Keeps every tile on-brand.
        colors={['#f59e0b', '#d97706']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tile}
      >
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox="0 0 200 100"
          preserveAspectRatio="xMidYMid slice"
          pointerEvents="none"
        >
          <Circle cx="170" cy="20" r="44" fill="rgba(255,255,255,0.12)" />
          <Circle cx="195" cy="80" r="26" fill="rgba(255,255,255,0.08)" />
          <Circle cx="20" cy="92" r="20" fill="rgba(255,255,255,0.07)" />
        </Svg>

        <View style={styles.iconBubble}>
          <Feather name={icon} size={20} color={colors.textInverse} />
        </View>
        <View style={styles.captionWrap}>
          {parent ? <Text style={styles.parent}>{parent}</Text> : null}
          <Text style={styles.label} numberOfLines={2}>
            {label}
          </Text>
        </View>
        <Feather
          name="arrow-up-right"
          size={14}
          color="rgba(255,255,255,0.85)"
          style={styles.arrow}
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#d97706',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  tile: {
    height: 108,
    padding: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: { gap: 1 },
  parent: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.1,
  },
  arrow: { position: 'absolute', top: 12, right: 12 },
});
