// BlogDetailScreen — full post view. Hero cover photo with overlayed
// title + meta, then content rendered as plain paragraphs. The
// header right-button uses RN's Share API to send the public URL.

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
  const slug = (route && route.params && route.params.slug) || (initial && initial.slug);
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

  // Replace the stack navigator's header right-icon with a share button
  // so it lives in the system bar instead of competing with the cover.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          hitSlop={8}
          onPress={() =>
            handleShare(post).catch(() => {})
          }
        >
          <Feather name="share-2" size={18} color={colors.textPrimary} />
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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover hero — image with title + meta overlay. */}
        <View style={styles.hero}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={['#fde68a', '#f59e0b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroImage}
            >
              <Feather name="file-text" size={48} color="rgba(255,255,255,0.92)" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={[
              'rgba(11,18,32,0)',
              'rgba(11,18,32,0.5)',
              'rgba(11,18,32,0.92)',
            ]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.heroBody}>
            {post.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {post.category.name || post.category}
                </Text>
              </View>
            ) : null}
            <Text style={styles.heroTitle}>{post.title}</Text>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={11} color="rgba(255,255,255,0.75)" />
              <Text style={styles.metaText}>
                {formatDate(post.publishedAt || post.createdAt)}
              </Text>
              {post.author ? (
                <>
                  <View style={styles.metaDot} />
                  <Feather name="user" size={11} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.metaText}>
                    {post.author.name || post.author}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bodyWrap}>
          {post.excerpt ? (
            <View style={styles.leadCard}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={styles.lead}>{post.excerpt}</Text>
            </View>
          ) : null}

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
  const message = `${post.title}\n\n${post.excerpt || ''}\n\n${url}`.trim();
  if (copyOnly) {
    // RN doesn't bundle a clipboard helper without expo-clipboard.
    // Re-use the share sheet — every OS surfaces a "copy" option there.
    return Share.share({ message: url, url, title: post.title });
  }
  return Share.share({
    message,
    url,
    title: post.title,
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['2xl'] },

  hero: { width: '100%', aspectRatio: 16 / 11, backgroundColor: colors.surfaceMuted },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    marginBottom: spacing.sm,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: fontWeight.semibold },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)', marginHorizontal: 4 },

  bodyWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  leadCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: spacing.lg,
  },
  lead: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primarySoftText,
    lineHeight: 21,
    fontWeight: fontWeight.medium,
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
});
