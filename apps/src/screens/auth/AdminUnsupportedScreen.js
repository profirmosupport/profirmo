import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Button from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

// Shown when an existing platform_admin signs into the mobile app.
// Admin tooling is web-only; we politely sign them out + nudge them to
// /admin on the web.

export default function AdminUnsupportedScreen() {
  const { logout } = useAuth();
  return (
    <ScreenContainer>
      <View style={styles.wrap}>
        <Text style={styles.title}>Admin tools are web-only</Text>
        <Text style={styles.body}>
          Please sign in at the admin console on the web app to manage
          users, settings, and billing. The mobile app supports clients
          and professionals only.
        </Text>
        <Button title="Sign out" onPress={logout} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.xl },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
});
