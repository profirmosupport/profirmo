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
import GuestSignupRedirectScreen from '../screens/guest/GuestSignupRedirectScreen';
import GuestSupportScreen from '../screens/guest/GuestSupportScreen';
import BlogListScreen from '../screens/guest/BlogListScreen';
import BlogDetailScreen from '../screens/guest/BlogDetailScreen';
import ProfessionalDetailScreen from '../screens/guest/ProfessionalDetailScreen';
import FirmDetailScreen from '../screens/guest/FirmDetailScreen';
import BookingScreen from '../screens/guest/BookingScreen';
import ECourtsSearchScreen from '../screens/guest/ECourtsSearchScreen';
import ECourtsCaseDetailScreen from '../screens/guest/ECourtsCaseDetailScreen';
import ECourtsHearingsScreen from '../screens/guest/ECourtsHearingsScreen';

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
import ProPayoutRequestScreen from '../screens/professional/ProPayoutRequestScreen';
import ProAvailabilityScreen from '../screens/professional/ProAvailabilityScreen';
import FirmDashboardScreen from '../screens/professional/FirmDashboardScreen';
import FirmCreateScreen from '../screens/professional/FirmCreateScreen';
import ProClientsScreen from '../screens/professional/ProClientsScreen';
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
      <Stack.Screen
        name="ECourtsSearch"
        component={ECourtsSearchScreen}
        options={{ title: 'E-Courts India' }}
      />
      <Stack.Screen
        name="ECourtsCaseDetail"
        component={ECourtsCaseDetailScreen}
        options={{ title: 'Case Details' }}
      />
      <Stack.Screen
        name="ECourtsHearings"
        component={ECourtsHearingsScreen}
        options={{ title: 'Daily cause list' }}
      />
      {/* In-stack mirror of the dashboard's My Cases screen. Reached
          from the eCourts case detail screen's "Saved in My cases"
          pill so the redirect always works without crossing tab
          boundaries (which can be brittle on first-time nav). */}
      <Stack.Screen
        name="EcourtsMyCases"
        component={MyCasesByRole}
        options={{ title: 'My cases' }}
      />
      {/* In-stack case detail — same component the dashboard uses.
          Lets the EcourtsMyCases list open a row without crossing
          stacks. */}
      <Stack.Screen
        name="CaseDetail"
        component={CaseDetailScreen}
        options={{ title: 'Case Detail' }}
      />
    </Stack.Navigator>
  );
}

// Routes that need to render "My cases" for the current user pick
// between the client and professional screens at render time. Wrap
// them once here so the route registration stays declarative.
function MyCasesByRole(props) {
  const { user } = useAuth();
  const isPro = user && user.role === ROLES.PROFESSIONAL;
  return isPro ? <ProCasesScreen {...props} /> : <ClientCasesScreen {...props} />;
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
        options={{ headerShown: false }}
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
        options={{ title: 'My Profile' }}
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
        options={{ title: 'Booking Detail' }}
      />
      {/* Alias so ClientBookingsScreen / ProBookingsScreen's
          historic `navigate('BookingDetail', ...)` resolves inside
          the Account stack. */}
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking Detail' }}
      />
      <Stack.Screen
        name="AccountCaseDetail"
        component={CaseDetailScreen}
        options={{ title: 'Case Detail' }}
      />
      {/* Alias so screens that historically navigate('CaseDetail')
          (ClientCasesScreen, ProCasesScreen) resolve inside the
          Account stack too — was AccountCaseDetail before. */}
      <Stack.Screen
        name="CaseDetail"
        component={CaseDetailScreen}
        options={{ title: 'Case Detail' }}
      />
      {isPro ? (
        <>
          <Stack.Screen
            name="AccountWallet"
            component={ProWalletScreen}
            options={{ title: 'Wallet' }}
          />
          <Stack.Screen
            name="AccountPayoutRequest"
            component={ProPayoutRequestScreen}
            options={{ title: 'Request payout' }}
          />
          <Stack.Screen
            name="AccountAvailability"
            component={ProAvailabilityScreen}
            options={{ title: 'Availability' }}
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
          {/* Firm Dashboard — tabbed owner/co-owner view (overview,
              members, requests, clients, leads, cases, reviews,
              profile). Mirrors /dashboard/firm on the web. */}
          <Stack.Screen
            name="FirmDashboard"
            component={FirmDashboardScreen}
            options={{ title: 'Firm Dashboard' }}
          />
          <Stack.Screen
            name="FirmCreate"
            component={FirmCreateScreen}
            options={{ title: 'Create firm' }}
          />
          <Stack.Screen
            name="AccountClients"
            component={ProClientsScreen}
            options={{ title: 'Clients' }}
          />
          {/* Public firm detail kept around for deep links. */}
          <Stack.Screen
            name="FirmDetail"
            component={FirmDetailScreen}
            options={{ title: 'Firm Details' }}
          />
        </>
      ) : null}
    </Stack.Navigator>
  );
}

export default function GuestTabs() {
  // Professionals land on their Dashboard tab so the workspace is
  // one tap away after login. Everyone else (clients + guests)
  // lands on the Home tab — the rich landing carousel + search.
  // `initialRouteName` is only read once when the navigator mounts,
  // which is exactly the moment of login (RootNavigator swaps
  // AuthStack → GuestTabs as soon as `user` is set).
  const { user } = useAuth();
  const initial =
    user && user.role === ROLES.PROFESSIONAL ? 'GuestSignup' : 'GuestHome';
  return (
    <Tab.Navigator
      tabBar={(props) => <GuestTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName={initial}
    >
      <Tab.Screen name="GuestHome" component={HomeStack} />
      <Tab.Screen name="GuestSearch" component={SearchStack} />
      <Tab.Screen name="TalkToFirmo" component={TalkStack} />
      <Tab.Screen name="GuestSupport" component={SupportStack} />
      <Tab.Screen name="GuestSignup" component={AccountStack} />
    </Tab.Navigator>
  );
}
