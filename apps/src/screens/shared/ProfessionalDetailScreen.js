import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { getProfessional } from '../../services/professionalService';
import { formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProfessionalDetailScreen({ route, navigation }) {
  const { professionalId } = route.params || {};
  const [pro, setPro] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await getProfessional(professionalId);
        if (active) setPro((r && r.professional) || r);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load.');
      }
    })();
    return () => {
      active = false;
    };
  }, [professionalId]);

  if (error) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>{error}</Text>
      </ScreenContainer>
    );
  }
  if (!pro) {
    return (
      <ScreenContainer>
        <Text style={styles.muted}>Loading…</Text>
      </ScreenContainer>
    );
  }

  const name = pro.fullName || pro.name || `${pro.firstName || ''} ${pro.lastName || ''}`.trim();

  return (
    <ScreenContainer>
      <Card>
        <Text style={styles.name}>{name}</Text>
        {pro.designation ? (
          <Text style={styles.designation}>{pro.designation}</Text>
        ) : null}
        <View style={styles.badges}>
          {pro.professionalType ? <Badge variant="blue">{pro.professionalType}</Badge> : null}
          {pro.rating ? <Badge variant="amber">★ {pro.rating}</Badge> : null}
        </View>
        {pro.bio ? <Text style={styles.bio}>{pro.bio}</Text> : null}
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Consultation fee</Text>
          <Text style={styles.fee}>
            {pro.consultationFee ? formatRupees(pro.consultationFee) : '—'}
          </Text>
        </View>
      </Card>

      <Button
        title="Book a consultation"
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          navigation.navigate('BookingsTab', {
            screen: 'BookingDetail',
            params: { newForProfessionalId: pro.id },
          });
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  designation: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  badges: { marginTop: spacing.sm, flexDirection: 'row', gap: 6 },
  bio: { marginTop: spacing.md, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  feeRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  fee: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  muted: { color: colors.textSecondary },
  error: { color: colors.danger },
});
