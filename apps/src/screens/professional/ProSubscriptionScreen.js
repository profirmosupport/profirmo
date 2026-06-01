import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Section from '../../components/common/Section';
import {
  getMySubscription,
  listPublicPlans,
  upgradeSubscription,
} from '../../services/subscriptionService';
import { formatDate, formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// Mobile subscription screen. For paid plans we initiate the upgrade
// server-side (which creates a Razorpay subscription) and then open the
// returned short_url in the device browser so the user can authorise
// the mandate — no native Razorpay SDK needed.

export default function ProSubscriptionScreen() {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [cycle, setCycle] = useState('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [p, sub] = await Promise.all([
        listPublicPlans(),
        getMySubscription(),
      ]);
      setPlans(p);
      setCurrent(sub);
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSwitch(plan) {
    setBusy(plan.id);
    setError('');
    setMessage('');
    try {
      const sub = await upgradeSubscription(plan.slug, cycle);
      if (sub && sub.razorpay && sub.razorpay.shortUrl) {
        await Linking.openURL(sub.razorpay.shortUrl);
        setMessage(
          'We opened the Razorpay payment page in your browser. Pull to refresh after you finish to see your plan as active.'
        );
      } else {
        setMessage(`Switched to ${plan.name}. You're all set.`);
      }
      load();
    } catch (err) {
      setError(err.message || 'Could not switch plans.');
    } finally {
      setBusy('');
    }
  }

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={load}>
      <Card>
        <Text style={styles.eyebrow}>Current plan</Text>
        <View style={styles.headRow}>
          <Text style={styles.planName}>
            {(current && current.plan && current.plan.name) || 'No active plan'}
          </Text>
          {current ? (
            <Badge variant={current.paymentStatus === 'paid' ? 'green' : 'amber'}>
              {current.paymentStatus}
            </Badge>
          ) : null}
        </View>
        {current && current.endDate ? (
          <Text style={styles.muted}>
            Renews / expires {formatDate(current.endDate)}
          </Text>
        ) : null}
        {current && current.billingCycle ? (
          <Text style={styles.muted}>Billing cycle: {current.billingCycle}</Text>
        ) : null}
      </Card>

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Section
        title="Available plans"
        action={
          <View style={styles.cycleToggle}>
            {['monthly', 'annual'].map((c) => (
              <Pressable
                key={c}
                onPress={() => setCycle(c)}
                style={[styles.cycleBtn, cycle === c && styles.cycleBtnActive]}
              >
                <Text style={[styles.cycleText, cycle === c && styles.cycleTextActive]}>
                  {c[0].toUpperCase() + c.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        }
      >
        {plans.length === 0 ? (
          <EmptyState
            icon="package"
            title="No plans available"
            description="An admin needs to publish plans before you can subscribe."
          />
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              current={current}
              busy={busy === plan.id}
              onSwitch={handleSwitch}
            />
          ))
        )}
      </Section>
    </ScreenContainer>
  );
}

function PlanCard({ plan, cycle, current, busy, onSwitch }) {
  const isCurrent = current && current.subscriptionPlanId === plan.id;
  const price =
    cycle === 'annual' && plan.annualEnabled
      ? plan.annualPrice
      : plan.monthlyPrice;
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={styles.headRow}>
        <Text style={styles.planName}>{plan.name}</Text>
        {plan.recommendedBadge ? <Badge variant="amber">Recommended</Badge> : null}
      </View>
      {plan.shortDescription ? (
        <Text style={styles.muted}>{plan.shortDescription}</Text>
      ) : null}
      <Text style={styles.price}>
        {price && Number(price) > 0
          ? `${formatRupees(price, plan.currency)} ${cycle === 'annual' ? '/ year' : '/ month'}`
          : 'Free'}
      </Text>
      <View style={styles.featureList}>
        <Feature>
          {plan.unlimitedCases ? 'Unlimited cases' : `Up to ${plan.caseLimit ?? 0} cases`}
        </Feature>
        <Feature>{Number(plan.commissionPercent || 0)}% platform commission</Feature>
        {plan.firmCreationAllowed ? (
          <Feature>
            {plan.unlimitedFirms ? 'Unlimited firms' : `${plan.firmLimit ?? 0} firm(s)`}
          </Feature>
        ) : null}
        {plan.priorityListing ? <Feature>Priority listing</Feature> : null}
        {plan.whatsappSupport ? <Feature>WhatsApp support</Feature> : null}
      </View>
      <Button
        title={isCurrent ? 'Your current plan' : `Switch to ${plan.name}`}
        variant={isCurrent ? 'outline' : 'primary'}
        onPress={() => (!isCurrent ? onSwitch(plan) : undefined)}
        disabled={isCurrent}
        loading={busy}
        style={{ marginTop: spacing.md }}
      />
    </Card>
  );
}

function Feature({ children }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureDot}>•</Text>
      <Text style={styles.featureText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  muted: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  price: { marginTop: spacing.sm, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  featureList: { marginTop: spacing.md, gap: 6 },
  feature: { flexDirection: 'row', gap: 6 },
  featureDot: { color: colors.primary, fontWeight: fontWeight.bold },
  featureText: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  cycleToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cycleBtn: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  cycleBtnActive: { backgroundColor: colors.primary },
  cycleText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  cycleTextActive: { color: colors.textInverse },
  success: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.successSoft,
    color: colors.successSoftText,
    borderRadius: 8,
    fontSize: fontSize.sm,
  },
  error: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.dangerSoft,
    color: colors.dangerSoftText,
    borderRadius: 8,
    fontSize: fontSize.sm,
  },
});
