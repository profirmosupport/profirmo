// BlogDetailScreen — full post view. Mirrors the redesigned web
// /blog/[slug] page: a full-bleed cover photo (NO text overlay),
// then a clean white block below with category chip, meta row,
// H1, excerpt and an author row. Body paragraphs follow underneath.
// The header right-button uses RN's Share API to send the public URL.

import { useEffect, useLayoutEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBlogPost } from '../../services/blogService';
import { imageUrl } from '../../utils/imageUrl';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const WEB_BASE = 'https://profirmo.com';

// Strip HTML tags + collapse whitespace into plain paragraphs. Good
// enough for the bundled posts; swap in a real renderer if the team
// starts authoring rich content.
function htmlToParagraphs(html) {
  if (!html) return [];
  return String(html)
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BlogDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initial = (route && route.params && route.params.post) || null;
  const slug =
    (route && route.params && route.params.slug) || (initial && initial.slug);
  const [post, setPost] = useState(initial);
  const [error, setError] = useState('');

  useEffect(() => {
    if (post && post.content) return undefined;
    if (!slug) return undefined;
    let active = true;
    (async () => {
      try {
        const fresh = await getBlogPost(slug);
        if (active) setPost(fresh);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load post.');
      }
    })();
    return () => {
      active = false;
    };
  }, [post, slug]);

  // Mount a share button on the header's right side. Tapping it opens
  // the OS app-share sheet via React Native's Share API — every
  // platform surfaces its own list (AirDrop / Messages / WhatsApp /
  // copy link / etc.) so users land on the channel they prefer.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          hitSlop={10}
          onPress={() => handleShare(post).catch(() => {})}
          style={({ pressed }) => [
            styles.headerShareBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="share-2" size={16} color={colors.textInverse} />
        </Pressable>
      ),
    });
  }, [navigation, post]);

  if (error) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!post) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  const cover = imageUrl(post.featuredImage || post.ogImage || post.coverImage);
  const paragraphs = htmlToParagraphs(post.content);
  const categoryName =
    (post.category && (post.category.name || post.category)) || '';
  const authorName =
    (post.author && (post.author.name || post.author)) || post.authorName || '';
  const publishedAt = post.publishedAt || post.createdAt;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover image — full-bleed banner, NO text overlay. Falls back
            to a warm amber gradient so the page still feels intentional
            when a post has no featured image. */}
        <View style={styles.coverWrap}>
          {cover ? (
            <Image
              source={{ uri: cover }}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#fde68a', '#fed7aa', '#fef3c7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cover}
            >
              <Feather
                name="file-text"
                size={42}
                color="rgba(146,64,14,0.55)"
              />
            </LinearGradient>
          )}
        </View>

        {/* Title block — clean white area below the cover. Heading
            never sits on top of the image. */}
        <View style={styles.titleBlock}>
          <View style={styles.metaRow}>
            {categoryName ? (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryText} numberOfLines={1}>
                  {categoryName}
                </Text>
              </View>
            ) : null}
            {publishedAt ? (
              <View style={styles.metaPill}>
                <Feather name="calendar" size={11} color={colors.textMuted} />
                <Text style={styles.metaText}>{formatDate(publishedAt)}</Text>
              </View>
            ) : null}
            {post.readingMinutes ? (
              <View style={styles.metaPill}>
                <Feather name="clock" size={11} color={colors.textMuted} />
                <Text style={styles.metaText}>
                  {post.readingMinutes} min read
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{post.title}</Text>

          {post.excerpt ? (
            <Text style={styles.excerpt}>{post.excerpt}</Text>
          ) : null}

          {authorName ? (
            <View style={styles.authorRow}>
              <View style={styles.authorAvatar}>
                <Feather name="user" size={14} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {authorName}
                </Text>
                <Text style={styles.authorSub} numberOfLines={1}>
                  {publishedAt
                    ? `Published ${formatDate(publishedAt)}`
                    : 'Profirmo Journal'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Body */}
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bodyWrap}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.body}>
              {p}
            </Text>
          ))}

          {/* Footer share row — secondary affordance for users who
              swipe past the system-bar share icon. */}
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Found this helpful? Share it.</Text>
            <ShareRow post={post} />
          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

function ShareRow({ post }) {
  return (
    <View style={styles.shareRow}>
      <ShareButton
        label="Share"
        icon="share-2"
        onPress={() => handleShare(post).catch(() => {})}
      />
      <ShareButton
        label="Copy link"
        icon="link"
        onPress={() => handleShare(post, true).catch(() => {})}
      />
    </View>
  );
}

function ShareButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shareBtn,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={styles.shareBtnText}>{label}</Text>
    </Pressable>
  );
}

async function handleShare(post, copyOnly = false) {
  if (!post) return;
  const url = `${WEB_BASE}/blog/${post.slug}`;
  // IMPORTANT: iOS renders BOTH `message` and `url` if both are set,
  // which duplicates the link in the shared payload. Send only one —
  // `message` with the URL embedded — so every channel sees the link
  // exactly once.
  const message = `${post.title}\n\n${post.excerpt || ''}\n\n${url}`.trim();
  if (copyOnly) {
    // RN doesn't bundle a clipboard helper without expo-clipboard.
    // Re-use the share sheet — every OS surfaces a "copy" option there.
    return Share.share({ message: url, title: post.title });
  }
  return Share.share({ message, title: post.title });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['2xl'] },

  // Cover — sits inside a padded slot so it reads as a rounded card,
  // not a screen-edge banner. Aspect 16:9 matches the web redesign.
  coverWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  titleBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },

  title: {
    marginTop: spacing.md,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  excerpt: {
    marginTop: spacing.sm,
    fontSize: fontSize.base,
    lineHeight: 24,
    color: colors.textSecondary,
  },

  authorRow: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  authorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  authorName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  authorSub: {
    marginTop: 1,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },

  bodyWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  body: {
    marginBottom: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: 25,
  },

  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  shareRow: { flexDirection: 'row', gap: 8 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  muted: { padding: spacing.lg, color: colors.textSecondary },
  error: { padding: spacing.lg, color: colors.danger },

  // Header share button — pill on the dark ink header so the icon is
  // legible (the title sits on the same dark background).
  headerShareBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
