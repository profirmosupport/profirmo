// DashboardScreen — single entry point for the per-role dashboard.
// Wraps the existing role-specific dashboard body (Client or
// Professional) in a custom header that has a hamburger icon. Tapping
// the hamburger reveals SideNavDrawer with every feature the role
// can access — Profile, Bookings, Cases, Payments, etc.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import ClientDashboardScreen from '../client/ClientDashboardScreen';
import ProDashboardScreen from '../professional/ProDashboardScreen';
import SideNavDrawer from '../../components/common/SideNavDrawer';
import { ROLES } from '../../config/constants';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

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
      {/* Custom header. We don't use the stack header so we own the
          hamburger + bell layout fully. */}
      <SafeAreaView edges={['top']} style={styles.safeHead}>
        <View style={styles.head}>
          <Pressable
            onPress={() => setDrawerOpen(true)}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Feather name="menu" size={20} color={colors.textInverse} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {role === 'professional' ? 'Professional workspace' : 'Your account'}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('AccountNotifications')}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Feather name="bell" size={18} color={colors.textInverse} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {role === 'professional' ? (
          <ProDashboardScreen navigation={navigation} />
        ) : (
          <ClientDashboardScreen navigation={navigation} />
        )}
      </View>

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
  root: { flex: 1, backgroundColor: colors.bg },
  safeHead: { backgroundColor: colors.ink },
  head: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.ink,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
  },
});
