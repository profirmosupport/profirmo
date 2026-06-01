// RootNavigator — picks between AuthStack, ProfessionalTabs and
// ClientTabs based on the auth state held by AuthContext.
//
// On cold start we show the branded SplashView for AT LEAST 3 seconds
// (so the brand moment is always experienced) AND until AuthContext
// has finished hydrating the cached session. The longer of the two
// wins; if hydration takes 200ms the splash stays up for ~2.8s of
// animation; if hydration takes 4s the splash stays up until it's done.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import AuthStack from './AuthStack';
import ProfessionalTabs from './ProfessionalTabs';
import ClientTabs from './ClientTabs';
import AdminUnsupportedScreen from '../screens/auth/AdminUnsupportedScreen';
import SplashView from '../components/common/SplashView';
import { ROLES } from '../config/constants';

const MIN_SPLASH_MS = 3000;

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  // Hand off from the native splash to the JS splash as soon as React
  // mounts. From here on the animated JS SplashView owns the visual
  // until both the timer AND auth hydration are done.
  useEffect(() => {
    if (nativeSplashHidden) return;
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => setNativeSplashHidden(true));
  }, [nativeSplashHidden]);

  // 3-second floor — guarantees the brand animation is seen even if
  // AuthContext flips loading=false in 200ms.
  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const showSplash = loading || !minSplashElapsed;

  if (showSplash) {
    return (
      <SplashView
        message={loading ? 'Getting things ready' : 'Almost there'}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        {!user ? (
          <AuthStack />
        ) : user.role === ROLES.PROFESSIONAL ? (
          <ProfessionalTabs />
        ) : user.role === ROLES.CLIENT ? (
          <ClientTabs />
        ) : (
          <AdminUnsupportedScreen />
        )}
      </NavigationContainer>
    </View>
  );
}
