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
import ScreenContainer from '../../components/common/ScreenContainer';
import Section from '../../components/common/Section';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import HeroSection from '../../components/guest/HeroSection';
import ProfessionalHorizontalCard, {
  PRO_CARD_WIDTH,
} from '../../components/guest/ProfessionalHorizontalCard';
import FirmCard, { FIRM_CARD_WIDTH } from '../../components/guest/FirmCard';
import BlogCard from '../../components/guest/BlogCard';
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

export default function GuestHomeScreen({ navigation }) {
  const { exitGuest } = useAuth();
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

  // Flatten {Legal: [...], Tax: [...]} into up to 8 chips.
  const expertiseChips = (() => {
    const out = [];
    for (const c of categories) {
      for (const s of c.subCategories || []) {
        out.push({ id: s.id, label: s.name });
        if (out.length >= 8) break;
      }
      if (out.length >= 8) break;
    }
    return out;
  })();

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={load}>
      <HeroSection
        onPressAi={() => navigation.navigate('TalkToFirmo')}
        onPressSignup={exitGuest}
      />

      {/* ---- Section 2: Search + experts + firms + expertise ---- */}
      <View style={styles.searchBlock}>
        <Pressable
          onPress={() => navigation.getParent()?.navigate('GuestSearch')}
          style={({ pressed }) => [
            styles.searchCta,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <View style={styles.searchIcon}>
            <Feather name="search" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.searchCtaTitle}>
              Search professionals & firms
            </Text>
            <Text style={styles.searchCtaSub}>
              Filter by city, profession, and expertise
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
            <Pressable
              onPress={() => navigation.getParent()?.navigate('GuestSearch')}
            >
              <Text style={styles.link}>View all</Text>
            </Pressable>
          }
        >
          {loadingPros ? (
            <SkeletonRow />
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
                  onPressProfile={() =>
                    navigation.getParent()?.navigate('GuestSearch', {
                      professionalId: item.id,
                    })
                  }
                  onPressBook={exitGuest}
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
            <Pressable
              onPress={() => navigation.getParent()?.navigate('GuestSearch')}
            >
              <Text style={styles.link}>View all</Text>
            </Pressable>
          }
        >
          {loadingFirms ? (
            <SkeletonRow />
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
                    navigation.getParent()?.navigate('GuestSearch', {
                      firmId: item.id,
                    })
                  }
                />
              )}
            />
          )}
        </Section>
      </View>

      <View style={styles.sectionGap}>
        <Section
          title="Area of expertise"
          subtitle="Pick a specialty to filter the catalog"
        >
          {loadingCats ? (
            <CardSkeleton />
          ) : expertiseChips.length === 0 ? (
            <EmptyState
              icon="tag"
              title="No specialties yet"
              description="An admin will publish specialties soon."
            />
          ) : (
            <View style={styles.chipRow}>
              {expertiseChips.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() =>
                    navigation
                      .getParent()
                      ?.navigate('GuestSearch', { categoryId: c.id })
                  }
                  style={({ pressed }) => [
                    styles.chip,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather name="tag" size={11} color={colors.primary} />
                  <Text style={styles.chipText}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Section>
      </View>

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
              <CardSkeleton />
              <CardSkeleton />
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

function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', gap: CAROUSEL_GAP }}>
      <View style={{ width: PRO_CARD_WIDTH }}>
        <CardSkeleton />
      </View>
      <View style={{ width: PRO_CARD_WIDTH }}>
        <CardSkeleton />
      </View>
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
