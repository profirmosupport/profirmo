// Client bottom-tab navigator. Clients have a slimmer surface than
// professionals: Home, Find professional, Bookings, Cases, More.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import ClientFindProfessionalScreen from '../screens/client/ClientFindProfessionalScreen';
import ClientBookingsScreen from '../screens/client/ClientBookingsScreen';
import ClientCasesScreen from '../screens/client/ClientCasesScreen';
import ClientPaymentsScreen from '../screens/client/ClientPaymentsScreen';

import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import BookingDetailScreen from '../screens/shared/BookingDetailScreen';
import CaseDetailScreen from '../screens/shared/CaseDetailScreen';
import ProfessionalDetailScreen from '../screens/shared/ProfessionalDetailScreen';
import BookingScreen from '../screens/guest/BookingScreen';

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
        component={ClientDashboardScreen}
        options={{ title: 'Welcome' }}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

function FindStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen
        name="FindProfessional"
        component={ClientFindProfessionalScreen}
        options={{ title: 'Find a professional' }}
      />
      <Stack.Screen
        name="ProfessionalDetail"
        component={ProfessionalDetailScreen}
        options={{ title: 'Professional' }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Book a consultation' }}
      />
    </Stack.Navigator>
  );
}

function BookingsStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen name="BookingsList" component={ClientBookingsScreen} options={{ title: 'My bookings' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
    </Stack.Navigator>
  );
}

function CasesStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen name="CasesList" component={ClientCasesScreen} options={{ title: 'My cases' }} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} options={{ title: 'Case' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={defaultHeader}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="ClientPayments" component={ClientPaymentsScreen} options={{ title: 'Payments' }} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  HomeTab: 'home',
  FindTab: 'search',
  BookingsTab: 'calendar',
  CasesTab: 'folder',
  MoreTab: 'menu',
};

export default function ClientTabs() {
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
      <Tab.Screen name="FindTab" component={FindStack} options={{ title: 'Find' }} />
      <Tab.Screen name="BookingsTab" component={BookingsStack} options={{ title: 'Bookings' }} />
      <Tab.Screen name="CasesTab" component={CasesStack} options={{ title: 'Cases' }} />
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}
