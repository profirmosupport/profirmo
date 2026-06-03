// DashboardScreen — single entry point for the per-role dashboard.
// Renders the role-specific dashboard body (Client or Professional)
// underneath a transparent floating top strip: a hamburger on the
// left (opens SideNavDrawer with every feature for the role) and a
// notifications bell on the right.
//
// The dashboard body owns the visible top — its own hero gradient
// extends up under the icons, so the screen never shows a flat
// header bar with a "Dashboard" title.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import ClientDashboardScreen from '../client/ClientDashboardScreen';
import ProDashboardScreen from '../professional/ProDashboardScreen';
import SideNavDrawer from '../../components/common/SideNavDrawer';
import { ROLES } from '../../config/constants';
import { colors, spacing } from '../../theme';

// Map a drawer item key to the navigation route inside the dashboard
// stack. Both role variants share the same stack (registered in the
// MainTabs Account stack), so a single map covers both.
const ROUTE_BY_KEY = {
  profile: 'AccountProfile',
  bookings: 'AccountBookings',
  cases: 'AccountCases',
  payments: 'AccountPayments',
  wallet: 'AccountWallet',
  subscription: 'AccountSubscription',
  firm: 'AccountFirm',
  notifications: 'AccountNotifications',
};

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const role =
    user && user.role === ROLES.PROFESSIONAL ? 'professional' : 'client';

  function handleSelect(key) {
    const route = ROUTE_BY_KEY[key];
    if (route) navigation.navigate(route);
  }

  async function handleSignOut() {
    try {
      await logout?.();
    } catch {
      /* logout is best-effort; the auth context still clears state */
    }
  }

  return (
    <View style={styles.root}>
      {/* Dashboard body fills the entire screen. Its hero gradient
          extends up under the floating top icons. */}
      <View style={styles.body}>
        {role === 'professional' ? (
          <ProDashboardScreen navigation={navigation} />
        ) : (
          <ClientDashboardScreen navigation={navigation} />
        )}
      </View>

      {/* Floating top strip — sits over the dashboard hero. The strip
          itself is transparent so the hero's gradient shows through;
          the safe-area inset is filled with `colors.ink` to match the
          gradient's darkest stop, keeping the status bar consistent. */}
      <SafeAreaView edges={['top']} style={styles.safeOverlay} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            onPress={() => setDrawerOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="menu" size={20} color={colors.textInverse} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('AccountNotifications')}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="bell" size={18} color={colors.textInverse} />
          </Pressable>
        </View>
      </SafeAreaView>

      <SideNavDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        role={role}
        onSelect={handleSelect}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  body: { flex: 1, backgroundColor: colors.bg },
  // Transparent — the dashboard's hero gradient paints the status-bar
  // area itself (via `bleedTop` on ScreenContainer). The icons just
  // float on top of that gradient.
  safeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  topRow: {
    paddingHorizontal: spacing.md,
    // 12 px above and below so the icon row has visible air both
    // from the status bar and from the hero eyebrow text underneath.
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
