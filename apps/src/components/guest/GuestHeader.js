// GuestHeader — common header used by every guest sub-screen except
// the landing page. Extends up under the status bar so the safe-area
// strip is the same ink colour as the header itself.
//
// Layout:
//   - Status-bar inset on top (handled internally)
//   - 64-px content row, contents vertically centered
//   - Back button left, title center, optional right slot

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const HEADER_CONTENT_HEIGHT = 64;

export default function GuestHeader({ navigation, route, options, back }) {
  const insets = useSafeAreaInsets();
  const title = (options && (options.headerTitle || options.title)) || route?.name || '';
  const canGoBack = back != null || (navigation && navigation.canGoBack && navigation.canGoBack());
  const rightSlot = options && options.headerRight ? options.headerRight() : null;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {canGoBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="arrow-left" size={22} color={colors.textInverse} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={[styles.side, styles.sideRight]}>{rightSlot}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.ink },
  // 64-px content row, contents vertically centered. The header has
  // no extra top/bottom padding inside the row, so the title sits
  // dead-center between the status bar and the screen body.
  row: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  side: {
    minWidth: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: { justifyContent: 'flex-end', flex: 0 },
  iconBtn: { padding: 4, marginLeft: -4 },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.2,
    maxWidth: '78%',
  },
});
