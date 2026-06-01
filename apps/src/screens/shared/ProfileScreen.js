import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { displayName } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
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
          <Field label="Email verified" value={user.emailVerified ? 'Yes' : 'No'} />
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
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  email: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  badges: { marginTop: 6, flexDirection: 'row', gap: 6 },
  fields: { marginTop: spacing.lg, gap: spacing.md },
  field: { flexDirection: 'row', justifyContent: 'space-between' },
  fieldLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  fieldValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
});
