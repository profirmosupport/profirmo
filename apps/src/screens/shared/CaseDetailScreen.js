import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { getCase } from '../../services/caseService';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function CaseDetailScreen({ route }) {
  const { caseId } = route.params || {};
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const c = await getCase(caseId);
        if (active) setItem((c && c.case) || c);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load case.');
      }
    })();
    return () => {
      active = false;
    };
  }, [caseId]);

  if (error) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>{error}</Text>
      </ScreenContainer>
    );
  }
  if (!item) {
    return (
      <ScreenContainer>
        <Text style={styles.muted}>Loading…</Text>
      </ScreenContainer>
    );
  }
  return (
    <ScreenContainer>
      <Card>
        <View style={styles.row}>
          <Text style={styles.title}>{item.title || item.id}</Text>
          {item.status ? <Badge variant="amber">{item.status}</Badge> : null}
        </View>
        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}
        <Field label="Category" value={item.category || item.caseType} />
        <Field label="Opened" value={formatDate(item.createdAt)} />
        <Field
          label="Last updated"
          value={formatDate(item.updatedAt || item.lastUpdatedAt)}
        />
      </Card>
    </ScreenContainer>
  );
}

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  description: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
  label: { fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { marginTop: 2, fontSize: fontSize.base, color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  error: { color: colors.danger },
});
