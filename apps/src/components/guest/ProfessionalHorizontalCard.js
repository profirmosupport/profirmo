// ProfessionalHorizontalCard — fixed-width card sized for horizontal
// FlatList carousels. Avatar + headline meta on top, "View profile"
// + "Book now" CTAs anchored to the bottom.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { imageUrl } from '../../utils/imageUrl';
import { formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export const PRO_CARD_WIDTH = 268;

export default function ProfessionalHorizontalCard({
  pro,
  onPressProfile,
  onPressBook,
}) {
  const photoUrl = imageUrl(pro.profilePhoto);
  const initials = (pro.name || '?').trim().slice(0, 1).toUpperCase();
  const subtitle = pro.designation || pro.professionalType || 'Professional';
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient
            colors={['#fde68a', '#f59e0b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.initials}>{initials}</Text>
          </LinearGradient>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {pro.name}
            </Text>
            {pro.verified ? (
              <View style={styles.verifiedDot}>
                <Feather name="check" size={9} color={colors.textInverse} />
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {pro.city ? <MetaPill icon="map-pin" label={pro.city} /> : null}
        {pro.rating ? <MetaPill icon="star" label={String(pro.rating)} /> : null}
        {pro.yearsOfExperience ? (
          <MetaPill
            icon="clock"
            label={`${pro.yearsOfExperience}y`}
          />
        ) : null}
      </View>

      {pro.consultationFee ? (
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>From</Text>
          <Text style={styles.feeAmount}>
            {formatRupees(pro.consultationFee)}
          </Text>
          <Text style={styles.feeUnit}>/ consult</Text>
        </View>
      ) : (
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Discuss to confirm fee</Text>
        </View>
      )}

      <View style={styles.ctaRow}>
        <Pressable
          onPress={onPressProfile}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.secondaryText}>View profile</Text>
        </Pressable>
        <Pressable
          onPress={onPressBook}
          style={({ pressed }) => [
            styles.primaryBtn,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryFill}
          >
            <Text style={styles.primaryText}>Book now</Text>
            <Feather name="arrow-right" size={12} color={colors.textInverse} />
          </LinearGradient>
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
    width: PRO_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  initials: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: {
    flexShrink: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  verifiedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  metaRow: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
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
  feeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  feeLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  feeAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  feeUnit: { fontSize: 10, color: colors.textMuted, marginBottom: 2 },
  ctaRow: { marginTop: spacing.sm, flexDirection: 'row', gap: 6 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  primaryBtn: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  primaryFill: {
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  primaryText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
});
