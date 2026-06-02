import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { displayName } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProfileScreen() {
  const { user, isGuest, exitGuest, logout } = useAuth();

  // Guest mode — no signed-in user. Surface a sign-in CTA so the
  // visitor can convert into a real account at any time.
  if (!user && isGuest) {
    return (
      <ScreenContainer>
        <Card>
          <View style={styles.guestWrap}>
            <View style={styles.guestIcon}>
              <Feather name="user" size={28} color={colors.primary} />
            </View>
            <Text style={styles.guestTitle}>You're browsing as a guest</Text>
            <Text style={styles.guestBody}>
              Sign in to book consultations, manage cases, track payments
              and access the rest of your account.
            </Text>
            <Button
              title="Sign in"
              onPress={exitGuest}
              style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
            />
            <Text style={styles.guestHint}>
              Don't have an account?{' '}
              <Text style={styles.guestLink} onPress={exitGuest}>
                Create one
              </Text>
            </Text>
          </View>
        </Card>
      </ScreenContainer>
    );
  }

  if (!user) return null;
  const name = displayName(user);
  return (
    <ScreenContainer>
      <Card>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(name || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.badges}>
              <Badge variant="blue">{user.role}</Badge>
              {user.status ? <Badge variant="green">{user.status}</Badge> : null}
            </View>
          </View>
        </View>
        <View style={styles.fields}>
          <Field label="Phone" value={user.mobileNumber} />
          <Field label="City" value={user.city} />
          <Field
            label="Email verified"
            value={user.emailVerified ? 'Yes' : 'No'}
          />
          <Field
            label="Phone verified"
            value={user.mobileVerified ? 'Yes' : 'No'}
          />
        </View>
      </Card>
      <Button
        title="Sign out"
        variant="danger"
        onPress={logout}
        style={{ marginTop: spacing.lg }}
      />
    </ScreenContainer>
  );
}

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  email: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  badges: { marginTop: 6, flexDirection: 'row', gap: 6 },
  fields: { marginTop: spacing.lg, gap: spacing.md },
  field: { flexDirection: 'row', justifyContent: 'space-between' },
  fieldLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  fieldValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },

  // Guest empty state.
  guestWrap: { alignItems: 'center', paddingVertical: spacing.md },
  guestIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  guestTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  guestBody: {
    marginTop: 6,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  guestHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  guestLink: { color: colors.primary, fontWeight: fontWeight.bold },
});
