// BlogCard — image-led blog post card. 16:9 cover image at the top
// (gracefully falls back to a brand placeholder gradient when the
// post has no featuredImage), then title + excerpt + meta row.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { imageUrl } from '../../utils/imageUrl';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function BlogCard({ post, onPress, compact = false }) {
  const cover = imageUrl(post.featuredImage || post.ogImage || post.coverImage);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.imageWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.image} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['#fde68a', '#f59e0b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.image}
          >
            <Feather name="file-text" size={24} color="rgba(255,255,255,0.92)" />
          </LinearGradient>
        )}
        {post.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {post.category.name || post.category}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
        {post.excerpt ? (
          <Text style={styles.excerpt} numberOfLines={compact ? 2 : 3}>
            {post.excerpt}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Feather name="calendar" size={11} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {formatDate(post.publishedAt || post.createdAt)}
          </Text>
          {post.author ? (
            <>
              <View style={styles.metaDot} />
              <Feather name="user" size={11} color={colors.textMuted} />
              <Text style={styles.metaText}>
                {post.author.name || post.author}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
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
  cardCompact: { flexDirection: 'row' }, // reserved for a future side-by-side variant
  imageWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surfaceMuted },
  image: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11,18,32,0.85)',
  },
  categoryText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: { padding: spacing.md },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  excerpt: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong, marginHorizontal: 4 },
});
