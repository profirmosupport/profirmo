// AppUpdateGate — full-screen, non-dismissible overlay shown on cold
// start when the backend's version config indicates a newer build is
// in the store. All updates are mandatory: there is no "Later"
// button, no snooze, and hardware-back is blocked. The only action
// is "Update now", which opens the relevant store URL (or — on
// Android with the Play in-app updates native module linked —
// triggers Google Play's IMMEDIATE in-app install flow before this
// modal ever renders).
//
// Decision lives in appUpdateService.evaluateUpdate(); this component
// only renders the result.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { evaluateUpdate } from '../../services/appUpdateService';
import { tryPlayInAppUpdate } from '../../services/playStoreUpdater';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function AppUpdateGate() {
  const [state, setState] = useState(null);
  const [opening, setOpening] = useState(false);

  const check = useCallback(async () => {
    const result = await evaluateUpdate();
    if (!result) return;
    // Android: try Google Play's native in-app update flow first.
    // We always request the IMMEDIATE update mode here — full-screen,
    // blocking — because every published update is treated as
    // mandatory. Falls through to the JS modal when the native
    // module isn't linked (Expo Go), when Play hasn't picked up the
    // new release yet, or on any native error.
    if (Platform.OS === 'android') {
      const native = await tryPlayInAppUpdate({ force: true });
      if (native.started) return;
    }
    setState(result);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (!state) return null;

  async function openStore() {
    if (!state.storeUrl) return;
    setOpening(true);
    try {
      await Linking.openURL(state.storeUrl);
    } catch {}
    setOpening(false);
  }

  const storeLabel = Platform.OS === 'ios' ? 'App Store' : 'Play Store';
  const title = 'Update required';
  const body =
    `Profirmo ${state.latest} is in the ${storeLabel}. Your build ` +
    `(${state.installed}) is no longer supported — please update to ` +
    `continue.`;

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      // Hardware-back is a no-op: the user has to update to continue.
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="alert-triangle" size={22} color="#ffffff" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <Pressable
            onPress={openStore}
            disabled={opening}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: opening ? 0.7 : pressed ? 0.9 : 1 },
            ]}
          >
            {opening ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Feather
                name={Platform.OS === 'ios' ? 'arrow-up-right' : 'play'}
                size={13}
                color="#ffffff"
              />
            )}
            <Text style={styles.primaryBtnText}>
              {opening ? 'Opening…' : `Update on the ${storeLabel}`}
            </Text>
          </Pressable>

          <Text style={styles.forcedNote}>
            You can&rsquo;t use the app until you update.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  forcedNote: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
