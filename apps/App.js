import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

// Keep the native splash visible until React renders its first frame.
// AuthContext hydrates the cached session, then flips loading=false;
// RootNavigator calls SplashScreen.hideAsync() once the JS splash is
// taking over so there's no flash between the two splashes.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* preventAutoHide may have been called twice during fast refresh */
});

export default function App() {
  // Failsafe — if anything blocks the JS splash from hiding the native
  // one, kill it after 4 s so the user never stares at a frozen frame.
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
