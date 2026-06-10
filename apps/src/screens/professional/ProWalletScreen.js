import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import Section from '../../components/common/Section';
import {
  getMyWallet,
  listMyWalletTransactions,
} from '../../services/walletService';
import { formatDate, formatINR } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProWalletScreen() {
  const [wallet, setWallet] = useState(null);
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, t] = await Promise.all([
        getMyWallet().catch(() => null),
        listMyWalletTransactions().catch(() => []),
      ]);
      setWallet(w && (w.wallet || w));
      setTx(t || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer refreshing={loading} onRefresh={load} hasNavHeader>
      <Card>
        <Text style={styles.eyebrow}>Available balance</Text>
        <Text style={styles.balance}>
          {formatINR(
            (wallet && (wallet.availableBalance || wallet.balance)) || 0
          )}
        </Text>
        {wallet && wallet.escrowedBalance != null ? (
          <Text style={styles.muted}>
            In escrow: {formatINR(wallet.escrowedBalance)}
          </Text>
        ) : null}
      </Card>

      <Section title="Recent activity">
        {tx.length === 0 ? (
          <EmptyState
            icon="dollar-sign"
            title="No wallet activity"
            description="Payouts and escrow events will show up here."
          />
        ) : (
          tx.slice(0, 30).map((row) => (
            <Card key={row.id} style={{ marginBottom: spacing.sm }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {row.category || row.description || 'Wallet event'}
                  </Text>
                  <Text style={styles.muted}>{formatDate(row.createdAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.amount,
                      {
                        color:
                          row.entryType === 'debit' ? colors.danger : colors.success,
                      },
                    ]}
                  >
                    {row.entryType === 'debit' ? '−' : '+'}
                    {formatINR(row.amount)}
                  </Text>
                  {row.escrowStatus ? (
                    <Badge variant="gray">{row.escrowStatus}</Badge>
                  ) : null}
                </View>
              </View>
            </Card>
          ))
        )}
      </Section>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  balance: { marginTop: 4, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: colors.textPrimary },
  muted: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary, textTransform: 'capitalize' },
  amount: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 },
});
