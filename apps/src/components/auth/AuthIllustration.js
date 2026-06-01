// AuthIllustration — minimalist line-art footer for the auth screens.
// Replaces the earlier card-stack design with a clean SVG composition:
//
//   • Layered wave lines fading from amber → teal across the screen
//   • A small line-drawn "scales of justice" centerpiece, the most
//     recognisable visual for legal + tax expertise without leaning
//     on either profession exclusively
//   • A tagline pill underneath
//
// All strokes are vector — they stay crisp at any density and the
// composition adapts to width via the SVG viewBox.

import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const VB_W = 320;
const VB_H = 180;

export default function AuthIllustration() {
  return (
    <View style={styles.wrap}>
      <Svg
        width="100%"
        height={VB_H}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          {/* Stroke gradient — amber on the left, teal on the right. */}
          <SvgLinearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#d97706" stopOpacity="0.65" />
            <Stop offset="0.5" stopColor="#0d9488" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#1d4ed8" stopOpacity="0.5" />
          </SvgLinearGradient>
          <SvgLinearGradient id="iconStroke" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0f172a" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#0f172a" stopOpacity="0.55" />
          </SvgLinearGradient>
        </Defs>

        {/* Wave lines — each slightly offset for a layered horizon. */}
        <Path
          d={`M0 110 Q 80 70 160 110 T 320 110`}
          stroke="url(#waveStroke)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <Path
          d={`M0 130 Q 80 95 160 130 T 320 130`}
          stroke="url(#waveStroke)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
        <Path
          d={`M0 150 Q 80 120 160 150 T 320 150`}
          stroke="url(#waveStroke)"
          strokeWidth="0.75"
          strokeLinecap="round"
          fill="none"
          opacity="0.35"
        />

        {/* Decorative dot constellation. */}
        <Circle cx="40" cy="30" r="2.5" fill="#d97706" opacity="0.7" />
        <Circle cx="80" cy="50" r="1.5" fill="#0d9488" opacity="0.8" />
        <Circle cx="270" cy="34" r="2" fill="#1d4ed8" opacity="0.55" />
        <Circle cx="240" cy="58" r="1.5" fill="#d97706" opacity="0.6" />
        <Circle cx="300" cy="80" r="1.2" fill="#0d9488" opacity="0.6" />

        {/* Centerpiece — stylised scales of justice in pure strokes. */}
        <G stroke="url(#iconStroke)" strokeWidth="1.6" strokeLinecap="round" fill="none">
          {/* Vertical post */}
          <Path d="M160 36 L160 96" />
          {/* Crossbar */}
          <Path d="M118 50 L202 50" />
          {/* Left pan suspension */}
          <Path d="M132 50 L122 76" />
          <Path d="M132 50 L142 76" />
          {/* Left pan dish (shallow curve) */}
          <Path d="M114 76 Q 132 92 150 76" />
          {/* Right pan suspension */}
          <Path d="M188 50 L178 76" />
          <Path d="M188 50 L198 76" />
          {/* Right pan dish */}
          <Path d="M170 76 Q 188 92 206 76" />
          {/* Base */}
          <Path d="M146 96 L174 96" />
          <Path d="M154 100 L166 100" />
          {/* Top finial */}
          <Circle cx="160" cy="32" r="3" />
        </G>
      </Svg>

      <View style={styles.tagWrap}>
        <Feather name="zap" size={12} color={colors.primary} />
        <Text style={styles.tagline}>
          Built for India's legal & tax pros
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  tagWrap: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  tagline: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
});
