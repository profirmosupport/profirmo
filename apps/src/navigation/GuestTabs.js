// MainTabs (file is still named GuestTabs.js for compat) — bottom tab
// navigator used by EVERYONE: guests, signed-in clients, signed-in
// professionals. The layout is identical so the landing experience
// stays consistent across roles.
//
// Tabs: Home, Search, Talk-to-Firmo (FAB), Support, Account
//   - Guest: Account tab shows the Sign-up redirect screen
//   - Logged-in: Account tab shows the role-aware Dashboard + a side
//     nav drawer with every feature for that role.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import GuestTabBar from '../components/guest/GuestTabBar';
import GuestHeader from '../components/guest/GuestHeader';

import GuestHomeScreen from '../screens/guest/GuestHomeScreen';
import GuestSearchScreen from '../screens/guest/GuestSearchScreen';
import TalkToFirmoScreen from '../screens/guest/TalkToFirmoScreen';
import GuestSupportScreen from '../screens/guest/GuestSupportScreen';
import GuestSignupRedirectScreen from '../screens/guest/GuestSignupRedirectScreen';
import BlogListScreen from '../screens/guest/BlogListScreen';
import BlogDetailScreen from '../screens/guest/BlogDetailScreen';
import ProfessionalDetailScreen from '../screens/guest/ProfessionalDetailScreen';
import FirmDetailScreen from '../screens/guest/FirmDetailScreen';
import BookingScreen from '../screens/guest/BookingScreen';

import DashboardScreen from '../screens/shared/DashboardScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import BookingDetailScreen from '../screens/shared/BookingDetailScreen';
import CaseDetailScreen from '../screens/shared/CaseDetailScreen';
import ClientBookingsScreen from '../screens/client/ClientBookingsScreen';
import ClientCasesScreen from '../screens/client/ClientCasesScreen';
import ClientPaymentsScreen from '../screens/client/ClientPaymentsScreen';
import ProBookingsScreen from '../screens/professional/ProBookingsScreen';
import ProCasesScreen from '../screens/professional/ProCasesScreen';
import ProPaymentsScreen from '../screens/professional/ProPaymentsScreen';
import ProWalletScreen from '../screens/professional/ProWalletScreen';
import ProSubscriptionScreen from '../screens/professional/ProSubscriptionScreen';
import ProFirmScreen from '../screens/professional/ProFirmScreen';

import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../config/constants';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Default options for every guest sub-stack. Drop in our shared
// GuestHeader and let each screen override the title via options.
const stackScreenOptions = {
  header: (props) => <GuestHeader {...props} />,
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="GuestHomeMain"
        component={GuestHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BlogList"
        component={BlogListScreen}
        options={{ title: 'Blog & News' }}
      />
      <Stack.Screen
        name="BlogDetail"
        component={BlogDetailScreen}
        options={{ title: 'Article' }}
      />
      <Stack.Screen
        name="ProfessionalDetail"
        component={ProfessionalDetailScreen}
        options={{ title: 'Professional Details' }}
      />
      <Stack.Screen
        name="FirmDetail"
        component={FirmDetailScreen}
        options={{ title: 'Firm Details' }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Book a consultation' }}
      />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="GuestSearchMain"
        component={GuestSearchScreen}
        options={{ title: 'Search' }}
      />
      <Stack.Screen
        name="ProfessionalDetail"
        component={ProfessionalDetailScreen}
        options={{ title: 'Professional Details' }}
      />
      <Stack.Screen
        name="FirmDetail"
        component={FirmDetailScreen}
        options={{ title: 'Firm Details' }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Book a consultation' }}
      />
    </Stack.Navigator>
  );
}

function TalkStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="TalkMain"
        component={TalkToFirmoScreen}
        options={{ title: 'Talk to Firmo' }}
      />
    </Stack.Navigator>
  );
}

function SupportStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="SupportMain"
        component={GuestSupportScreen}
        options={{ title: 'Support' }}
      />
    </Stack.Navigator>
  );
}

// AccountStack — bound to the last bottom tab. For logged-in users
// the root is the Dashboard; selecting an item in the side nav pushes
// onto this stack. For guests the root is the Sign-up redirect.
function AccountStack() {
  const { user } = useAuth();
  const isPro = user && user.role === ROLES.PROFESSIONAL;
  if (!user) {
    return (
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="AccountSignup"
          component={GuestSignupRedirectScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="AccountDashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AccountProfile"
        component={ProfileScreen}
        options={{ title: 'My profile' }}
      />
      <Stack.Screen
        name="AccountBookings"
        component={isPro ? ProBookingsScreen : ClientBookingsScreen}
        options={{ title: isPro ? 'Bookings' : 'My bookings' }}
      />
      <Stack.Screen
        name="AccountCases"
        component={isPro ? ProCasesScreen : ClientCasesScreen}
        options={{ title: isPro ? 'Cases' : 'My cases' }}
      />
      <Stack.Screen
        name="AccountPayments"
        component={isPro ? ProPaymentsScreen : ClientPaymentsScreen}
        options={{ title: 'Payments' }}
      />
      <Stack.Screen
        name="AccountNotifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="AccountBookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking' }}
      />
      <Stack.Screen
        name="AccountCaseDetail"
        component={CaseDetailScreen}
        options={{ title: 'Case' }}
      />
      {isPro ? (
        <>
          <Stack.Screen
            name="AccountWallet"
            component={ProWalletScreen}
            options={{ title: 'Wallet' }}
          />
          <Stack.Screen
            name="AccountSubscription"
            component={ProSubscriptionScreen}
            options={{ title: 'Subscription' }}
          />
          <Stack.Screen
            name="AccountFirm"
            component={ProFirmScreen}
            options={{ title: 'Manage firm' }}
          />
        </>
      ) : null}
    </Stack.Navigator>
  );
}

export default function GuestTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GuestTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="GuestHome" component={HomeStack} />
      <Tab.Screen name="GuestSearch" component={SearchStack} />
      <Tab.Screen name="TalkToFirmo" component={TalkStack} />
      <Tab.Screen name="GuestSupport" component={SupportStack} />
      <Tab.Screen name="GuestSignup" component={AccountStack} />
    </Tab.Navigator>
  );
}
