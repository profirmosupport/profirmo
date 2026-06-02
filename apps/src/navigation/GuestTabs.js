// GuestTabs — bottom tab navigator visible only when the user is
// browsing as a guest (post-Skip on the welcome screen).
// Tabs: Home, Search, Talk-to-Firmo (FAB), Support, Sign up.
// Each tab is a native stack so per-tab navigation (Home → Blog,
// Search → results, etc.) doesn't reset state on switch.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import GuestTabBar from '../components/guest/GuestTabBar';

import GuestHomeScreen from '../screens/guest/GuestHomeScreen';
import GuestSearchScreen from '../screens/guest/GuestSearchScreen';
import TalkToFirmoScreen from '../screens/guest/TalkToFirmoScreen';
import GuestSupportScreen from '../screens/guest/GuestSupportScreen';
import GuestSignupRedirectScreen from '../screens/guest/GuestSignupRedirectScreen';
import BlogListScreen from '../screens/guest/BlogListScreen';
import BlogDetailScreen from '../screens/guest/BlogDetailScreen';

import { colors, fontSize, fontWeight } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  headerTintColor: colors.textPrimary,
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="GuestSearchMain"
        component={GuestSearchScreen}
        options={{ title: 'Search' }}
      />
    </Stack.Navigator>
  );
}

function TalkStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="SupportMain"
        component={GuestSupportScreen}
        options={{ title: 'Support' }}
      />
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
      <Tab.Screen name="GuestSignup" component={GuestSignupRedirectScreen} />
    </Tab.Navigator>
  );
}
