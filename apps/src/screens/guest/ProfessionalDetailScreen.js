// ProfessionalDetailScreen — guest-side equivalent of the web's
// /professionals/:id page. Hero header (photo, name, credentials,
// rating, fee), an About card, chip sections for skills, languages,
// education, certifications, legal/tax credentials, and a Reviews
// block at the bottom with a composer for logged-in users.
//
// Sticky "Book now" CTA pinned to the bottom of the scroll view.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import AvatarWithInitials from '../../components/common/AvatarWithInitials';
import { computeInitials } from '../../components/guest/ProfessionalHorizontalCard';
import StarRow from '../../components/guest/StarRow';
import ReviewComposer from '../../components/guest/ReviewComposer';
import { useAuth } from '../../contexts/AuthContext';
import { getProfessional } from '../../services/professionalService';
import { listLocations } from '../../services/appSettingsService';
import { listProfessionalReviews } from '../../services/reviewService';
import { imageUrl } from '../../utils/imageUrl';
import { formatRupees, formatDate, displayName } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function ProfessionalDetailScreen({ navigation, route }) {
  const { user } = useAuth();
  const id = route?.params?.professionalId;

  const [pro, setPro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cities, setCities] = useState({}); // id → city name
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getProfessional(id);
      const item = (data && data.professional) || data;
      setPro(item || null);
    } catch (err) {
      setError(err.message || 'Failed to load this professional.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Locations are needed to resolve practiceCities ids → city names.
  useEffect(() => {
    listLocations()
      .then((countries) => {
        const map = {};
        for (const c of countries || []) {
          for (const s of c.states || []) {
            for (const city of s.cities || []) {
              map[city.id] = city.name;
            }
          }
        }
        setCities(map);
      })
      .catch(() => {});
  }, []);

  const loadReviews = useCallback(async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const rows = await listProfessionalReviews(id);
      setReviews(Array.isArray(rows) ? rows : []);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadReviews();
  }, [load, loadReviews]);

  // Resolve practiceCities ids → human names. Falls back to the raw
  // id when the location lookup hasn't loaded yet, then re-resolves
  // once it does.
  const practiceCityNames = useMemo(() => {
    if (!pro) return [];
    const arr = Array.isArray(pro.practiceCities) ? pro.practiceCities : [];
    return arr
      .map((cid) => cities[cid] || (typeof cid === 'string' ? cid : null))
      .filter(Boolean);
  }, [pro, cities]);

  if (loading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <View style={{ gap: spacing.md }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </ScrollView>
    );
  }
  if (error || !pro) {
    return (
      <View style={styles.root}>
        <EmptyState
          icon="alert-circle"
          title={error ? 'Something went wrong' : 'Professional not found'}
          description={error || 'This profile may have been removed.'}
        />
      </View>
    );
  }

  const photoUrl = imageUrl(pro.profilePhoto);
  const initials = computeInitials(pro.name);
  const subtitle = pro.designation || pro.professionalType || 'Professional';
  const aboutText = pro.about || pro.bio;
  const perMinuteRate = pro.perMinuteRate ?? pro.consultationFee;
  const canBook = Boolean(
    pro.acceptsOnlineBooking ?? pro.acceptOnlineBooking ?? pro.bookable
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Hero card */}
        <Card>
          <View style={styles.heroRow}>
            <AvatarWithInitials
              uri={photoUrl}
              name={pro.name}
              size={72}
              style={{ borderRadius: 36 }}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{pro.name}</Text>
                {pro.verified ? (
                  <View style={styles.verified}>
                    <Feather name="check" size={10} color={colors.textInverse} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.subtitle}>{subtitle}</Text>
              {pro.organization ? (
                <Text style={styles.org}>{pro.organization}</Text>
              ) : null}
            </View>
          </View>

          {/* Stats — three tinted tiles, each with its own accent
              colour. Reads as three discrete data points rather than
              a single block of small text. */}
          <View style={styles.statsRow}>
            <StatTile
              icon="star"
              tone="amber"
              value={pro.rating ? Number(pro.rating).toFixed(1) : '—'}
              label="Rating"
              suffix={pro.rating ? '/5' : null}
            />
            <StatTile
              icon="message-square"
              tone="sky"
              value={`${pro.reviewsCount ?? reviews.length}`}
              label="Reviews"
            />
            <StatTile
              icon="clock"
              tone="emerald"
              value={
                pro.yearsOfExperience
                  ? `${pro.yearsOfExperience}`
                  : '—'
              }
              label="Experience"
              suffix={
                pro.yearsOfExperience
                  ? pro.yearsOfExperience === 1
                    ? 'yr'
                    : 'yrs'
                  : null
              }
            />
          </View>

          <View style={styles.metaRow}>
            {pro.city ? <Badge variant="gray">{pro.city}</Badge> : null}
            {pro.consultancyType ? (
              <Badge variant="blue">{pro.consultancyType}</Badge>
            ) : null}
            {pro.availableNow ? (
              <Badge variant="green">Available now</Badge>
            ) : null}
          </View>

          {practiceCityNames.length > 0 ? (
            <View style={styles.practiceWrap}>
              <View style={styles.practiceHeader}>
                <Feather name="map-pin" size={12} color={colors.primary} />
                <Text style={styles.practiceTitle}>Also practises in</Text>
              </View>
              <View style={styles.practiceChipsRow}>
                {practiceCityNames.map((name, i) => (
                  <View key={`${name}-${i}`} style={styles.practiceChip}>
                    <Text style={styles.practiceChipText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {perMinuteRate ? (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Consultation rate</Text>
              <Text style={styles.feeAmount}>
                {formatRupees(perMinuteRate)}
                <Text style={styles.feeUnit}> / min</Text>
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Practice areas (sub-categories the pro registered for). */}
        {Array.isArray(pro.subCategories) && pro.subCategories.length > 0 ? (
          <Card>
            <Text style={styles.sectionLabel}>Practice areas</Text>
            <View style={styles.catBigRow}>
              {pro.subCategories.map((c) => (
                <View key={c.id} style={styles.catBigChip}>
                  <Feather name="tag" size={11} color={colors.primary} />
                  <Text style={styles.catBigChipText}>{c.name}</Text>
                  {c.categoryName ? (
                    <Text style={styles.catBigParent}>· {c.categoryName}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* About */}
        {aboutText ? (
          <Card>
            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.body1}>{aboutText}</Text>
          </Card>
        ) : null}

        {/* Service chips */}
        <ChipSection title="Skills" items={pro.skills} />
        <ChipSection title="Expertise" items={pro.expertise} />
        <ChipSection title="Languages" items={pro.languages} />
        <ChipSection title="Education" items={pro.education} />
        <ChipSection title="Certifications" items={pro.certifications} />

        {/* Legal practice details */}
        {pro.barRegistrationNumber || pro.enrollmentNumber || pro.jurisdiction ? (
          <Card>
            <Text style={styles.sectionLabel}>Legal practice</Text>
            <View style={styles.kvList}>
              <KV label="Bar registration" value={pro.barRegistrationNumber} />
              <KV label="Enrollment #" value={pro.enrollmentNumber} />
              <KV label="License #" value={pro.advocateLicenseNumber || pro.licenseNumber} />
              <KV label="Jurisdiction" value={pro.jurisdiction} />
              <KV label="Chamber" value={pro.chamberAddress} />
            </View>
          </Card>
        ) : null}

        {/* Tax practice details */}
        {pro.taxRegistrationNumber ? (
          <Card>
            <Text style={styles.sectionLabel}>Tax practice</Text>
            <View style={styles.kvList}>
              <KV label="Tax registration #" value={pro.taxRegistrationNumber} />
              <KV
                label="Specializations"
                value={
                  Array.isArray(pro.specializationAreas)
                    ? pro.specializationAreas.join(', ')
                    : pro.specializationAreas
                }
              />
            </View>
          </Card>
        ) : null}

        {/* Reviews */}
        <Card>
          <View style={styles.reviewHeader}>
            <View>
              <Text style={styles.sectionLabel}>Reviews</Text>
              <Text style={styles.reviewCount}>
                {reviewsLoading
                  ? 'Loading…'
                  : reviews.length === 0
                    ? 'No reviews yet'
                    : `${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
              </Text>
            </View>
            {user ? (
              <Pressable
                onPress={() => setComposerOpen(true)}
                style={({ pressed }) => [
                  styles.addReviewBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="edit-3" size={12} color={colors.primary} />
                <Text style={styles.addReviewText}>Write review</Text>
              </Pressable>
            ) : null}
          </View>

          {reviewsLoading ? (
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Text style={styles.emptyReviewsText}>
                Be the first to share your experience.
              </Text>
              {!user ? (
                <Text style={styles.emptyReviewsHint}>
                  Sign in to write a review.
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
              {reviews.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </View>
          )}
        </Card>

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>

      {/* Sticky book bar */}
      <View style={styles.bookBar}>
        <View style={{ flex: 1 }}>
          {perMinuteRate ? (
            <>
              <Text style={styles.bookBarLabel}>From</Text>
              <Text style={styles.bookBarValue}>
                {formatRupees(perMinuteRate)}
                <Text style={styles.bookBarUnit}> / min</Text>
              </Text>
            </>
          ) : (
            <Text style={styles.bookBarLabel}>
              Talk to {pro.name?.split(' ')[0]}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() =>
            navigation.navigate('Booking', { professionalId: pro.id })
          }
          disabled={!canBook}
          style={({ pressed }) => [
            styles.bookBtn,
            !canBook && styles.bookBtnDisabled,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <LinearGradient
            colors={
              canBook
                ? ['#f59e0b', '#d97706']
                : [colors.surfaceMuted, colors.surfaceMuted]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookFill}
          >
            <Text
              style={[
                styles.bookText,
                !canBook && { color: colors.textMuted },
              ]}
            >
              {canBook ? 'Book now' : 'Not bookable'}
            </Text>
            {canBook ? (
              <Feather name="arrow-right" size={14} color={colors.textInverse} />
            ) : null}
          </LinearGradient>
        </Pressable>
      </View>

      <ReviewComposer
        open={composerOpen}
        professionalId={pro.id}
        onClose={() => setComposerOpen(false)}
        onSubmitted={(created) => {
          if (created) setReviews((prev) => [created, ...prev]);
          else loadReviews();
        }}
      />
    </View>
  );
}

// StatTile — one of the three hero stats. Tone picks the bubble +
// border + accent text colour so each tile reads as its own data
// point. `suffix` is a smaller trailing token (e.g. "/5" or "yrs").
const STAT_TONES = {
  amber: {
    bubble: colors.primarySoft,
    icon: colors.primary,
    border: 'rgba(217,119,6,0.25)',
    accent: colors.primary,
  },
  sky: {
    bubble: colors.infoSoft,
    icon: colors.info,
    border: 'rgba(37,99,235,0.22)',
    accent: colors.info,
  },
  emerald: {
    bubble: colors.successSoft,
    icon: colors.success,
    border: 'rgba(5,150,105,0.22)',
    accent: colors.success,
  },
};

function StatTile({ icon, value, suffix, label, tone = 'amber' }) {
  const t = STAT_TONES[tone] || STAT_TONES.amber;
  return (
    <View style={[styles.statTile, { borderColor: t.border }]}>
      <View style={[styles.statBubble, { backgroundColor: t.bubble }]}>
        <Feather name={icon} size={14} color={t.icon} />
      </View>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {suffix ? (
          <Text style={[styles.statSuffix, { color: t.accent }]}>
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChipSection({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Card>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.chipRow}>
        {items.map((item, i) => {
          const label =
            typeof item === 'string'
              ? item
              : item.name || item.title || item.label;
          if (!label) return null;
          return (
            <View key={`${label}-${i}`} style={styles.chip}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function KV({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function ReviewItem({ review }) {
  const author =
    review.clientName ||
    displayName(review.user || {}) ||
    review.userName ||
    'Anonymous';
  const initials = computeInitials(author);
  const when = formatDate(review.date || review.createdAt);
  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewAvatar}>
        <Text style={styles.reviewInitials}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.reviewTopRow}>
          <Text style={styles.reviewAuthor} numberOfLines={1}>
            {author}
          </Text>
          {when ? <Text style={styles.reviewDate}>{when}</Text> : null}
        </View>
        <View style={{ marginTop: 2 }}>
          <StarRow value={review.rating || 0} size={12} />
        </View>
        {review.comment ? (
          <Text style={styles.reviewComment}>{review.comment}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  verified: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  org: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Three tinted stat tiles. Each tile is its own bordered surface
  // with a colored icon bubble at the top, big value in the middle,
  // small uppercase label at the bottom.
  statsRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 4,
  },
  statBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  statSuffix: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  metaRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },

  practiceWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  practiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  practiceTitle: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  practiceChipsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  practiceChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.35)',
  },
  practiceChipText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },

  feeRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  feeAmount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  feeUnit: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  body1: { fontSize: fontSize.sm, lineHeight: 22, color: colors.textPrimary },

  // Practice areas — chip style that calls out the category visibly
  // (icon + name + parent eyebrow). Pulled in alongside Skills /
  // Languages but with extra prominence since it's the searchable
  // taxonomy clients filter on.
  catBigRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catBigChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.32)',
  },
  catBigChipText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },
  catBigParent: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.primarySoftText,
    opacity: 0.7,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  kvList: { gap: 6 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  kvLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: fontWeight.semibold,
  },
  kvValue: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, textAlign: 'right' },

  // Reviews
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  reviewCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  addReviewText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  emptyReviews: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  emptyReviewsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  emptyReviewsHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  reviewItem: { flexDirection: 'row', gap: spacing.sm },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInitials: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },
  reviewTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  reviewAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  reviewDate: { fontSize: 11, color: colors.textMuted },
  reviewComment: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  bookBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bookBarLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  bookBarValue: {
    marginTop: 2,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  bookBarUnit: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  bookBtn: { flex: 1.1, borderRadius: radius.lg, overflow: 'hidden' },
  bookBtnDisabled: { opacity: 0.6 },
  bookFill: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bookText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
});
