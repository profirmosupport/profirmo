// ProPayoutRequestScreen — submit a payout request to the admin panel.
// Mirrors the web /dashboard/professional/payouts flow:
//   1. Show the current available-for-payout balance.
//   2. Collect an amount (₹) + payout method (Bank / UPI).
//   3. Method-specific fields (account / IFSC / name OR upi id).
//   4. POST /api/payouts/mine — backend authorises, allocates escrow,
//      creates a PayoutRequest in pending state, and notifies admins.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import {
  getAvailablePayout,
  listMyPayouts,
  submitPayoutRequest,
} from '../../services/payoutService';
import { formatINR, formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const METHODS = [
  { key: 'bank', label: 'Bank transfer', icon: 'home' },
  { key: 'upi', label: 'UPI', icon: 'smartphone' },
];

const STATUS_VARIANT = {
  pending: 'amber',
  approved: 'amber',
  paid: 'green',
  rejected: 'gray',
  cancelled: 'gray',
};

export default function ProPayoutRequestScreen({ route, navigation }) {
  const initialAvailable =
    (route && route.params && route.params.availableForPayout) || 0;

  const [available, setAvailable] = useState(initialAvailable);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    amount: '',
    method: 'bank',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    upiId: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [amt, list] = await Promise.all([
        getAvailablePayout().catch(() => null),
        listMyPayouts().catch(() => []),
      ]);
      if (amt != null) setAvailable(Number(amt));
      setHistory(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (submitError) setSubmitError('');
  }

  function validate() {
    const next = {};
    const rupees = Number(form.amount);
    if (!form.amount || !Number.isFinite(rupees) || rupees < 1) {
      next.amount = 'Enter an amount of at least ₹1.';
    } else if (rupees * 100 > available) {
      next.amount = `Maximum available: ${formatINR(available)}.`;
    }
    if (form.method === 'bank') {
      if (!form.bankAccountName.trim())
        next.bankAccountName = 'Account holder name is required.';
      if (!form.bankAccountNumber.trim())
        next.bankAccountNumber = 'Account number is required.';
      if (!form.bankIfsc.trim()) next.bankIfsc = 'IFSC is required.';
    } else {
      if (!form.upiId.trim()) next.upiId = 'UPI id is required.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Convert ₹ → paise. Backend expects an integer minimum of 100.
      const amountPaise = Math.floor(Number(form.amount) * 100);
      const payload = {
        amount: amountPaise,
        method: form.method,
        notes: form.notes.trim() || undefined,
      };
      if (form.method === 'bank') {
        payload.bankAccountName = form.bankAccountName.trim();
        payload.bankAccountNumber = form.bankAccountNumber.trim();
        payload.bankIfsc = form.bankIfsc.trim().toUpperCase();
      } else {
        payload.upiId = form.upiId.trim();
      }
      const created = await submitPayoutRequest(payload);
      setSubmittedId(
        (created && (created.id || (created.request && created.request.id))) ||
          'pending'
      );
      // Reset form + refresh history & balance.
      setForm({
        amount: '',
        method: form.method,
        bankAccountName: '',
        bankAccountNumber: '',
        bankIfsc: '',
        upiId: '',
        notes: '',
      });
      load();
    } catch (err) {
      setSubmitError(
        err?.message || 'Could not submit the payout request. Try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer
      hasNavHeader
      keyboard
      contentStyle={styles.page}
      refreshing={loading}
      onRefresh={load}
    >
      <View style={{ gap: spacing.md }}>
        {/* Available balance card */}
        <Card>
          <View style={styles.headRow}>
            <View style={styles.headIcon}>
              <Feather
                name="check-circle"
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Available for payout</Text>
              <Text style={styles.totalAmount}>{formatINR(available)}</Text>
              <Text style={styles.hint}>
                Withdrawals are approved by the Profirmo admin team.
              </Text>
            </View>
          </View>
        </Card>

        {submittedId ? (
          <View style={styles.successBanner}>
            <Feather name="check-circle" size={16} color="#047857" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>
                Payout request submitted
              </Text>
              <Text style={styles.successBody}>
                The admin team will review it shortly. You&apos;ll be
                notified once it&apos;s approved.
              </Text>
            </View>
            <Pressable onPress={() => setSubmittedId('')} hitSlop={6}>
              <Feather name="x" size={14} color="#047857" />
            </Pressable>
          </View>
        ) : null}

        {/* Form */}
        <Card>
          <SectionLabel>Request a payout</SectionLabel>

          <AuthInput
            label="Amount (₹)"
            icon="credit-card"
            keyboardType="numeric"
            placeholder="500"
            value={form.amount}
            onChangeText={(v) =>
              set('amount', v.replace(/[^0-9.]/g, ''))
            }
            error={errors.amount}
            hint={`Max ${formatINR(available)} available.`}
          />

          <SectionLabel top>Payout method</SectionLabel>
          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const active = form.method === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => set('method', m.key)}
                  style={({ pressed }) => [
                    styles.methodTile,
                    active && styles.methodTileActive,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Feather
                    name={m.icon}
                    size={16}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.methodLabel,
                      active && styles.methodLabelActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {form.method === 'bank' ? (
            <>
              <AuthInput
                label="Account holder name"
                icon="user"
                autoCapitalize="words"
                value={form.bankAccountName}
                onChangeText={(v) => set('bankAccountName', v)}
                error={errors.bankAccountName}
              />
              <AuthInput
                label="Account number"
                icon="hash"
                keyboardType="numeric"
                value={form.bankAccountNumber}
                onChangeText={(v) =>
                  set('bankAccountNumber', v.replace(/[^0-9]/g, ''))
                }
                error={errors.bankAccountNumber}
              />
              <AuthInput
                label="IFSC"
                icon="key"
                autoCapitalize="characters"
                placeholder="HDFC0001234"
                value={form.bankIfsc}
                onChangeText={(v) => set('bankIfsc', v.toUpperCase())}
                error={errors.bankIfsc}
              />
            </>
          ) : (
            <AuthInput
              label="UPI ID"
              icon="at-sign"
              autoCapitalize="none"
              placeholder="name@upi"
              value={form.upiId}
              onChangeText={(v) => set('upiId', v)}
              error={errors.upiId}
            />
          )}

          <AuthInput
            label="Note for admin (optional)"
            icon="edit-3"
            multiline
            numberOfLines={3}
            placeholder="Anything we should know?"
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
          />

          {submitError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}

          <GradientButton
            title={submitting ? 'Submitting…' : 'Submit payout request'}
            loading={submitting}
            onPress={handleSubmit}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* History */}
        <Card>
          <SectionLabel>Recent requests</SectionLabel>
          {loading && history.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <Text style={styles.muted}>
              You haven&apos;t submitted any payout requests yet.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {history.slice(0, 10).map((p) => (
                <View key={p.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyAmount}>
                      {formatINR(p.amount)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {(p.method || '').toUpperCase()} ·{' '}
                      {formatDate(p.createdAt)}
                    </Text>
                  </View>
                  <Badge variant={STATUS_VARIANT[p.status] || 'gray'}>
                    {p.status}
                  </Badge>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>
    </ScreenContainer>
  );
}

function SectionLabel({ children, top }) {
  return (
    <Text
      style={[styles.sectionLabel, top ? { marginTop: spacing.md } : null]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },

  sectionLabel: {
    marginBottom: 8,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hint: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
  },
  muted: { fontSize: fontSize.sm, color: colors.textSecondary },

  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headIcon: {
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

  methodRow: { flexDirection: 'row', gap: spacing.sm },
  methodTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodTileActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  methodLabelActive: { color: colors.primary },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  successTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#065f46',
  },
  successBody: {
    marginTop: 2,
    fontSize: 12,
    color: '#047857',
    lineHeight: 17,
  },

  errorBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyAmount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  historyMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
  },
});
