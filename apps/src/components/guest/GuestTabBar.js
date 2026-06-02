// GuestTabBar — custom bottom tab bar used by the guest landing
// navigator. Five tabs: Home, Search, **Talk to Firmo (FAB)**,
// Support, Sign up. The center tab renders as a circular floating
// action button rising above the bar so it reads as the primary
// platform CTA.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const TAB_META = {
  GuestHome: { label: 'Home', icon: 'home' },
  GuestSearch: { label: 'Search', icon: 'search' },
  TalkToFirmo: { label: 'Talk to Firmo', icon: 'message-circle', fab: true },
  GuestSupport: { label: 'Support', icon: 'life-buoy' },
  GuestSignup: { label: 'Sign up', icon: 'user-plus' },
};

export default function GuestTabBar({ state, descriptors, navigation }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name] || { label: route.name, icon: 'circle' };
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (meta.fab) {
            return <FabTab key={route.key} meta={meta} focused={focused} onPress={onPress} />;
          }
          return (
            <Tab
              key={route.key}
              meta={meta}
              focused={focused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function Tab({ meta, focused, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather
        name={meta.icon}
        size={20}
        color={focused ? colors.primary : colors.textMuted}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.primary : colors.textMuted },
        ]}
      >
        {meta.label}
      </Text>
    </Pressable>
  );
}

function FabTab({ meta, focused, onPress }) {
  return (
    <View style={styles.fabSlot}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.9 : 1 }]}
      >
        <LinearGradient
          colors={['#f59e0b', '#d97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabFill}
        >
          <Feather name={meta.icon} size={26} color={colors.textInverse} />
        </LinearGradient>
      </Pressable>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.primary : colors.textMuted, marginTop: 4 },
        ]}
        numberOfLines={1}
      >
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 68,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -22,
    shadowColor: '#d97706',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
    backgroundColor: '#d97706',
  },
  fabFill: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
});
