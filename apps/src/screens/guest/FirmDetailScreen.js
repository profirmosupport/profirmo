// FirmDetailScreen — public firm profile. Mirrors the web's
// /firms/[id] page section-for-section:
//
//   1. Profile header (logo, name, type, owner, key stats, masked
//      contact pills, about preview, Contact-firm CTA).
//   2. Firm details card (registration number, headcount, employees,
//      established, website) + Documents links + Social media links.
//   3. Practice areas (services).
//   4. Professionals at this firm (members grid).
//   5. Reviews of professionals working under the firm.
//
// Sticky "Contact firm" CTA at the bottom mirrors the web's modal —
// opens a bottom-sheet that offers Call / Email / Website actions and
// hands off to the OS via Linking.openURL (tel: / mailto: / https://).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import { computeInitials } from '../../components/guest/ProfessionalHorizontalCard';
import {
  getFirm,
  listFirmProfessionals,
} from '../../services/firmService';
import { listFirmReviews } from '../../services/reviewService';
import ContactFirmModal from '../../components/firm/ContactFirmModal';
import { imageUrl } from '../../utils/imageUrl';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// Mask "user@example.com" → "u•••@example.com" so the email isn't
// scraped off the public screen but the visitor still sees it's a
// real address. The "Contact firm" sheet uses the full address.
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at < 1) return '••••@••••';
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = user.slice(0, Math.min(1, user.length));
  return `${visible}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '•'.repeat(digits.length || 4);
  const tail = digits.slice(-2);
  return `${'•'.repeat(digits.length - 2)}${tail}`;
}

function normalizeUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

// Display name + icon for each supported social platform — matches
// the web's `SOCIAL_ICON`/`SOCIAL_LABEL` maps.
const SOCIAL_META = {
  linkedin: { label: 'LinkedIn', icon: 'linkedin' },
  twitter: { label: 'Twitter', icon: 'twitter' },
  facebook: { label: 'Facebook', icon: 'facebook' },
  instagram: { label: 'Instagram', icon: 'instagram' },
  youtube: { label: 'YouTube', icon: 'youtube' },
};

function StarBar({ rating = 0, size = 12 }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i + 1 <= Math.floor(value);
        const half = !filled && i + 0.5 < value;
        return (
          <Feather
            key={i}
            name="star"
            size={size}
            color={filled || half ? colors.warning : colors.border}
            style={
              filled || half ? { textShadowColor: colors.warning } : undefined
            }
          />
        );
      })}
    </View>
  );
}

export default function FirmDetailScreen({ route, navigation }) {
  const id = route?.params?.firmId;
  const [firm, setFirm] = useState(null);
  const [pros, setPros] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getFirm(id);
      const item = (data && data.firm) || data;
      setFirm(item || null);
      // Fire-and-forget: members + reviews aren't blocking.
      listFirmProfessionals(id)
        .then((rows) => setPros(Array.isArray(rows) ? rows : []))
        .catch(() => {});
      listFirmReviews(id)
        .then((rows) => setReviews(Array.isArray(rows) ? rows : []))
        .catch(() => {});
    } catch (err) {
      setError(err.message || 'Failed to load this firm.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const phone = useMemo(() => {
    if (!firm) return null;
    const raw = firm.contactNumber || firm.phone || '';
    return raw ? String(raw).replace(/[^\d+]/g, '') : null;
  }, [firm]);
  const email = firm && (firm.contactEmail || firm.email);
  const website = normalizeUrl(firm && firm.website);
  // The "Contact firm" CTA is always available — it opens a lead
  // capture form (same as the web). The masked contact pills in the
  // hero just signal that the firm has real contact info on file.

  if (loading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <CardSkeleton />
        <View style={{ height: spacing.md }} />
        <CardSkeleton />
        <View style={{ height: spacing.md }} />
        <CardSkeleton />
      </ScrollView>
    );
  }
  if (error || !firm) {
    return (
      <View style={styles.root}>
        <EmptyState
          icon="alert-circle"
          title={error ? 'Something went wrong' : 'Firm not found'}
          description={error || 'This firm may have been removed.'}
        />
      </View>
    );
  }

  const firmName = firm.firmName || firm.name || 'Firm';
  const logoUrl = imageUrl(firm.logo);
  const initials = computeInitials(firmName);
  const proCount =
    firm.numberOfProfessionals !== null &&
    firm.numberOfProfessionals !== undefined
      ? firm.numberOfProfessionals
      : firm.professionalCount || pros.length || 0;

  // Source of truth for the members list: prefer the embedded
  // `firm.members[]` (richer — role/professionalType/verified), fall
  // back to the /professionals endpoint result.
  const members =
    (Array.isArray(firm.members) && firm.members.length > 0
      ? firm.members
      : pros) || [];

  const practiceAreas = Array.isArray(firm.practiceAreas)
    ? firm.practiceAreas
    : [];

  const hasFacts = Boolean(
    firm.registrationNumber ||
      firm.totalEmployees ||
      firm.numberOfProfessionals ||
      firm.establishedYear ||
      firm.website
  );
  const documents = [
    firm.registrationCertificate
      ? { label: 'Registration certificate', url: firm.registrationCertificate }
      : null,
    firm.businessLicense
      ? { label: 'Business license', url: firm.businessLicense }
      : null,
    ...(Array.isArray(firm.taxDocuments)
      ? firm.taxDocuments.map((u, i) => ({
          label: `Tax document ${i + 1}`,
          url: u,
        }))
      : []),
  ].filter(Boolean);

  const socialEntries = Object.entries(firm.socialLinks || {}).filter(
    ([, url]) => url && String(url).trim()
  );

  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviewCount
      : Number(firm.rating) || 0;

  async function openLink(url) {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      /* swallow — system already shows an error if needed */
    }
  }

  function onPressContact() {
    setContactOpen(true);
  }

  function goToProfessional(proId) {
    if (!proId) return;
    navigation.navigate('ProfessionalDetail', { professionalId: proId });
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* ============== 1. Profile header ============== */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#0b1220', '#0f172a', '#1e293b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroPattern} pointerEvents="none">
              {[...Array(24).keys()].map((i) => (
                <View key={i} style={styles.heroDot} />
              ))}
            </View>
            {logoUrl && !logoFailed ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.logo}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoInitials}>{initials}</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.heroBody}>
            <View style={styles.titleRow}>
              <Text style={styles.firmName} numberOfLines={3}>
                {firmName}
              </Text>
              {firm.firmType ? (
                <View style={styles.typeChip}>
                  <Text style={styles.typeChipText} numberOfLines={1}>
                    {firm.firmType}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Owner row — only when the API returns it. */}
            {firm.owner && firm.owner.name ? (
              <View style={styles.ownerRow}>
                <View style={styles.ownerAvatar}>
                  <Feather name="user" size={12} color={colors.primary} />
                </View>
                <Text style={styles.ownerName} numberOfLines={1}>
                  {firm.owner.name}
                </Text>
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>Owner</Text>
                </View>
              </View>
            ) : null}

            {/* Stat pills — city · pros · est · rating. */}
            <View style={styles.statRow}>
              {firm.city ? (
                <StatPill icon="map-pin" label={firm.city} />
              ) : null}
              <StatPill
                icon="users"
                label={`${proCount} ${proCount === 1 ? 'professional' : 'professionals'}`}
              />
              {firm.establishedYear ? (
                <StatPill
                  icon="calendar"
                  label={`Est. ${firm.establishedYear}`}
                />
              ) : null}
              {avgRating ? (
                <StatPill
                  icon="star"
                  label={`${avgRating.toFixed(1)} (${reviewCount || firm.reviewsCount || 0})`}
                  tone="amber"
                />
              ) : null}
            </View>

            {/* Masked contact pills — visible at a glance, but the
                actual handoff goes through the Contact-firm CTA. */}
            {email || phone || website ? (
              <View style={styles.contactPillRow}>
                {email ? (
                  <View style={styles.contactPill}>
                    <Feather name="mail" size={11} color={colors.textMuted} />
                    <Text style={styles.contactPillText}>
                      {maskEmail(email)}
                    </Text>
                  </View>
                ) : null}
                {phone ? (
                  <View style={styles.contactPill}>
                    <Feather name="phone" size={11} color={colors.textMuted} />
                    <Text style={styles.contactPillText}>
                      {maskPhone(firm.contactNumber || phone)}
                    </Text>
                  </View>
                ) : null}
                {website ? (
                  <Pressable
                    onPress={() => openLink(website)}
                    style={[styles.contactPill, styles.contactPillLink]}
                  >
                    <Feather name="globe" size={11} color={colors.primary} />
                    <Text
                      style={[
                        styles.contactPillText,
                        { color: colors.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {website.replace(/^https?:\/\//, '')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {firm.about ? (
              <Text style={styles.aboutPreview} numberOfLines={4}>
                {firm.about}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ============== 2. Firm details ============== */}
        {hasFacts || documents.length > 0 || socialEntries.length > 0 ? (
          <Card>
            <SectionHead icon="info" title="Firm details" />

            {hasFacts ? (
              <View style={styles.factsGrid}>
                {firm.registrationNumber ? (
                  <FactRow
                    icon="hash"
                    label="Registration number"
                    value={firm.registrationNumber}
                  />
                ) : null}
                {firm.numberOfProfessionals ? (
                  <FactRow
                    icon="users"
                    label="Number of professionals"
                    value={firm.numberOfProfessionals}
                  />
                ) : null}
                {firm.totalEmployees ? (
                  <FactRow
                    icon="users"
                    label="Total employees"
                    value={firm.totalEmployees}
                  />
                ) : null}
                {firm.establishedYear ? (
                  <FactRow
                    icon="calendar"
                    label="Established"
                    value={firm.establishedYear}
                  />
                ) : null}
                {website ? (
                  <FactRow
                    icon="globe"
                    label="Website"
                    value={website.replace(/^https?:\/\//, '')}
                    onPress={() => openLink(website)}
                    accent
                  />
                ) : null}
              </View>
            ) : null}

            {documents.length > 0 ? (
              <>
                <Text style={[styles.subSectionLabel, { marginTop: spacing.lg }]}>
                  Documents
                </Text>
                <View style={styles.chipsWrap}>
                  {documents.map((d) => (
                    <Pressable
                      key={d.label}
                      onPress={() => openLink(d.url)}
                      style={({ pressed }) => [
                        styles.docChip,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Feather
                        name="file-text"
                        size={13}
                        color={colors.primary}
                      />
                      <Text style={styles.docChipText}>{d.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {socialEntries.length > 0 ? (
              <>
                <Text style={[styles.subSectionLabel, { marginTop: spacing.lg }]}>
                  Social media
                </Text>
                <View style={styles.chipsWrap}>
                  {socialEntries.map(([key, url]) => {
                    const meta = SOCIAL_META[key] || {
                      label: key,
                      icon: 'globe',
                    };
                    return (
                      <Pressable
                        key={key}
                        onPress={() => openLink(normalizeUrl(url))}
                        style={({ pressed }) => [
                          styles.socialChip,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Feather
                          name={meta.icon}
                          size={13}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.socialChipText}>{meta.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </Card>
        ) : null}

        {/* ============== 3. Practice areas ============== */}
        <Card>
          <SectionHead icon="briefcase" title="Practice areas" />
          {practiceAreas.length === 0 ? (
            <Text style={styles.mutedSm}>
              This firm hasn't published its practice areas yet.
            </Text>
          ) : (
            <View style={styles.practiceList}>
              {practiceAreas.map((area) => (
                <View key={area} style={styles.practiceItem}>
                  <Feather name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.practiceText}>{area}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ============== 4. Professionals at this firm ============== */}
        <Card>
          <SectionHead icon="users" title="Professionals at this firm" />
          {members.length === 0 ? (
            <Text style={styles.mutedSm}>
              No professionals are listed yet.
            </Text>
          ) : (
            <View style={styles.memberList}>
              {members.map((m, idx) => {
                const memberKey =
                  m.id || m.professionalId || `${m.name || 'm'}-${idx}`;
                const role = m.role
                  ? String(m.role).replace(/_/g, ' ').toLowerCase()
                  : '';
                const memberCard = (
                  <View style={styles.memberCard}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {computeInitials(m.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.name || 'Member'}
                        </Text>
                        {m.verified ? (
                          <View style={styles.verifiedDot}>
                            <Feather
                              name="check"
                              size={8}
                              color={colors.textInverse}
                            />
                          </View>
                        ) : null}
                      </View>
                      {m.professionalType ? (
                        <Text
                          style={styles.memberType}
                          numberOfLines={1}
                        >
                          {m.professionalType}
                        </Text>
                      ) : null}
                      {role ? (
                        <Text style={styles.memberRole} numberOfLines={1}>
                          {role}
                        </Text>
                      ) : null}
                    </View>
                    {m.professionalId || m.id ? (
                      <Feather
                        name="chevron-right"
                        size={16}
                        color={colors.textMuted}
                      />
                    ) : null}
                  </View>
                );
                if (m.professionalId || m.id) {
                  return (
                    <Pressable
                      key={memberKey}
                      onPress={() => goToProfessional(m.professionalId || m.id)}
                      style={({ pressed }) => [
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      {memberCard}
                    </Pressable>
                  );
                }
                return <View key={memberKey}>{memberCard}</View>;
              })}
            </View>
          )}
        </Card>

        {/* ============== 5. Reviews ============== */}
        <Card>
          <View style={styles.reviewsHead}>
            <View style={{ flex: 1 }}>
              <SectionHead
                icon="message-square"
                title="Reviews of our professionals"
              />
              <Text style={styles.reviewsHint}>
                Clients review individual professionals — a firm's rating is
                the collective rating of every professional working under it.
              </Text>
            </View>
            {reviewCount > 0 ? (
              <View style={styles.reviewSummary}>
                <Text style={styles.reviewAvg}>{avgRating.toFixed(1)}</Text>
                <StarBar rating={avgRating} size={12} />
                <Text style={styles.reviewCount}>
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </Text>
              </View>
            ) : null}
          </View>

          {reviewCount === 0 ? (
            <View style={styles.emptyReview}>
              <Feather name="star" size={20} color={colors.textMuted} />
              <Text style={styles.emptyReviewText}>
                No reviews yet — be the first to share an experience.
              </Text>
            </View>
          ) : (
            <View style={styles.reviewList}>
              {reviews.slice(0, 6).map((r) => {
                const clientName =
                  r.clientName || r.authorName || r.name || 'Client';
                const reviewedName =
                  r.reviewedProfessionalName ||
                  r.professionalName ||
                  '';
                return (
                  <View key={r.id} style={styles.reviewItem}>
                    {reviewedName ? (
                      <View style={styles.reviewBanner}>
                        <Feather
                          name="user"
                          size={11}
                          color={colors.textMuted}
                        />
                        <Text style={styles.reviewBannerText}>
                          Review of{' '}
                          <Text style={{ fontWeight: fontWeight.bold }}>
                            {reviewedName}
                          </Text>
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.reviewHeadRow}>
                      <View style={styles.reviewAuthorAvatar}>
                        <Text style={styles.reviewAuthorInitials}>
                          {computeInitials(clientName)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.reviewAuthor} numberOfLines={1}>
                          {clientName}
                        </Text>
                        <View style={styles.reviewMetaRow}>
                          <StarBar rating={r.rating} size={11} />
                          <Text style={styles.reviewDate}>
                            {formatDate(r.date || r.createdAt) || ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {r.comment || r.text ? (
                      <Text style={styles.reviewText}>
                        {r.comment || r.text}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
              {reviews.length > 6 ? (
                <Text style={styles.reviewMore}>
                  +{reviews.length - 6} more — open on web for the full list.
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>

      {/* Sticky bottom CTA — always enabled. Opens a lead-capture form
          that posts the visitor's details to /api/leads tied to this
          firm (same flow as the web's "Contact firm" modal). */}
      <View style={styles.ctaBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaLabel} numberOfLines={1}>
            {firmName}
          </Text>
          <Text style={styles.ctaSub} numberOfLines={1}>
            Usually responds within a day
          </Text>
        </View>
        <Pressable
          onPress={onPressContact}
          style={({ pressed }) => [
            styles.ctaBtn,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaFill}
          >
            <Feather
              name="send"
              size={14}
              color={colors.textInverse}
            />
            <Text style={styles.ctaText}>Contact firm</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <ContactFirmModal
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
        firm={firm}
      />
    </View>
  );
}

function SectionHead({ icon, title }) {
  return (
    <View style={styles.sectionHeadRow}>
      <View style={styles.sectionHeadIcon}>
        <Feather name={icon} size={13} color={colors.primary} />
      </View>
      <Text style={styles.sectionHeadTitle}>{title}</Text>
    </View>
  );
}

function StatPill({ icon, label, tone }) {
  const isAmber = tone === 'amber';
  return (
    <View style={[styles.statPill, isAmber && styles.statPillAmber]}>
      <Feather
        name={icon}
        size={11}
        color={isAmber ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[styles.statText, isAmber && { color: colors.primary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function FactRow({ icon, label, value, onPress, accent }) {
  const Body = (
    <View style={styles.factRow}>
      <Feather
        name={icon}
        size={14}
        color={colors.textMuted}
        style={{ marginTop: 3 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text
          style={[styles.factValue, accent && { color: colors.primary }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      >
        {Body}
      </Pressable>
    );
  }
  return Body;
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },

  // Hero card
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  heroBanner: {
    height: 112,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPattern: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    opacity: 0.18,
  },
  heroDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    margin: 9,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  logoPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitials: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  heroBody: { padding: spacing.lg, gap: spacing.sm },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  firmName: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  typeChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  ownerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.successSoft,
  },
  ownerBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: colors.success,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  statPillAmber: { backgroundColor: colors.primarySoft },
  statText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  contactPillRow: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  contactPillLink: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  contactPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  aboutPreview: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 21,
  },

  // Section heads
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionHeadIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  sectionHeadTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  subSectionLabel: {
    marginBottom: spacing.sm,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mutedSm: { fontSize: fontSize.sm, color: colors.textMuted },

  // Firm details — facts grid
  factsGrid: {
    gap: spacing.md,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  factLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  factValue: {
    marginTop: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  docChipText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  socialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  socialChipText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  // Practice areas
  practiceList: { gap: spacing.sm },
  practiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  practiceText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  // Members
  memberList: { gap: spacing.sm },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  memberAvatarText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  verifiedDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberType: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  memberRole: {
    marginTop: 1,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },

  // Reviews
  reviewsHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reviewsHint: {
    marginTop: -4,
    marginLeft: 36,
    marginBottom: 4,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  reviewSummary: {
    alignItems: 'flex-end',
    gap: 2,
  },
  reviewAvg: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  reviewCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  emptyReview: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  emptyReviewText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  reviewList: { gap: spacing.md, marginTop: spacing.sm },
  reviewItem: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  reviewBanner: {
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  reviewBannerText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  reviewHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewAuthorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  reviewAuthorInitials: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  reviewAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  reviewMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  reviewText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  reviewMore: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },

  // Sticky CTA
  ctaBar: {
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
  ctaLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  ctaSub: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  ctaBtn: { flex: 1.2, borderRadius: radius.lg, overflow: 'hidden' },
  ctaFill: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sheetSub: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sheetList: { marginTop: spacing.md, gap: 8 },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  sheetActionLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sheetActionValue: {
    marginTop: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  sheetCancel: {
    marginTop: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
});
