import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

// ScreenContainer — every screen's outer wrapper.
//
// Two-layer construction:
//   1. A dark "header strip" View fills the top status-bar inset so the
//      status bar icons sit on a dark background app-wide. This pairs
//      with <StatusBar style="light" /> in App.js for white icons.
//   2. The actual content lives inside a SafeAreaView pinned to the
//      light surface bg, padded for any remaining edges (typically
//      left/right; auth screens add bottom).
//
// Props:
//   scroll      true (default) renders a ScrollView; false hands
//               scrolling to the child (FlatList).
//   refreshing,
//   onRefresh   enable pull-to-refresh on scroll views.
//   edges       which safe-area edges to inset *for the body*. Default
//               ['left','right']; auth screens pass ['bottom','left',
//               'right']. Top is always handled by the dark strip.
//   keyboard    wrap content in KeyboardAvoidingView so inputs stay
//               visible above the iOS keyboard. Default false.
//   headerTone  'dark' (default) fills the status-bar inset with the
//               brand ink color. 'transparent' lets the body bg show
//               through (used for screens that paint their own header
//               into the safe-area, like the splash).

export default function ScreenContainer({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['left', 'right'],
  keyboard = false,
  headerTone = 'dark',
  // hasNavHeader=true tells the container that a navigator already
  // owns the top inset (custom GuestHeader on guest sub-screens etc).
  // We then skip the local topStrip AND drop the body's default
  // 16-px top padding so content sits flush below the header.
  hasNavHeader = false,
  // bleedTop=true lets the FIRST child render under the status bar.
  // We skip the ink topStrip AND the body's 16-px top padding AND
  // make the SafeAreaView ignore the top inset, so a hero gradient
  // can paint all the way to y=0. The hero itself is expected to
  // pad its content past `insets.top`.
  bleedTop = false,
  style,
  contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const Inner = keyboard ? KeyboardAvoidingView : View;
  // The 64 below matches the navigator-header content height. With
  // `hasNavHeader=true` we tell KeyboardAvoidingView to add the header
  // + status-bar inset to its vertical offset so the keyboard
  // animation pushes the input fully above the keyboard rather than
  // stopping at the header line.
  const keyboardOffset = hasNavHeader ? insets.top + 64 : insets.top;
  const innerProps = keyboard
    ? {
        behavior: Platform.OS === 'ios' ? 'padding' : 'height',
        keyboardVerticalOffset: keyboardOffset,
        style: { flex: 1 },
      }
    : { style: { flex: 1 } };

  // Suppress the local ink strip when a navigator header is already
  // painting the top inset — otherwise we get two dark blocks.
  const showTopStrip = headerTone === 'dark' && !hasNavHeader && !bleedTop;
  const safeEdges = bleedTop
    ? edges.filter((e) => e !== 'top')
    : edges;
  return (
    <View style={[styles.root, style]}>
      {showTopStrip ? (
        <View style={[styles.topStrip, { height: insets.top }]} />
      ) : null}
      <SafeAreaView style={styles.safe} edges={safeEdges}>
        <Inner {...innerProps}>
          {scroll ? (
            <ScrollView
              contentContainerStyle={[
                styles.scroll,
                hasNavHeader && styles.scrollUnderHeader,
                bleedTop && styles.scrollBleedTop,
                contentStyle,
              ]}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={!!refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                  />
                ) : undefined
              }
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.body,
                hasNavHeader && styles.bodyUnderHeader,
                bleedTop && styles.bodyBleedTop,
                contentStyle,
              ]}
            >
              {children}
            </View>
          )}
        </Inner>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer container — ink so the status-bar strip never has a fallback
  // light flash before insets resolve.
  root: { flex: 1, backgroundColor: colors.ink },
  // The dark strip the user sees behind the status bar icons.
  topStrip: { backgroundColor: colors.ink, width: '100%' },
  // The body wrapper — light surface; covers the rest of the screen.
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: spacing.lg },
  scroll: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  // Variants when a navigator header sits above — flush top so the
  // header → content boundary reads as one block.
  scrollUnderHeader: { paddingTop: 0 },
  bodyUnderHeader: { paddingTop: 0 },
  // bleedTop: the first child (a hero gradient) paints under the
  // status bar. Zero top padding + no horizontal padding constraint
  // so the hero can stretch edge-to-edge.
  scrollBleedTop: { paddingTop: 0 },
  bodyBleedTop: { paddingTop: 0 },
});
