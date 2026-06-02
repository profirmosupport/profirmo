// BlogListScreen — full FlatList of posts using the image-led
// BlogCard. Pagination handled via onEndReached.

import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import EmptyState from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import BlogCard from '../../components/guest/BlogCard';
import { listBlogPosts } from '../../services/blogService';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const PAGE_SIZE = 10;

export default function BlogListScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(async (p, replace = false) => {
    if (p === 1) setLoadingFirst(true);
    else setLoadingMore(true);
    try {
      const rows = await listBlogPosts({ page: p, limit: PAGE_SIZE });
      setItems((prev) => (replace ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      if (replace) setItems([]);
      setHasMore(false);
    } finally {
      setLoadingFirst(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  function onRefresh() {
    setRefreshing(true);
    setPage(1);
    fetchPage(1, true);
  }

  function onEndReached() {
    if (loadingFirst || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage);
  }

  if (loadingFirst) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Blog & News</Text>
        <View style={{ gap: spacing.md }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm }}>
            <Text style={styles.title}>Blog & News</Text>
            <Text style={styles.subtitle}>
              Tax, legal and compliance updates
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="file-text"
            title="No posts yet"
            description="The team is working on the first articles."
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: spacing.md }}>
              <CardSkeleton />
            </View>
          ) : null
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <BlogCard
            post={item}
            onPress={() =>
              navigation.navigate('BlogDetail', { slug: item.slug, post: item })
            }
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
