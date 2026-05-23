'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import FirmReviews from '@/components/firms/FirmReviews';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { ROLES } from '@/utils/constants';
import reviewService from '@/services/reviewService';

export default function FirmReviewsPage() {
  const { user } = useAuth();
  const firmId = user ? user.linkedId || user.firmId : undefined;

  // Force a remount of <FirmReviews> after a successful appeal to refresh.
  const [reloadKey, setReloadKey] = useState(0);
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function openAppeal(review) {
    setTarget(review);
    setReason('');
    setError('');
  }

  function closeAppeal() {
    if (submitting) return;
    setTarget(null);
    setReason('');
    setError('');
  }

  async function submitAppeal() {
    if (!target || submitting) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please provide a reason for the appeal.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await reviewService.appealOnBehalf(target.id, trimmed);
      setTarget(null);
      setReason('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(
        err.message ||
          'Only the firm owner or co-owner can appeal on behalf of a member.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title="Reviews"
      subtitle="What clients say about your firm's professionals"
    >
      {firmId ? (
        <FirmReviews
          key={reloadKey}
          firmId={firmId}
          onAppeal={openAppeal}
        />
      ) : (
        <EmptyState
          icon={<Star size={24} />}
          title="No firm linked"
          description="Your account is not linked to a firm yet, so there are no reviews to show."
        />
      )}

      <Modal
        open={!!target}
        onClose={closeAppeal}
        title="Appeal review"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeAppeal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitAppeal}
              disabled={submitting || !reason.trim()}
            >
              {submitting ? 'Submitting…' : 'Submit appeal'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Explain why this review should be reconsidered. The platform team
            will review your appeal.
          </p>
          <div>
            <label
              htmlFor="appeal-reason"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Appeal reason
            </label>
            <textarea
              id="appeal-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this review is inaccurate or unfair…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
