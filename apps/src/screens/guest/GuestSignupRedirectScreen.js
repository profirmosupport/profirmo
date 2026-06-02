// GuestSignupRedirectScreen — the Sign-up tab. As soon as it gains
// focus it calls exitGuest(), which flips the auth state and causes
// RootNavigator to swap to AuthStack. The flash of this screen is
// minimal — a brief brand placeholder — because the swap happens
// inside one render cycle.

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function GuestSignupRedirectScreen() {
  const { exitGuest } = useAuth();
  // Use focus effect rather than mount so the redirect also fires when
  // the user navigates back to this tab.
  useFocusEffect(
    useCallback(() => {
      exitGuest();
    }, [exitGuest])
  );
  return (
    <View style={styles.wrap}>
      <Feather name="user-plus" size={32} color={colors.primary} />
      <Text style={styles.title}>Opening sign up…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { marginTop: spacing.md, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textSecondary },
});
