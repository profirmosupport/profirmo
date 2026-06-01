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
  style,
  contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const Inner = keyboard ? KeyboardAvoidingView : View;
  const innerProps = keyboard
    ? {
        behavior: Platform.OS === 'ios' ? 'padding' : undefined,
        style: { flex: 1 },
      }
    : { style: { flex: 1 } };

  return (
    <View style={[styles.root, style]}>
      {headerTone === 'dark' ? (
        <View style={[styles.topStrip, { height: insets.top }]} />
      ) : null}
      <SafeAreaView style={styles.safe} edges={edges}>
        <Inner {...innerProps}>
          {scroll ? (
            <ScrollView
              contentContainerStyle={[styles.scroll, contentStyle]}
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
            <View style={[styles.body, contentStyle]}>{children}</View>
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
});
