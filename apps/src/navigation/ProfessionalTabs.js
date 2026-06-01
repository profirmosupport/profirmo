// Professional bottom-tab navigator. Each tab is its own native stack
// so per-tab navigation (e.g. Bookings → BookingDetail) doesn't reset
// the others' state when the user taps a different tab.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import ProDashboardScreen from '../screens/professional/ProDashboardScreen';
import ProBookingsScreen from '../screens/professional/ProBookingsScreen';
import ProCasesScreen from '../screens/professional/ProCasesScreen';
import ProSubscriptionScreen from '../screens/professional/ProSubscriptionScreen';
import ProPaymentsScreen from '../screens/professional/ProPaymentsScreen';
import ProWalletScreen from '../screens/professional/ProWalletScreen';
import ProFirmScreen from '../screens/professional/ProFirmScreen';

import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import BookingDetailScreen from '../screens/shared/BookingDetailScreen';
import CaseDetailScreen from '../screens/shared/CaseDetailScreen';

import { colors, fontSize, fontWeight } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const defaultHeader = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  headerTintColor: colors.textPrimary,
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen
        name="Home"
        component={ProDashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ProFirm" component={ProFirmScreen} options={{ title: 'Manage firm' }} />
      <Stack.Screen name="ProWallet" component={ProWalletScreen} options={{ title: 'Wallet' }} />
    </Stack.Navigator>
  );
}

function BookingsStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen name="BookingsList" component={ProBookingsScreen} options={{ title: 'Bookings' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
    </Stack.Navigator>
  );
}

function CasesStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen name="CasesList" component={ProCasesScreen} options={{ title: 'Cases' }} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} options={{ title: 'Case' }} />
    </Stack.Navigator>
  );
}

function MoneyStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen name="Payments" component={ProPaymentsScreen} options={{ title: 'Payments' }} />
      <Stack.Screen name="Subscription" component={ProSubscriptionScreen} options={{ title: 'Subscription' }} />
      <Stack.Screen name="ProWalletInner" component={ProWalletScreen} options={{ title: 'Wallet' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="ProSubscription" component={ProSubscriptionScreen} options={{ title: 'Subscription' }} />
      <Stack.Screen name="ProFirmMore" component={ProFirmScreen} options={{ title: 'Firm' }} />
      <Stack.Screen name="ProWalletMore" component={ProWalletScreen} options={{ title: 'Wallet' }} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  HomeTab: 'home',
  BookingsTab: 'calendar',
  CasesTab: 'folder',
  MoneyTab: 'credit-card',
  MoreTab: 'menu',
};

export default function ProfessionalTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: fontWeight.semibold,
          marginBottom: 4,
        },
        tabBarIcon: ({ color, size }) => (
          <Feather
            name={TAB_ICONS[route.name] || 'circle'}
            size={size - 2}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      <Tab.Screen name="BookingsTab" component={BookingsStack} options={{ title: 'Bookings' }} />
      <Tab.Screen name="CasesTab" component={CasesStack} options={{ title: 'Cases' }} />
      <Tab.Screen name="MoneyTab" component={MoneyStack} options={{ title: 'Money' }} />
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}
