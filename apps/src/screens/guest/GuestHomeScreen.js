// GuestHomeScreen — landing page shown after Skip on the welcome
// screen. Sections, top → bottom:
//
//   1. Hero (ink gradient + AI / sign-up CTAs)
//   2. Search CTA → "Experts a call away" horizontal carousel
//      → "Firms on Profirmo" horizontal carousel
//      → "Area of expertise" chip strip
//   3. Blog & News (image-led cards)
//
// All sections live under the dark safe-area strip (no nav header).

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../../components/common/ScreenContainer';
import Section from '../../components/common/Section';
import EmptyState from '../../components/common/EmptyState';
import {
  BlogCardSkeleton,
  CardSkeleton,
  FirmCardSkeleton,
  ProfessionalCardSkeleton,
} from '../../components/common/Skeleton';
import HeroSection from '../../components/guest/HeroSection';
import ProfessionalHorizontalCard, {
  PRO_CARD_WIDTH,
} from '../../components/guest/ProfessionalHorizontalCard';
import FirmCard, { FIRM_CARD_WIDTH } from '../../components/guest/FirmCard';
import BlogCard from '../../components/guest/BlogCard';
import ExpertiseTile from '../../components/guest/ExpertiseTile';
import GuestHomeLoader from '../../components/guest/GuestHomeLoader';
import { useAuth } from '../../contexts/AuthContext';
import { listCategories } from '../../services/appSettingsService';
import { listBlogPosts } from '../../services/blogService';
import {
  listFirmsPublic,
  listProfessionals,
} from '../../services/professionalService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// Horizontal carousels get a generous bleed past the screen edge so
// the next card peeks in, signalling there's more to scroll.
const CAROUSEL_GAP = 12;

// Navigate to the Search tab's inner screen with params. Passing
// params to the tab itself doesn't reach the screen inside the
// stack — react-navigation needs the nested `screen` + `params`
// shape to deliver them properly.
function goToSearch(navigation, params = {}) {
  navigation.getParent()?.navigate('GuestSearch', {
    screen: 'GuestSearchMain',
    params,
  });
}

// Same helper for landing on Search inside the Home stack — used by
// pro/firm card "View profile" taps so we land on the catalog and can
// drill into the detail screen from there.
function goToDetail(navigation, professionalId) {
  navigation.navigate('ProfessionalDetail', { professionalId });
}

function goToBooking(navigation, professionalId) {
  navigation.navigate('Booking', { professionalId });
}

export default function GuestHomeScreen({ navigation }) {
  const { user, exitGuest } = useAuth();
  const [pros, setPros] = useState([]);
  const [firms, setFirms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loadingPros, setLoadingPros] = useState(true);
  const [loadingFirms, setLoadingFirms] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadingPros(true);
    setLoadingFirms(true);
    setLoadingCats(true);
    setLoadingPosts(true);
    const [proRes, firmRes, catRes, postRes] = await Promise.allSettled([
      listProfessionals({ limit: 8 }),
      listFirmsPublic({ limit: 6 }),
      listCategories(),
      listBlogPosts({ limit: 5 }),
    ]);
    if (proRes.status === 'fulfilled')
      setPros((proRes.value && proRes.value.items) || []);
    if (firmRes.status === 'fulfilled')
      setFirms((firmRes.value && firmRes.value.items) || []);
    if (catRes.status === 'fulfilled') setCategories(catRes.value || []);
    if (postRes.status === 'fulfilled') setPosts(postRes.value || []);
    setLoadingPros(false);
    setLoadingFirms(false);
    setLoadingCats(false);
    setLoadingPosts(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Flatten {Legal: [...], Tax: [...]} into up to 8 tiles, tagging
  // each with its parent so the tile can render a small eyebrow.
  const expertiseTiles = (() => {
    const out = [];
    for (const c of categories) {
      for (const s of c.subCategories || []) {
        out.push({ id: s.id, label: s.name, parent: c.name });
        if (out.length >= 8) break;
      }
      if (out.length >= 8) break;
    }
    return out;
  })();

  // Initial cold-start state — every section is fetching for the
  // first time. Use the branded loader instead of stacking skeletons
  // inside the real layout so the "Welcome to Profirmo" moment lands.
  const firstLoad =
    loadingPros &&
    loadingFirms &&
    loadingCats &&
    loadingPosts &&
    pros.length === 0 &&
    firms.length === 0 &&
    posts.length === 0;
  if (firstLoad) return <GuestHomeLoader />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={load}>
      <HeroSection
        onPressAi={() => navigation.navigate('TalkToFirmo')}
        onPressSignup={exitGuest}
        showSignup={!user}
      />

      {/* ---- Section 2: Search + experts + firms + expertise ---- */}
      <View style={styles.searchBlock}>
        {/* "Search professionals & firms" — dark ink panel with amber
            accent. Visually the headline tile on the landing page. */}
        <Pressable
          onPress={() => goToSearch(navigation)}
          style={({ pressed }) => [
            styles.searchCta,
            styles.darkCta,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <View style={[styles.searchIcon, styles.darkIcon]}>
            <Feather name="search" size={16} color="#fbbf24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.searchCtaTitle, styles.darkTitle]}>
              Search professionals & firms
            </Text>
            <Text style={[styles.searchCtaSub, styles.darkSub]}>
              Filter by city, profession, and expertise
            </Text>
          </View>
          <Feather name="arrow-right" size={16} color="#fbbf24" />
        </Pressable>

        {/* E-Courts India — sibling tile under the Search CTA. Light
            surface card. Taps into the Home stack's ECourtsSearch
            screen for the full lookup + case detail + download flow. */}
        <Pressable
          onPress={() => navigation.navigate('ECourtsSearch')}
          style={({ pressed }) => [
            styles.searchCta,
            styles.lightCta,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <View style={styles.searchIcon}>
            <Feather name="award" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.searchCtaTitle}>E-Courts India</Text>
            <Text style={[styles.searchCtaSub, styles.lightAccentSub]}>
              Powered By E-CourtsIndia.com
            </Text>
          </View>
          <Feather name="arrow-right" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.sectionGap}>
        <Section
          title="Experts a call away"
          subtitle="Verified pros ready to consult"
          action={
            <Pressable onPress={() => goToSearch(navigation)}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          }
        >
          {loadingPros ? (
            <SkeletonRow Component={ProfessionalCardSkeleton} />
          ) : pros.length === 0 ? (
            <EmptyState
              icon="user"
              title="No professionals yet"
              description="Verified professionals will appear here once they join."
            />
          ) : (
            <FlatList
              data={pros}
              horizontal
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              style={styles.carouselBleed}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => (
                <View style={{ width: CAROUSEL_GAP }} />
              )}
              snapToInterval={PRO_CARD_WIDTH + CAROUSEL_GAP}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <ProfessionalHorizontalCard
                  pro={item}
                  onPressProfile={() => goToDetail(navigation, item.id)}
                  onPressBook={() => goToBooking(navigation, item.id)}
                />
              )}
            />
          )}
        </Section>
      </View>

      <View style={styles.sectionGap}>
        <Section
          title="Firms on Profirmo"
          subtitle="Established practices, vetted teams"
          action={
            <Pressable onPress={() => goToSearch(navigation)}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          }
        >
          {loadingFirms ? (
            <SkeletonRow Component={FirmCardSkeleton} />
          ) : firms.length === 0 ? (
            <EmptyState
              icon="briefcase"
              title="No firms yet"
              description="Firm pages will appear here as practices onboard."
            />
          ) : (
            <FlatList
              data={firms}
              horizontal
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              style={styles.carouselBleed}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => (
                <View style={{ width: CAROUSEL_GAP }} />
              )}
              snapToInterval={FIRM_CARD_WIDTH + CAROUSEL_GAP}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <FirmCard
                  firm={item}
                  onPress={() =>
                    navigation.navigate('FirmDetail', { firmId: item.id })
                  }
                />
              )}
            />
          )}
        </Section>
      </View>

      <ExpertisePanel
        loading={loadingCats}
        tiles={expertiseTiles}
        onPickTile={(id) => goToSearch(navigation, { categoryId: id })}
      />

      {/* ---- Section 3: Blog & News ---- */}
      <View style={styles.sectionGap}>
        <Section
          title="Blog & News"
          subtitle="Tax, legal and compliance updates"
          action={
            <Pressable onPress={() => navigation.navigate('BlogList')}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          }
        >
          {loadingPosts ? (
            <View style={{ gap: spacing.md }}>
              <BlogCardSkeleton />
              <BlogCardSkeleton />
            </View>
          ) : posts.length === 0 ? (
            <EmptyState
              icon="file-text"
              title="No posts yet"
              description="The team is working on the first articles."
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {posts.slice(0, 5).map((p) => (
                <BlogCard
                  key={p.id}
                  post={p}
                  onPress={() =>
                    navigation.navigate('BlogDetail', { slug: p.slug, post: p })
                  }
                />
              ))}
            </View>
          )}
        </Section>
      </View>
    </ScreenContainer>
  );
}

// ExpertisePanel — full-bleed brand-coloured section. Soft amber
// gradient background with decorative blobs + 2-column grid of
// ExpertiseTile cards. Mirrors the brand palette top-to-bottom so it
// reads as one cohesive block instead of a list of disparate chips.
function ExpertisePanel({ loading, tiles, onPickTile }) {
  return (
    <View style={styles.expertiseWrap}>
      <LinearGradient
        // High-contrast brand pairing: ink panel behind amber tiles.
        // Reads as a single premium block, like the marketing site's
        // dark sections.
        colors={['#0b1220', '#0f172a', '#1e293b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.expertisePanel}
      >
        {/* Decorative amber blobs sit on the dark background — make
            the section feel like a premium "spotlight" panel. */}
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
        {/* Subtle dot grid for visual texture. */}
        <View style={styles.dotGrid} pointerEvents="none">
          {[...Array(20).keys()].map((i) => (
            <View key={i} style={styles.gridDot} />
          ))}
        </View>

        <View style={styles.expertiseHeader}>
          <Text style={styles.expertiseTitle}>Area of expertise</Text>
          <Text style={styles.expertiseSubtitle}>
            Pick a specialty to filter the catalog
          </Text>
        </View>

        {loading ? (
          <View style={styles.tileGrid}>
            <View style={{ flexBasis: '48%' }}>
              <CardSkeleton />
            </View>
            <View style={{ flexBasis: '48%' }}>
              <CardSkeleton />
            </View>
          </View>
        ) : tiles.length === 0 ? (
          <EmptyState
            icon="tag"
            title="No specialties yet"
            description="An admin will publish specialties soon."
          />
        ) : (
          <View style={styles.tileGrid}>
            {tiles.map((c) => (
              <ExpertiseTile
                key={c.id}
                label={c.label}
                parent={c.parent}
                onPress={() => onPickTile(c.id)}
              />
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

function SkeletonRow({ Component = ProfessionalCardSkeleton }) {
  return (
    <View style={{ flexDirection: 'row', gap: CAROUSEL_GAP }}>
      <Component />
      <Component />
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },

  searchBlock: {
    // Hero already pads itself; this margin separates it from the
    // search CTA card.
    marginTop: spacing.xl,
  },
  searchCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCtaTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  searchCtaSub: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  // Dark-ink variant — applied to the "Search professionals & firms"
  // headline tile. Amber accent against a slate-950 background.
  darkCta: {
    backgroundColor: '#0f172a',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  darkIcon: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  darkTitle: { color: '#fff' },
  darkSub: { color: 'rgba(255,255,255,0.7)' },

  // Light-surface sibling — applied to the E-Courts India tile. Uses
  // the standard surface card with an amber accent on the "Powered By"
  // caption to keep the brand attribution legible.
  lightCta: {
    marginTop: spacing.sm,
  },
  lightAccentSub: {
    color: colors.primarySoftText,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },

  // Every Section after the search CTA gets a generous gap so the
  // landing page reads as discrete blocks, not a wall of text.
  sectionGap: { marginTop: spacing.xl },

  // Horizontal carousel bleeds past the screen edge so the next card
  // peeks in at the right side.
  carouselBleed: {
    marginHorizontal: -spacing.lg,
  },
  carouselContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
  },

  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  // Expertise panel — ink "spotlight" block with amber accents. Amber
  // tiles inside read against a deep dark background for high contrast.
  expertiseWrap: {
    marginTop: spacing.xl,
    marginHorizontal: -spacing.lg,
  },
  expertisePanel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: {
    top: -80,
    right: -70,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(217,119,6,0.18)',
  },
  blobB: {
    bottom: -60,
    left: -60,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(13,148,136,0.16)',
  },
  // 4 x 5 grid of tiny amber dots — adds visual interest without an
  // image asset.
  dotGrid: {
    position: 'absolute',
    top: 20,
    left: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 100,
    opacity: 0.5,
  },
  gridDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(217,119,6,0.5)',
    margin: 8,
  },
  expertiseHeader: {
    marginBottom: spacing.md,
  },
  expertiseTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  expertiseSubtitle: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.65)',
  },
});
