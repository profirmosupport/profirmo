// GuestTabBar — custom bottom tab bar used by the guest landing
// navigator. Five tabs: Home, Search, **Talk to Firmo (FAB)**,
// Support, Sign up. The center tab renders as a circular floating
// action button rising above the bar so it reads as the primary
// platform CTA.

import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { imageUrl } from '../../utils/imageUrl';
import { displayName } from '../../utils/formatters';
import { computeInitials } from './ProfessionalHorizontalCard';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const TAB_META = {
  GuestHome: { label: 'Home', icon: 'home' },
  GuestSearch: { label: 'Search', icon: 'search' },
  TalkToFirmo: { label: 'Talk to Firmo', icon: 'message-circle', fab: true },
  GuestSupport: { label: 'Support', icon: 'life-buoy' },
  GuestSignup: { label: 'Account', icon: 'user-plus', avatar: true },
};

export default function GuestTabBar({ state, descriptors, navigation }) {
  const { user } = useAuth();
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
          if (meta.avatar && user) {
            return (
              <AvatarTab
                key={route.key}
                user={user}
                focused={focused}
                onPress={onPress}
              />
            );
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

// AvatarTab — replaces the generic icon for the Account tab when a
// user is signed in. Renders the profile photo (or amber initials
// pill) inside a ring that switches to brand-amber on focus.
function AvatarTab({ user, focused, onPress }) {
  const photoUrl = imageUrl(user && user.profilePhoto);
  // Track image load failures so a stale/404 photo URL falls through
  // to the initials placeholder instead of rendering an empty box.
  const [photoFailed, setPhotoFailed] = useState(false);
  // Compute the placeholder text from any name signal we have; fall
  // back to the email's local part so we still render readable letters
  // (e.g. "VI" for "vishal@…") instead of "?".
  const nameForInitials =
    displayName(user) ||
    (user && user.email ? String(user.email).split('@')[0] : '');
  const initials = computeInitials(nameForInitials);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          styles.avatarRing,
          focused && { borderColor: colors.primary },
        ]}
      >
        {/* Initials live at the base layer — always rendered. A
            successful Image overlays them; if the image is missing,
            slow, errors, or never fires onError, the initials are
            still visible underneath. */}
        <View style={styles.avatarImg}>
          <LinearGradient
            colors={['#fde68a', '#f59e0b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.avatarInitials}>{initials}</Text>
          {photoUrl && !photoFailed ? (
            <Image
              source={{ uri: photoUrl }}
              style={StyleSheet.absoluteFillObject}
              onError={() => setPhotoFailed(true)}
            />
          ) : null}
        </View>
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.primary : colors.textMuted },
        ]}
        numberOfLines={1}
      >
        Account
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
  avatarRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarInitials: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.4,
  },
});
