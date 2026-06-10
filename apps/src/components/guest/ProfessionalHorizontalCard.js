// ProfessionalHorizontalCard — fixed-width card sized for horizontal
// FlatList carousels. Avatar + headline meta on top, "View profile"
// + "Book now" CTAs anchored to the bottom.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AvatarWithInitials from '../common/AvatarWithInitials';
import { imageUrl } from '../../utils/imageUrl';
import { formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export const PRO_CARD_WIDTH = 268;

export default function ProfessionalHorizontalCard({
  pro,
  onPressProfile,
  onPressBook,
  // Default fixed-width for horizontal carousels. Pass `width="100%"`
  // or any other size when reusing the card in a vertical list (e.g.
  // search results).
  width = PRO_CARD_WIDTH,
}) {
  const photoUrl = imageUrl(pro.profilePhoto);
  const subtitle = pro.designation || pro.professionalType || 'Professional';
  const categories = Array.isArray(pro.subCategories) ? pro.subCategories : [];
  // Some legacy rows carry a separate `perMinuteRate`; fall back to
  // `consultationFee` (which on the new model is already a per-minute
  // number for pros who price by the minute).
  const perMinuteRate = pro.perMinuteRate ?? pro.consultationFee;
  // Only show the "Book now" CTA when the professional has opted into
  // online booking. Otherwise we show a single full-width "View profile"
  // button — the visitor can still see the profile but won't be
  // promised an instant booking flow.
  const canBook = Boolean(
    pro.acceptsOnlineBooking ?? pro.acceptOnlineBooking ?? pro.bookable
  );
  const rating = Number(pro.rating) || 0;
  const reviewsCount = Number(pro.reviewsCount) || 0;
  const availableNow = Boolean(pro.availableNow);
  const consultancy = (() => {
    const c = String(pro.consultancyType || '').toLowerCase();
    if (c === 'online') return { icon: 'video', label: 'Online' };
    if (c === 'in_person' || c === 'in-person') {
      return { icon: 'users', label: 'In-person' };
    }
    if (c === 'both') return { icon: 'video', label: 'Online / In-person' };
    return null;
  })();
  const bioPreview = (() => {
    const text = String(pro.bio || pro.about || '').trim();
    if (!text) return '';
    return text.length > 130 ? `${text.slice(0, 127)}…` : text;
  })();
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.head}>
        <AvatarWithInitials
          uri={photoUrl}
          name={pro.name}
          size={52}
          style={{ borderRadius: 26 }}
        />
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

      {categories.length > 0 ? (
        <View style={styles.catRow}>
          {categories.slice(0, 2).map((c) => (
            <View key={c.id} style={styles.catChip}>
              <Text style={styles.catChipText} numberOfLines={1}>
                {c.name}
              </Text>
            </View>
          ))}
          {categories.length > 2 ? (
            <View style={[styles.catChip, styles.catChipMore]}>
              <Text style={styles.catChipText}>+{categories.length - 2}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        {pro.city ? <MetaPill icon="map-pin" label={pro.city} /> : null}
        {pro.yearsOfExperience ? (
          <MetaPill icon="briefcase" label={`${pro.yearsOfExperience}y`} />
        ) : null}
        {consultancy ? (
          <MetaPill icon={consultancy.icon} label={consultancy.label} />
        ) : null}
      </View>

      {bioPreview ? (
        <Text style={styles.bio} numberOfLines={2}>
          {bioPreview}
        </Text>
      ) : null}

      {rating > 0 || reviewsCount > 0 ? (
        <View style={styles.ratingRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Feather
              key={i}
              name="star"
              size={11}
              color={i < Math.round(rating) ? '#f59e0b' : colors.borderStrong}
              style={{
                marginRight: 1,
                ...(i < Math.round(rating) ? { /* filled via tint */ } : {}),
              }}
            />
          ))}
          <Text style={styles.ratingText}>
            {rating > 0 ? rating.toFixed(1) : '—'}
            {reviewsCount > 0 ? ` · ${reviewsCount}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.feeRow}>
        <View style={{ flex: 1 }}>
          {perMinuteRate ? (
            <>
              <Text style={styles.feeAmount}>
                {formatRupees(perMinuteRate)}
              </Text>
              <Text style={styles.feeUnit}>per consultation</Text>
            </>
          ) : (
            <Text style={styles.feeLabel}>Discuss to confirm rate</Text>
          )}
        </View>
        <View
          style={[
            styles.availBadge,
            availableNow
              ? styles.availBadgeOn
              : styles.availBadgeOff,
          ]}
        >
          <View
            style={[
              styles.availDot,
              { backgroundColor: availableNow ? '#10b981' : '#94a3b8' },
            ]}
          />
          <Text
            style={[
              styles.availText,
              availableNow ? { color: '#047857' } : { color: '#475569' },
            ]}
          >
            {availableNow ? 'Available now' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.ctaRow}>
        <Pressable
          onPress={onPressProfile}
          style={({ pressed }) => [
            styles.secondaryBtn,
            !canBook && styles.secondaryBtnSolo,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.secondaryText}>View profile</Text>
          {!canBook ? (
            <Feather
              name="arrow-right"
              size={12}
              color={colors.textPrimary}
              style={{ marginLeft: 4 }}
            />
          ) : null}
        </Pressable>
        {canBook ? (
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
        ) : null}
      </View>
    </View>
  );
}

// PlaceholderAvatar — shown when the professional has no profile
// photo. Renders the person's initials over an amber gradient so
// the spot still reads as their identity, not a missing image.
function PlaceholderAvatar({ initials }) {
  return (
    <LinearGradient
      colors={['#fde68a', '#f59e0b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.avatar}
    >
      <Text style={styles.avatarInitials}>{initials || '?'}</Text>
    </LinearGradient>
  );
}

// computeInitials — first letter of first + last word, capitalised.
// "Vishal Singh" → "VS"; single-word names get a single letter.
export function computeInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  avatarInitials: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.5,
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
  catRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  catChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    maxWidth: 130,
  },
  catChipMore: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  catChipText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
    letterSpacing: 0.1,
  },
  metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
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
  bio: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  ratingRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  feeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  feeLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  feeAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  feeUnit: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  availBadgeOn: { backgroundColor: '#d1fae5' },
  availBadgeOff: { backgroundColor: colors.surfaceMuted },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 10, fontWeight: fontWeight.bold },
  ctaRow: { marginTop: spacing.sm, flexDirection: 'row', gap: 6 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  // Solo variant — when "Book now" is hidden the View profile button
  // takes the whole row and gets an amber accent border.
  secondaryBtnSolo: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
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
