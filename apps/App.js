import { Component, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ensureAssetsReady } from './src/utils/assetPreloader';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[Profirmo] Uncaught error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.wrap}>
          <Text style={eb.title}>Something went wrong</Text>
          <Text style={eb.msg}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  msg: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
});

// Keep the native splash visible until React renders its first frame.
// AuthContext hydrates the cached session, then flips loading=false;
// RootNavigator calls SplashScreen.hideAsync() once the JS splash is
// taking over so there's no flash between the two splashes.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* preventAutoHide may have been called twice during fast refresh */
});

// Kick off asset prefetch at module-load (well before App mounts) so
// the welcome screen's hero photo is decoded by the time the user
// gets past the splash. The promise is intentionally not awaited
// here — RootNavigator gates the splash hand-off on it via the
// `assetsReady` helper.
ensureAssetsReady();

export default function App() {
  // Failsafe — if anything blocks the JS splash from hiding the native
  // one, kill it after 6 s so the user never stares at a frozen frame.
  // (Higher than the 5 s JS-splash hold; RootNavigator hides the native
  // splash much sooner in the happy path.)
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
