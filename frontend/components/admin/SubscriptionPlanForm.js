'use client';

// SubscriptionPlanForm — shared editor for both create + edit. Organises
// the ~50 columns from the SubscriptionPlan model into the same sections
// the spec uses, so admins can find anything quickly.
//
// Feature rules are rendered as an editable grid at the bottom — each row
// is one (featureKey, isEnabled, limitValue, isUnlimited) tuple. The
// backend keeps any rules not included in the submitted list untouched,
// so partial saves are safe.

import { useEffect, useMemo, useState } from 'react';
import {
  Save,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import {
  adminCreatePlan,
  adminUpdatePlan,
  adminListFeatureKeys,
} from '@/services/subscriptionService';

// Sensible defaults so an empty form is buildable without 50 blanks.
const EMPTY = {
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  planType: 'paid',
  visibility: 'public',
  status: 'active',
  displayOrder: 50,
  recommendedBadge: false,
  featuredBadge: false,
  currency: 'INR',
  monthlyEnabled: true,
  monthlyPrice: 0,
  annualEnabled: false,
  annualPrice: '',
  annualDiscountPercent: '',
  annualSavingsLabel: '',
  commissionPercent: 10,
  commissionAppliesOn: 'all',
  commissionOverrideAllowed: false,
  caseManagementEnabled: true,
  caseLimit: '',
  unlimitedCases: false,
  documentUploadAllowed: true,
  storageLimitMb: '',
  taskManagementAllowed: false,
  firmCreationAllowed: false,
  firmLimit: '',
  unlimitedFirms: false,
  professionalsAllowed: '',
  unlimitedProfessionals: false,
  firmCaseLimit: '',
  unlimitedFirmCases: false,
  firmBrandingAllowed: false,
  firmProfilePageAllowed: false,
  firmAdminRoleAllowed: false,
  teamManagementEnabled: false,
  roleManagementAllowed: false,
  staffAccessAllowed: false,
  internalNotesAllowed: false,
  supportType: 'basic',
  supportResponseTime: '',
  supportTicketLimit: '',
  priorityEscalation: false,
  whatsappSupport: false,
  callSupport: false,
  featuredProfileAllowed: false,
  featuredInSearch: false,
  featuredOnHomepage: false,
  priorityRanking: false,
  priorityListing: false,
  leadPriority: false,
  customBrandingAllowed: false,
  analyticsDashboardAllowed: false,
  consultationBookingAllowed: true,
  bookingCalendarAllowed: true,
  escrowPaymentAllowed: true,
  payoutRequestAllowed: true,
  autoPayoutEligible: false,
  manualAdminApprovalRequired: false,
  isCustomPlan: false,
  customCtaLabel: '',
  customCtaAction: '',
  customCtaTarget: '',
  gracePeriodDays: 0,
  renewalReminderDays: 7,
  razorpayPlanIdMonthly: '',
  razorpayPlanIdAnnual: '',
};

// Build a draft state from an existing plan row, coalescing nulls to
// strings so controlled inputs don't switch from uncontrolled to controlled.
function planToDraft(plan) {
  if (!plan) return { ...EMPTY };
  const draft = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) {
    if (plan[key] === undefined || plan[key] === null) continue;
    draft[key] = plan[key];
  }
  return draft;
}

// Section wrapper.
function Section({ title, description, children }) {
  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

// Boolean checkbox row.
function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 text-sm ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
      />
      <span>
        <span className="font-medium text-slate-700">{label}</span>
        {hint && (
          <span className="block text-xs font-normal text-slate-500">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export default function SubscriptionPlanForm({ plan, onSaved }) {
  const isEdit = Boolean(plan);
  const [draft, setDraft] = useState(() => planToDraft(plan));
  const [rules, setRules] = useState(
    () => (plan && plan.featureRules) || []
  );
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState('');
  const [success, setSuccess] = useState('');

  // Load the canonical feature-key list once. If editing an existing plan
  // already has rules, merge so the editor renders one row per key even
  // when the DB doesn't yet have a rule for some new key.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const keys = await adminListFeatureKeys();
        if (!active) return;
        setFeatureCatalog(keys);
        // Seed rules array from catalog + any existing rule values.
        const existingByKey = new Map(
          ((plan && plan.featureRules) || []).map((r) => [r.featureKey, r])
        );
        const merged = keys.map((k) => {
          const existing = existingByKey.get(k.key);
          return {
            featureKey: k.key,
            featureName: k.name,
            isEnabled: existing ? !!existing.isEnabled : false,
            limitValue:
              existing && existing.limitValue !== null && existing.limitValue !== undefined
                ? existing.limitValue
                : '',
            isUnlimited: existing ? !!existing.isUnlimited : false,
          };
        });
        setRules(merged);
      } catch {
        /* leave feature catalog empty */
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan && plan.id]);

  function set(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function updateRule(idx, patch) {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  const isCustomPlan = useMemo(() => draft.planType === 'custom', [draft.planType]);
  const isFreePlan = useMemo(() => draft.planType === 'free', [draft.planType]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner('');
    setSuccess('');
    if (!draft.name.trim()) {
      setBanner('Plan name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...draft,
        // Numeric coercions — Sequelize accepts decimal strings but the
        // wire is cleaner if we cast on the way out.
        monthlyPrice: draft.monthlyPrice === '' ? 0 : Number(draft.monthlyPrice),
        annualPrice:
          draft.annualPrice === '' || draft.annualPrice === null
            ? null
            : Number(draft.annualPrice),
        annualDiscountPercent:
          draft.annualDiscountPercent === '' ? null : Number(draft.annualDiscountPercent),
        commissionPercent:
          draft.commissionPercent === '' ? 0 : Number(draft.commissionPercent),
        caseLimit:
          draft.caseLimit === '' || draft.unlimitedCases
            ? null
            : Number(draft.caseLimit),
        storageLimitMb:
          draft.storageLimitMb === '' ? null : Number(draft.storageLimitMb),
        firmLimit:
          draft.firmLimit === '' || draft.unlimitedFirms
            ? null
            : Number(draft.firmLimit),
        professionalsAllowed:
          draft.professionalsAllowed === '' || draft.unlimitedProfessionals
            ? null
            : Number(draft.professionalsAllowed),
        firmCaseLimit:
          draft.firmCaseLimit === '' || draft.unlimitedFirmCases
            ? null
            : Number(draft.firmCaseLimit),
        supportTicketLimit:
          draft.supportTicketLimit === '' ? null : Number(draft.supportTicketLimit),
        gracePeriodDays: Number(draft.gracePeriodDays || 0),
        renewalReminderDays: Number(draft.renewalReminderDays || 0),
        displayOrder: Number(draft.displayOrder || 0),
        // Auto-toggle isCustomPlan from planType so admins don't have to
        // remember both.
        isCustomPlan: isCustomPlan,
        featureRules: rules.map((r) => ({
          featureKey: r.featureKey,
          featureName: r.featureName,
          isEnabled: !!r.isEnabled,
          limitValue:
            r.limitValue === '' || r.isUnlimited ? null : Number(r.limitValue),
          isUnlimited: !!r.isUnlimited,
        })),
      };

      const saved = isEdit
        ? await adminUpdatePlan(plan.id, payload)
        : await adminCreatePlan(payload);
      setSuccess(isEdit ? 'Plan updated.' : 'Plan created.');
      if (typeof onSaved === 'function') await onSaved(saved);
    } catch (err) {
      setBanner(err.message || 'Could not save the plan.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {banner && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{banner}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Basic plan info */}
      <Section
        title="Basic information"
        description="Identity, visibility and display metadata."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Plan name"
            name="name"
            required
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Slug"
            name="slug"
            value={draft.slug}
            placeholder="auto-from-name"
            onChange={(e) => set('slug', e.target.value)}
          />
          <Select
            label="Plan type"
            name="planType"
            value={draft.planType}
            onChange={(e) => set('planType', e.target.value)}
            options={[
              { value: 'free', label: 'Free' },
              { value: 'paid', label: 'Paid' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <Select
            label="Visibility"
            name="visibility"
            value={draft.visibility}
            onChange={(e) => set('visibility', e.target.value)}
            options={[
              { value: 'public', label: 'Public' },
              { value: 'private', label: 'Private' },
              { value: 'hidden', label: 'Hidden' },
            ]}
          />
          <Select
            label="Status"
            name="status"
            value={draft.status}
            onChange={(e) => set('status', e.target.value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <Input
            label="Display order"
            name="displayOrder"
            type="number"
            value={draft.displayOrder}
            onChange={(e) => set('displayOrder', e.target.value)}
          />
        </div>
        <Input
          label="Short description"
          name="shortDescription"
          value={draft.shortDescription || ''}
          onChange={(e) => set('shortDescription', e.target.value)}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Detailed description
          </label>
          <textarea
            rows={3}
            value={draft.description || ''}
            onChange={(e) => set('description', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle
            label="Show 'Recommended' badge"
            checked={draft.recommendedBadge}
            onChange={(v) => set('recommendedBadge', v)}
          />
          <Toggle
            label="Show 'Featured' badge"
            checked={draft.featuredBadge}
            onChange={(v) => set('featuredBadge', v)}
          />
        </div>
      </Section>

      {/* Pricing */}
      <Section
        title="Pricing"
        description={
          isCustomPlan
            ? 'Custom plans use the support CTA instead of a price; pricing fields below are ignored.'
            : 'Monthly + optional annual pricing. Use 0 for free plans.'
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Currency"
            name="currency"
            value={draft.currency || 'INR'}
            onChange={(e) => set('currency', e.target.value)}
          />
          <div className="flex items-center sm:col-span-2">
            <Toggle
              label="Monthly billing enabled"
              checked={draft.monthlyEnabled}
              onChange={(v) => set('monthlyEnabled', v)}
              disabled={isCustomPlan}
            />
          </div>
          <Input
            label="Monthly price"
            name="monthlyPrice"
            type="number"
            step="0.01"
            value={draft.monthlyPrice}
            onChange={(e) => set('monthlyPrice', e.target.value)}
            disabled={isCustomPlan || !draft.monthlyEnabled}
          />
          <Input
            label="Annual price"
            name="annualPrice"
            type="number"
            step="0.01"
            value={draft.annualPrice}
            onChange={(e) => set('annualPrice', e.target.value)}
            disabled={isCustomPlan || !draft.annualEnabled}
          />
          <div className="flex items-center">
            <Toggle
              label="Annual billing enabled"
              checked={draft.annualEnabled}
              onChange={(v) => set('annualEnabled', v)}
              disabled={isCustomPlan}
            />
          </div>
          <Input
            label="Annual discount %"
            name="annualDiscountPercent"
            type="number"
            value={draft.annualDiscountPercent}
            onChange={(e) => set('annualDiscountPercent', e.target.value)}
            disabled={isCustomPlan || !draft.annualEnabled}
          />
          <Input
            label="Annual savings label"
            name="annualSavingsLabel"
            value={draft.annualSavingsLabel || ''}
            onChange={(e) => set('annualSavingsLabel', e.target.value)}
            disabled={isCustomPlan || !draft.annualEnabled}
          />
        </div>
        {isFreePlan && (
          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <Info size={12} className="mt-0.5 shrink-0" />
            Free plans should keep monthly price at 0 and annual disabled.
          </p>
        )}
        {!isFreePlan && !isCustomPlan && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Razorpay recurring billing
            </p>
            <p className="mb-3 text-xs text-amber-900">
              Leave these blank to have Profirmo auto-create the Razorpay
              plan from this row's price on the first paid upgrade — the
              id is then saved here for re-use. Paste your own{' '}
              <span className="font-mono">plan_xxx</span> ids only if you
              already created the plan manually in the{' '}
              <a
                href="https://dashboard.razorpay.com/app/subscriptions"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                Razorpay dashboard
              </a>
              . If you change the monthly / annual price, clear the
              corresponding id so a new Razorpay plan is provisioned at
              the new price (Razorpay plans are immutable once created).
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Razorpay monthly plan id"
                name="razorpayPlanIdMonthly"
                placeholder="plan_PXXXXXXXXXXXXX"
                value={draft.razorpayPlanIdMonthly || ''}
                onChange={(e) => set('razorpayPlanIdMonthly', e.target.value.trim())}
                disabled={!draft.monthlyEnabled}
              />
              <Input
                label="Razorpay annual plan id"
                name="razorpayPlanIdAnnual"
                placeholder="plan_PXXXXXXXXXXXXX"
                value={draft.razorpayPlanIdAnnual || ''}
                onChange={(e) => set('razorpayPlanIdAnnual', e.target.value.trim())}
                disabled={!draft.annualEnabled}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Commission */}
      <Section
        title="Commission"
        description="Platform fee deducted from each booking payout."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Commission %"
            name="commissionPercent"
            type="number"
            step="0.01"
            value={draft.commissionPercent}
            onChange={(e) => set('commissionPercent', e.target.value)}
          />
          <Select
            label="Applies on"
            name="commissionAppliesOn"
            value={draft.commissionAppliesOn}
            onChange={(e) => set('commissionAppliesOn', e.target.value)}
            options={[
              { value: 'all', label: 'All paid transactions' },
              { value: 'consultation', label: 'Consultation booking' },
              { value: 'case', label: 'Case booking' },
              { value: 'service', label: 'Service booking' },
            ]}
          />
          <div className="flex items-center">
            <Toggle
              label="Allow manual override per booking"
              checked={draft.commissionOverrideAllowed}
              onChange={(v) => set('commissionOverrideAllowed', v)}
            />
          </div>
        </div>
      </Section>

      {/* Case management */}
      <Section
        title="Case management"
        description="Limits on cases, storage and supporting features."
      >
        <Toggle
          label="Case management enabled"
          checked={draft.caseManagementEnabled}
          onChange={(v) => set('caseManagementEnabled', v)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Case limit"
            name="caseLimit"
            type="number"
            value={draft.caseLimit}
            onChange={(e) => set('caseLimit', e.target.value)}
            disabled={!draft.caseManagementEnabled || draft.unlimitedCases}
          />
          <div className="flex items-center">
            <Toggle
              label="Unlimited cases"
              checked={draft.unlimitedCases}
              onChange={(v) => set('unlimitedCases', v)}
              disabled={!draft.caseManagementEnabled}
            />
          </div>
          <Input
            label="Storage limit (MB)"
            name="storageLimitMb"
            type="number"
            value={draft.storageLimitMb}
            onChange={(e) => set('storageLimitMb', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="Document upload"
            checked={draft.documentUploadAllowed}
            onChange={(v) => set('documentUploadAllowed', v)}
          />
          <Toggle
            label="Task management"
            checked={draft.taskManagementAllowed}
            onChange={(v) => set('taskManagementAllowed', v)}
          />
        </div>
      </Section>

      {/* Firm rules */}
      <Section
        title="Firm creation"
        description="Whether a professional can create + run a firm under this plan."
      >
        <Toggle
          label="Firm creation allowed"
          checked={draft.firmCreationAllowed}
          onChange={(v) => set('firmCreationAllowed', v)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Firms allowed"
            name="firmLimit"
            type="number"
            value={draft.firmLimit}
            onChange={(e) => set('firmLimit', e.target.value)}
            disabled={!draft.firmCreationAllowed || draft.unlimitedFirms}
          />
          <div className="flex items-center">
            <Toggle
              label="Unlimited firms"
              checked={draft.unlimitedFirms}
              onChange={(v) => set('unlimitedFirms', v)}
              disabled={!draft.firmCreationAllowed}
            />
          </div>
          <Input
            label="Professionals in firm"
            name="professionalsAllowed"
            type="number"
            value={draft.professionalsAllowed}
            onChange={(e) => set('professionalsAllowed', e.target.value)}
            disabled={
              !draft.firmCreationAllowed || draft.unlimitedProfessionals
            }
          />
          <div className="flex items-center">
            <Toggle
              label="Unlimited professionals"
              checked={draft.unlimitedProfessionals}
              onChange={(v) => set('unlimitedProfessionals', v)}
              disabled={!draft.firmCreationAllowed}
            />
          </div>
          <Input
            label="Firm cases allowed"
            name="firmCaseLimit"
            type="number"
            value={draft.firmCaseLimit}
            onChange={(e) => set('firmCaseLimit', e.target.value)}
            disabled={!draft.firmCreationAllowed || draft.unlimitedFirmCases}
          />
          <div className="flex items-center">
            <Toggle
              label="Unlimited firm cases"
              checked={draft.unlimitedFirmCases}
              onChange={(v) => set('unlimitedFirmCases', v)}
              disabled={!draft.firmCreationAllowed}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="Firm branding"
            checked={draft.firmBrandingAllowed}
            onChange={(v) => set('firmBrandingAllowed', v)}
            disabled={!draft.firmCreationAllowed}
          />
          <Toggle
            label="Firm profile page"
            checked={draft.firmProfilePageAllowed}
            onChange={(v) => set('firmProfilePageAllowed', v)}
            disabled={!draft.firmCreationAllowed}
          />
          <Toggle
            label="Firm admin role"
            checked={draft.firmAdminRoleAllowed}
            onChange={(v) => set('firmAdminRoleAllowed', v)}
            disabled={!draft.firmCreationAllowed}
          />
        </div>
      </Section>

      {/* Team management */}
      <Section title="Team / member access">
        <Toggle
          label="Team management enabled"
          checked={draft.teamManagementEnabled}
          onChange={(v) => set('teamManagementEnabled', v)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="Role management"
            checked={draft.roleManagementAllowed}
            onChange={(v) => set('roleManagementAllowed', v)}
            disabled={!draft.teamManagementEnabled}
          />
          <Toggle
            label="Staff / assistant access"
            checked={draft.staffAccessAllowed}
            onChange={(v) => set('staffAccessAllowed', v)}
            disabled={!draft.teamManagementEnabled}
          />
          <Toggle
            label="Internal notes"
            checked={draft.internalNotesAllowed}
            onChange={(v) => set('internalNotesAllowed', v)}
            disabled={!draft.teamManagementEnabled}
          />
        </div>
      </Section>

      {/* Support */}
      <Section title="Support">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Support type"
            name="supportType"
            value={draft.supportType}
            onChange={(e) => set('supportType', e.target.value)}
            options={[
              { value: 'basic', label: 'Basic' },
              { value: 'email', label: 'Email support' },
              { value: 'chat', label: 'Chat support' },
              { value: 'priority', label: 'Priority support' },
              { value: 'dedicated', label: 'Dedicated account manager' },
            ]}
          />
          <Input
            label="Response time"
            name="supportResponseTime"
            value={draft.supportResponseTime || ''}
            onChange={(e) => set('supportResponseTime', e.target.value)}
            placeholder="e.g. 4 business hours"
          />
          <Input
            label="Ticket limit"
            name="supportTicketLimit"
            type="number"
            value={draft.supportTicketLimit}
            onChange={(e) => set('supportTicketLimit', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="Priority escalation"
            checked={draft.priorityEscalation}
            onChange={(v) => set('priorityEscalation', v)}
          />
          <Toggle
            label="WhatsApp support"
            checked={draft.whatsappSupport}
            onChange={(v) => set('whatsappSupport', v)}
          />
          <Toggle
            label="Call support"
            checked={draft.callSupport}
            onChange={(v) => set('callSupport', v)}
          />
        </div>
      </Section>

      {/* Featured / visibility */}
      <Section
        title="Featured visibility"
        description="Marketplace ranking + featured-listing perks for this tier."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="Featured profile"
            checked={draft.featuredProfileAllowed}
            onChange={(v) => set('featuredProfileAllowed', v)}
          />
          <Toggle
            label="Featured in search"
            checked={draft.featuredInSearch}
            onChange={(v) => set('featuredInSearch', v)}
          />
          <Toggle
            label="Featured on homepage"
            checked={draft.featuredOnHomepage}
            onChange={(v) => set('featuredOnHomepage', v)}
          />
          <Toggle
            label="Priority ranking"
            checked={draft.priorityRanking}
            onChange={(v) => set('priorityRanking', v)}
          />
          <Toggle
            label="Priority listing"
            checked={draft.priorityListing}
            onChange={(v) => set('priorityListing', v)}
          />
          <Toggle
            label="Lead priority"
            checked={draft.leadPriority}
            onChange={(v) => set('leadPriority', v)}
          />
          <Toggle
            label="Custom branding"
            checked={draft.customBrandingAllowed}
            onChange={(v) => set('customBrandingAllowed', v)}
          />
          <Toggle
            label="Analytics dashboard"
            checked={draft.analyticsDashboardAllowed}
            onChange={(v) => set('analyticsDashboardAllowed', v)}
          />
        </div>
      </Section>

      {/* Booking / escrow */}
      <Section title="Booking & escrow rules">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="Consultation booking"
            checked={draft.consultationBookingAllowed}
            onChange={(v) => set('consultationBookingAllowed', v)}
          />
          <Toggle
            label="Booking calendar"
            checked={draft.bookingCalendarAllowed}
            onChange={(v) => set('bookingCalendarAllowed', v)}
          />
          <Toggle
            label="Escrow payments"
            checked={draft.escrowPaymentAllowed}
            onChange={(v) => set('escrowPaymentAllowed', v)}
          />
          <Toggle
            label="Payout request"
            checked={draft.payoutRequestAllowed}
            onChange={(v) => set('payoutRequestAllowed', v)}
          />
          <Toggle
            label="Auto payout eligible"
            checked={draft.autoPayoutEligible}
            onChange={(v) => set('autoPayoutEligible', v)}
          />
          <Toggle
            label="Manual admin approval required"
            checked={draft.manualAdminApprovalRequired}
            onChange={(v) => set('manualAdminApprovalRequired', v)}
          />
        </div>
      </Section>

      {/* Custom plan */}
      {isCustomPlan && (
        <Section
          title="Custom plan CTA"
          description="Shown to professionals in place of a Buy button."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="CTA button label"
              name="customCtaLabel"
              value={draft.customCtaLabel || ''}
              placeholder="Discuss with Support"
              onChange={(e) => set('customCtaLabel', e.target.value)}
            />
            <Select
              label="CTA action"
              name="customCtaAction"
              value={draft.customCtaAction || ''}
              onChange={(e) => set('customCtaAction', e.target.value)}
              options={[
                { value: '', label: 'Select action…' },
                { value: 'support_form', label: 'Support form' },
                { value: 'sales_form', label: 'Sales form' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'custom_url', label: 'Custom URL' },
              ]}
            />
            <Input
              label="CTA target (URL / phone)"
              name="customCtaTarget"
              value={draft.customCtaTarget || ''}
              onChange={(e) => set('customCtaTarget', e.target.value)}
              placeholder="/contact?topic=custom-plan"
            />
          </div>
        </Section>
      )}

      {/* Expiry */}
      <Section title="Expiry & renewal">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Grace period (days)"
            name="gracePeriodDays"
            type="number"
            value={draft.gracePeriodDays}
            onChange={(e) => set('gracePeriodDays', e.target.value)}
          />
          <Input
            label="Renewal reminder (days before expiry)"
            name="renewalReminderDays"
            type="number"
            value={draft.renewalReminderDays}
            onChange={(e) => set('renewalReminderDays', e.target.value)}
          />
        </div>
      </Section>

      {/* Feature rules grid */}
      <Section
        title="Feature rules"
        description="Per-feature enable / limit / unlimited toggles. Backend keeps any feature key not listed here untouched, so partial saves are safe."
      >
        {featureCatalog.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" />
            Loading feature catalog…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Feature</th>
                  <th className="px-2 py-2 w-20">Enabled</th>
                  <th className="px-2 py-2 w-32">Limit</th>
                  <th className="px-2 py-2 w-24">Unlimited</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r, idx) => (
                  <tr key={r.featureKey} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <p className="font-medium text-slate-800">
                        {r.featureName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-400">
                        {r.featureKey}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={!!r.isEnabled}
                        onChange={(e) =>
                          updateRule(idx, { isEnabled: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={r.limitValue}
                        onChange={(e) =>
                          updateRule(idx, { limitValue: e.target.value })
                        }
                        disabled={!r.isEnabled || r.isUnlimited}
                        className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={!!r.isUnlimited}
                        onChange={(e) =>
                          updateRule(idx, { isUnlimited: e.target.checked })
                        }
                        disabled={!r.isEnabled}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="bg-amber-600 hover:bg-amber-700"
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={14} />
              {isEdit ? 'Save changes' : 'Create plan'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
