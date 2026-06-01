'use client';

// Professional payment history — every payment received into the signed-in
// professional's escrow (booking payments) AND every charge the
// professional has made for their own subscription. The two streams share
// one table; the "Kind" column distinguishes Booking vs Subscription.

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PaymentHistoryTable from '@/components/payments/PaymentHistoryTable';
import { listMyPayments } from '@/services/paymentService';
import { listMySubscriptionPayments } from '@/services/subscriptionService';
import { ROLES } from '@/utils/constants';

// Normalise a SubscriptionPayment row into the shape PaymentHistoryTable
// expects, then tag it so the table can render the subscription
// columns. Subscription charges have no booking + no counterparty.
function asPaymentRow(subPay) {
  return {
    id: subPay.id,
    kind: 'subscription',
    createdAt: subPay.createdAt,
    capturedAt: subPay.paymentDate || subPay.createdAt,
    counterpartyName: 'Profirmo',
    booking: null,
    // Subscription amounts are stored in rupees (DECIMAL), but the table
    // expects paise. Convert so formatINR renders the same value across
    // both streams.
    amount: Number(subPay.totalAmount || subPay.amount || 0) * 100,
    platformFee: 0,
    netAmount: 0,
    status: subPay.paymentStatus,
    razorpayPaymentId: subPay.transactionId,
    subscriptionLabel:
      (subPay.plan && subPay.plan.name)
        ? `${subPay.plan.name} (${subPay.billingCycle})`
        : `Subscription (${subPay.billingCycle})`,
  };
}

export default function ProfessionalPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bookingRows, subRows] = await Promise.all([
        listMyPayments('professional'),
        listMySubscriptionPayments().catch(() => []),
      ]);
      const tagged = (bookingRows || []).map((r) => ({ ...r, kind: 'booking' }));
      const subTagged = (subRows || []).map(asPaymentRow);
      // Newest first across both streams.
      const merged = [...tagged, ...subTagged].sort((a, b) => {
        const ka = new Date(a.capturedAt || a.createdAt || 0).getTime();
        const kb = new Date(b.capturedAt || b.createdAt || 0).getTime();
        return kb - ka;
      });
      setPayments(merged);
    } catch (err) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Payment history"
      subtitle="Booking payouts and subscription charges — with gross, net, and current status"
    >
      <PaymentHistoryTable
        payments={payments}
        loading={loading}
        error={error}
        onReload={load}
        side="professional"
      />
    </DashboardLayout>
  );
}
