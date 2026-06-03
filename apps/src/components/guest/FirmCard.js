// FirmCard — fixed-width firm summary card for horizontal carousels.
// Logo header (or initials), firm name + type, city + size badges,
// and a single "View firm" CTA.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AvatarWithInitials from '../common/AvatarWithInitials';
import { imageUrl } from '../../utils/imageUrl';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export const FIRM_CARD_WIDTH = 268;

export default function FirmCard({ firm, onPress, width = FIRM_CARD_WIDTH }) {
  const logoUrl = imageUrl(firm.logo);
  const firmName = firm.firmName || firm.name;
  return (
    <View style={[styles.card, { width }]}>
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        {/* Subtle dotted pattern behind the logo to add texture
            without a real image asset. */}
        <View style={styles.bannerPattern} pointerEvents="none">
          {[...Array(12).keys()].map((i) => (
            <View key={i} style={styles.bannerDot} />
          ))}
        </View>
        <AvatarWithInitials
          uri={logoUrl}
          name={firmName}
          size={50}
          square
        />
        <View style={styles.bannerMeta}>
          {firm.numberOfProfessionals || firm.professionalCount ? (
            <View style={styles.bannerBadge}>
              <Feather name="users" size={10} color={colors.textInverse} />
              <Text style={styles.bannerBadgeText}>
                {firm.numberOfProfessionals || firm.professionalCount} pros
              </Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {firm.firmName || firm.name}
        </Text>
        {firm.firmType ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {firm.firmType}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {firm.city ? <MetaPill icon="map-pin" label={firm.city} /> : null}
          {firm.rating ? (
            <MetaPill icon="star" label={String(firm.rating)} />
          ) : null}
        </View>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.cta,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>View firm</Text>
          <Feather name="arrow-right" size={12} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function MetaPill({ icon, label }) {
  return (
    <View style={styles.metaPill}>
      <Feather name={icon} size={10} color={colors.textSecondary} />
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  banner: {
    height: 90,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#ffffff' },
  logoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(217,119,6,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitialsText: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  bannerPattern: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    opacity: 0.18,
  },
  bannerDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    margin: 9,
  },
  bannerMeta: { alignItems: 'flex-end', gap: 4 },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bannerBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  body: { padding: spacing.md },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  metaText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  cta: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
