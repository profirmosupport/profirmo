// ProWalletScreen — mobile mirror of /dashboard/professional/wallet.
//
// Sections, top → bottom:
//   1. Header summary  — total earnings strip.
//   2. Markup card     — platform markup % + cumulative deducted +
//                        gross earnings.
//   3. Stat grid       — Escrowed / Available for payout / Pending
//                        payout / Withdrawn (2-up on mobile).
//   4. Payout CTA      — opens the payout-request form (submits to
//                        the admin panel for approval).
//
// Same endpoints the web page hits — /api/wallet/summary — so the
// numbers match across surfaces.

import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import { getWalletSummary } from '../../services/walletService';
import { formatINR } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function ProWalletScreen({ navigation }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await getWalletSummary();
      setSummary(s);
    } catch (err) {
      setError(err?.message || 'Failed to load wallet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const availableForPayout = summary
    ? Number(summary.availableForPayout || 0)
    : 0;

  return (
    <ScreenContainer
      refreshing={loading}
      onRefresh={load}
      hasNavHeader
      contentStyle={styles.page}
    >
      <View style={{ gap: spacing.md }}>
        {/* Header strip */}
        <Card>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Feather name="credit-card" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Total earnings</Text>
              <Text style={styles.totalAmount}>
                {summary ? formatINR(summary.totalEarnings || 0) : '—'}
              </Text>
            </View>
          </View>
        </Card>

        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Markup line */}
        {summary ? (
          <Card>
            <View style={styles.markupRow}>
              <View style={styles.markupLeft}>
                <View style={styles.markupIcon}>
                  <Feather name="percent" size={16} color="#be123c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>
                    Platform markup (admin-managed)
                  </Text>
                  <Text style={styles.markupValue}>
                    {((summary.currentMarkupBps || 0) / 100).toFixed(2)}% of
                    every payment
                  </Text>
                </View>
              </View>
              <View style={styles.markupRight}>
                <Text style={styles.eyebrow}>Deducted to date</Text>
                <Text style={styles.markupDeducted}>
                  −{formatINR(summary.markupDeducted || 0)}
                </Text>
                <Text style={styles.markupGross}>
                  Gross billed: {formatINR(summary.grossEarnings || 0)}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Stat tiles */}
        <View style={styles.statGrid}>
          <StatTile
            icon="lock"
            label="Escrowed"
            value={summary ? formatINR(summary.escrowedBalance || 0) : '—'}
            hint="Awaiting completion / review"
          />
          <StatTile
            icon="check-circle"
            label="Available"
            value={
              summary ? formatINR(summary.availableForPayout || 0) : '—'
            }
            hint="Withdraw any time"
          />
          <StatTile
            icon="clock"
            label="Pending payout"
            value={summary ? formatINR(summary.pendingPayout || 0) : '—'}
            hint="Awaiting admin transfer"
          />
          <StatTile
            icon="arrow-up-right"
            label="Withdrawn"
            value={summary ? formatINR(summary.withdrawn || 0) : '—'}
            hint="Lifetime payouts"
          />
        </View>

        {/* Manage payouts — opens the request form. Mirrors the
            "Manage payouts" CTA on the web wallet page; submissions
            land in the admin panel's payout queue for approval. */}
        <Pressable
          onPress={() =>
            navigation.navigate('AccountPayoutRequest', {
              availableForPayout,
            })
          }
          style={({ pressed }) => [
            styles.payoutBtn,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.payoutFill}
          >
            <Feather
              name="arrow-down-circle"
              size={16}
              color={colors.textInverse}
            />
            <Text style={styles.payoutText}>Request payout</Text>
          </LinearGradient>
        </Pressable>
        <Text style={styles.payoutHint}>
          Payout requests are reviewed by the Profirmo admin team before
          the transfer is initiated.
        </Text>
      </View>
    </ScreenContainer>
  );
}

function StatTile({ icon, label, value, hint }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}


const styles = StyleSheet.create({
  page: { paddingTop: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },

  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  muted: { fontSize: 11, color: colors.textMuted },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalAmount: {
    marginTop: 2,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: { flex: 1, fontSize: 12, color: colors.danger },

  // Markup
  markupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  markupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 180,
  },
  markupIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markupValue: {
    marginTop: 2,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  markupRight: { alignItems: 'flex-end' },
  markupDeducted: {
    marginTop: 2,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: '#be123c',
  },
  markupGross: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Stat tiles — 2-up grid.
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    marginTop: 4,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statHint: {
    marginTop: 4,
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
  },

  // Manage payouts CTA.
  payoutBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  payoutFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  payoutText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
  payoutHint: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
