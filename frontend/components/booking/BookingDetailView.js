'use client';

// BookingDetailView — the shared detail card used by both
// /dashboard/client/bookings/:id and /dashboard/professional/bookings/:id.
//
// Sections (top to bottom):
//   1. Professional basic details + Connect chips (client viewer) OR
//      Client details + Connect chips (pro viewer).
//   2. Booking summary (date, time, duration, status, escrow).
//   3. Notes — read existing, add new (any participant).
//   4. Client-only: review form when canReview is true.
//   5. Pro-only: "Convert to case" button.

import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Briefcase,
  Star,
  Paperclip,
  X,
  Loader2,
  BadgeCheck,
  MapPin,
  ArrowUpRight,
  CreditCard,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Avatar from '@/components/common/Avatar';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import ConnectChips from '@/components/booking/ConnectChips';
import ReviewForm from '@/components/reviews/ReviewForm';
import PlanLimitBanner from '@/components/common/PlanLimitBanner';
import bookingService from '@/services/bookingService';
import { formatINR, payForBooking } from '@/services/paymentService';
import { useAuth } from '@/components/AuthProvider';
import InstantBadge, { isInstantBooking } from '@/components/booking/InstantBadge';
import { uploadFile, resolveFileUrl } from '@/services/fileService';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { formatSlotLabel } from '@/utils/availability';

const BOOKING_STATUS_VARIANT = {
  pending: 'amber',
  confirmed: 'blue',
  completed: 'green',
  cancelled: 'red',
};

const ESCROW_STATUS_LABEL = {
  escrowed: 'Held in escrow',
  awaiting_review: 'Awaiting your review',
  ready_to_release: 'Ready to release',
  payout_requested: 'Payout requested',
  released: 'Released',
  withdrawn: 'Withdrawn',
  refunded: 'Refunded',
};

/**
 * Props:
 *  - detail: result of bookingService.getDetail(id)
 *  - viewer: 'client' | 'professional'
 *  - onReload: () => Promise<void> — refetch after note / review / convert
 */
export default function BookingDetailView({ detail, viewer, onReload }) {
  const [noteText, setNoteText] = useState('');
  const [noteError, setNoteError] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  // Staged attachments awaiting note submission. Each item is the file
  // metadata returned by uploadFile() — already on disk, so the note POST
  // only needs to reference the URL.
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTitle, setConvertTitle] = useState('');
  const [convertDescription, setConvertDescription] = useState('');
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertError, setConvertError] = useState('');
  // Holds the raw error from a failed convert so PlanLimitBanner can read
  // err.payload.code + limit metadata and render the upgrade CTA.
  const [convertErrorObj, setConvertErrorObj] = useState(null);
  const [convertSuccess, setConvertSuccess] = useState('');

  // Pay-again retry state — only relevant on the client viewer when an
  // earlier Razorpay order was created but never captured.
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const { user: authUser } = useAuth();

  if (!detail) return null;
  const {
    booking,
    professional,
    client,
    payment,
    escrow,
    notes,
    reviews = {},
    reviewWindow,
    linkedCase,
    permissions,
  } = detail;
  const professionalReview = reviews.professional;
  const consultationByClient = reviews.consultationByClient;
  const consultationByProfessional = reviews.consultationByProfessional;
  const clientReview = reviews.client;

  const counterparty = viewer === 'client' ? professional : client;
  const counterpartyLabel = viewer === 'client' ? 'Professional' : 'Client';

  // Payment status — `payment` is null when no order was ever created.
  // Status 'created'/'failed' both mean "money has not landed", which is
  // when the Pay-again CTA appears (client viewer only) and when we lock
  // down contact details + the add-note form for everyone. 'paid' and
  // 'refunded' unlock those.
  const paymentStatus = (payment && payment.status) || (payment ? 'created' : null);
  const isPaymentPending =
    booking.status !== 'cancelled' &&
    booking.status !== 'completed' &&
    (paymentStatus === null ||
      paymentStatus === 'created' ||
      paymentStatus === 'failed');
  const canPayAgain = viewer === 'client' && isPaymentPending;

  async function handlePayAgain() {
    if (paying) return;
    setPayError('');
    setPaying(true);
    try {
      const result = await payForBooking({
        bookingId: booking.id,
        prefill: {
          name: (authUser && authUser.name) || '',
          email: (authUser && authUser.email) || '',
          phone: (authUser && authUser.mobileNumber) || '',
        },
      });
      // User dismissed the Razorpay modal — silently leave the page state
      // unchanged so they can click again.
      if (result && result.cancelled) {
        setPaying(false);
        return;
      }
      // Successful capture — reload the detail so the badge flips to "paid"
      // and the Pay-again CTA disappears.
      if (typeof onReload === 'function') await onReload();
    } catch (err) {
      setPayError(err.message || 'Payment could not be processed. Try again.');
    } finally {
      setPaying(false);
    }
  }

  async function handleAttachmentChange(e) {
    const files = Array.from((e.target && e.target.files) || []);
    if (!files.length) return;
    setNoteError('');
    setUploading(true);
    try {
      // Upload sequentially — keeps the spinner UI honest and avoids
      // overwhelming the dev server with parallel multipart writes.
      const uploaded = [];
      for (const file of files) {
        const meta = await uploadFile(file, 'booking_note', {
          bookingId: booking.id,
        });
        uploaded.push({
          url: meta.url,
          name: meta.originalName || file.name,
          mimeType: meta.mimeType || file.type,
          size: meta.size || file.size,
        });
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setNoteError(err.message || 'Could not upload the file.');
    } finally {
      setUploading(false);
      // Reset the input so re-picking the same filename still fires onChange.
      if (e.target) e.target.value = '';
    }
  }

  function removePendingAttachment(idx) {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAddNote(e) {
    if (e) e.preventDefault();
    const hasBody = noteText.trim().length > 0;
    const hasFiles = pendingAttachments.length > 0;
    if ((!hasBody && !hasFiles) || postingNote) return;
    setNoteError('');
    setPostingNote(true);
    try {
      await bookingService.addNote(booking.id, {
        body: noteText.trim(),
        attachments: pendingAttachments,
      });
      setNoteText('');
      setPendingAttachments([]);
      if (onReload) await onReload();
    } catch (err) {
      setNoteError(err.message || 'Could not post the note.');
    } finally {
      setPostingNote(false);
    }
  }

  async function handleConvert(e) {
    if (e) e.preventDefault();
    if (convertSubmitting) return;
    setConvertError('');
    setConvertSubmitting(true);
    try {
      const result = await bookingService.convertToCase(booking.id, {
        title: convertTitle.trim() || undefined,
        description: convertDescription.trim() || undefined,
      });
      setConvertOpen(false);
      setConvertTitle('');
      setConvertDescription('');
      // Send the pro to the case page in both branches: a fresh case OR
      // the existing one (when the booking was already converted). The
      // tiny delay lets the success/notice banner paint first.
      const caseId = result && result.case && result.case.id;
      if (caseId) {
        if (result.alreadyExisted) {
          setConvertSuccess(
            'This booking was already converted — opening the existing case.'
          );
        } else {
          setConvertSuccess(`Case created from booking ${booking.id.slice(-8)}.`);
        }
        setTimeout(() => {
          window.location.href = `/dashboard/professional/cases/${caseId}`;
        }, 600);
      } else {
        setConvertSuccess(`Case created from booking ${booking.id.slice(-8)}.`);
        if (onReload) await onReload();
      }
    } catch (err) {
      setConvertErrorObj(err);
      // Suppress the plain-text fallback when PlanLimitBanner is going to
      // render the richer upgrade card; otherwise show the generic msg.
      const isPlanLimit =
        err && err.payload && err.payload.code === 'PLAN_LIMIT_REACHED';
      setConvertError(
        isPlanLimit ? '' : err.message || 'Could not convert to a case.'
      );
    } finally {
      setConvertSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {convertSuccess && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{convertSuccess}</span>
          <button
            type="button"
            onClick={() => setConvertSuccess('')}
            className="text-xs font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Counter-party basic details + Connect.
          For clients viewing a booking, the top card mirrors the
          marketplace listing — photo, name, verified pill, professional
          type, rating + reviews, city, years of experience, fee, and a
          "View profile" link. The professional viewer still sees a
          simpler client identity card (no rating/fee/profile link). */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar
              src={counterparty && counterparty.profilePhoto}
              name={counterparty ? counterparty.name : ''}
              size="lg"
              priority
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {counterpartyLabel}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <h2 className="text-lg font-bold text-slate-900">
                  {counterparty ? counterparty.name : '—'}
                </h2>
                {viewer === 'client' && counterparty && counterparty.verified && (
                  <BadgeCheck
                    size={16}
                    className="shrink-0 text-blue-600"
                    aria-label="Verified"
                  />
                )}
              </div>
              {counterparty && counterparty.designation && (
                <p className="text-sm text-slate-600">
                  {counterparty.designation}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {counterparty && counterparty.professionalType && (
                  <Badge variant="blue">{counterparty.professionalType}</Badge>
                )}
                {viewer === 'client' &&
                  counterparty &&
                  counterparty.city && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={12} className="text-slate-400" />
                      {counterparty.city}
                    </span>
                  )}
                {viewer === 'client' &&
                  counterparty &&
                  Number(counterparty.yearsOfExperience) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Briefcase size={12} className="text-slate-400" />
                      {counterparty.yearsOfExperience}+ yrs
                    </span>
                  )}
                {viewer === 'client' &&
                  counterparty &&
                  Number(counterparty.rating) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                      <Star
                        size={12}
                        className="fill-amber-400 text-amber-500"
                      />
                      {Number(counterparty.rating).toFixed(1)}
                      {Number(counterparty.reviewsCount) > 0 && (
                        <span className="text-slate-400">
                          ({counterparty.reviewsCount})
                        </span>
                      )}
                    </span>
                  )}
              </div>
              {/* Bio intentionally omitted on the booking-detail card —
                  the client can click "View full profile" for the long
                  read. Keeps this card tight.
                  consultationFee is stored as RUPEES on the professional
                  record (DECIMAL(10,2)) — use formatCurrency, NOT formatINR
                  (which divides paise/100 and was producing "₹0.20"). */}
              {viewer === 'client' &&
                counterparty &&
                Number(counterparty.consultationFee) > 0 && (
                  <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <CreditCard size={12} className="text-slate-400" />
                    {formatCurrency(counterparty.consultationFee)} per minute
                  </p>
                )}
              {viewer === 'client' && counterparty && counterparty.id && (
                <a
                  href={`/professionals/${counterparty.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group mt-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 hover:text-amber-800"
                >
                  View full profile
                  <ArrowUpRight
                    size={13}
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </a>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <p className="mb-2 text-xs font-medium text-slate-500">
              Connect
            </p>
            {/* Contact details unlock only after payment lands — keeps
                clients from bypassing the platform fee while the booking
                is still in escrow-pending. Both viewers see the same lock. */}
            {isPaymentPending ? (
              <span className="inline-flex max-w-[14rem] items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                <ShieldCheck size={12} className="mt-0.5 shrink-0" />
                Contact details unlock after payment is confirmed.
              </span>
            ) : counterparty ? (
              <ConnectChips
                phone={counterparty.phone}
                email={counterparty.email}
                waMessage={`Hi ${counterparty.name}, this is about Profirmo booking ${booking.id.slice(-8)}.`}
                emailSubject={`Profirmo booking ${booking.id.slice(-8)}`}
                size="md"
              />
            ) : (
              <span className="text-xs text-slate-400">No contact info</span>
            )}
          </div>
        </div>
      </Card>

      {/* 1b. Pay-again banner — appears when the client has an open
          booking with no successful payment yet. The Razorpay modal opens
          on click; on success the detail reloads and the banner vanishes. */}
      {canPayAgain && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
              <CreditCard size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {paymentStatus === 'failed'
                  ? 'Last payment attempt failed'
                  : 'Payment pending for this booking'}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-amber-800">
                {(() => {
                  // Prefer the live pending-payment amount (already in
                  // paise from Razorpay); fall back to booking.estimatedCost
                  // in rupees so we always show what the client owes —
                  // includes the 2× multiplier for instant bookings.
                  const paise =
                    payment && payment.amount
                      ? payment.amount
                      : Number(booking.estimatedCost) > 0
                        ? Number(booking.estimatedCost) * 100
                        : null;
                  return paise ? `Amount due: ${formatINR(paise)}. ` : '';
                })()}
                Complete the payment to confirm the slot. The professional
                isn&apos;t notified until payment lands.
              </p>
              {payError && (
                <p className="mt-1.5 text-xs font-medium text-red-700">
                  {payError}
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handlePayAgain}
            disabled={paying}
            variant="primary"
            size="md"
            className="shrink-0"
          >
            {paying ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <CreditCard size={14} />
                {paymentStatus === 'failed' ? 'Try payment again' : 'Pay now'}
              </>
            )}
          </Button>
        </div>
      )}

      {/* 2. Booking summary */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Booking summary
            </h3>
            {isInstantBooking(booking) && <InstantBadge size="sm" />}
          </div>
          <Badge variant={BOOKING_STATUS_VARIANT[booking.status] || 'gray'}>
            {booking.status}
          </Badge>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              When
            </dt>
            <dd className="mt-1 text-slate-800">
              {booking.type === 'instant'
                ? 'Instant — Now'
                : booking.date
                ? `${formatDate(booking.date)}${
                    booking.time ? `, ${formatSlotLabel(booking.time)}` : ''
                  }`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Duration
            </dt>
            <dd className="mt-1 text-slate-800">
              {booking.duration ? `${booking.duration} min` : '—'}
            </dd>
          </div>
          {/* Only show "Amount paid" when the money actually landed —
              created/failed payments live alongside, but render in the
              Pay-again banner above instead. */}
          {payment && (payment.status === 'paid' || payment.status === 'refunded') && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Amount paid
              </dt>
              <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-slate-800">
                {formatINR(payment.amount)}
                {isInstantBooking(booking) && (
                  <span className="text-[11px] font-medium text-amber-700">
                    (includes 2× instant rate)
                  </span>
                )}
              </dd>
            </div>
          )}
          {/* Pending/failed bookings expose the amount due so the booking
              summary still shows what the client owes (in addition to the
              banner up top). Uses the latest pending payment when one
              exists, else booking.estimatedCost (now stores the
              already-multiplied value for instant bookings). */}
          {(!payment || (payment.status !== 'paid' && payment.status !== 'refunded')) &&
            (Number((payment && payment.amount) || booking.estimatedCost) > 0) && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Amount due
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-slate-800">
                  {payment && payment.amount
                    ? formatINR(payment.amount)
                    : formatINR(Number(booking.estimatedCost) * 100)}
                  {isInstantBooking(booking) && (
                    <span className="text-[11px] font-medium text-amber-700">
                      (includes 2× instant rate)
                    </span>
                  )}
                </dd>
              </div>
            )}
          {escrow && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Escrow
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-slate-800">
                <ShieldCheck size={14} className="text-emerald-600" />
                {ESCROW_STATUS_LABEL[escrow.status] || escrow.status}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* 3. Notes */}
      <Card>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <MessageSquare size={16} />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">
            Notes / Messages
          </h3>
        </div>

        {notes && notes.length > 0 ? (
          <div className="mt-4 space-y-3">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {n.authorName || n.authorRole}
                    <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      {n.authorRole}
                    </span>
                  </span>
                  <span>{formatDate(n.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">
                  {n.body}
                </p>
                {Array.isArray(n.attachments) && n.attachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {n.attachments.map((a, i) => (
                      <li key={(a && a.url) || i} className="text-xs">
                        <a
                          href={resolveFileUrl(a && a.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:border-amber-300 hover:text-amber-700"
                        >
                          <Paperclip size={12} />
                          {(a && (a.name || a.url)) || 'attachment'}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No messages yet. Add the first one below.
          </p>
        )}

        {/* Locked while payment is pending — note-thread + uploads only
            open up once the booking is actually paid. Existing notes
            (rendered above) stay visible either way. */}
        {isPaymentPending && permissions.canAddNote && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <ShieldCheck size={12} className="text-amber-600" />
            Notes &amp; messages will open after payment is confirmed.
          </p>
        )}

        {!isPaymentPending && permissions.canAddNote && (
          <form onSubmit={handleAddNote} className="mt-4 space-y-2">
            <label
              htmlFor="booking-note"
              className="text-sm font-medium text-slate-700"
            >
              Add a note / message
            </label>
            <textarea
              id="booking-note"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Anything you want to share about this booking…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />

            {pendingAttachments.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {pendingAttachments.map((a, i) => (
                  <li
                    key={`${a.url}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                  >
                    <Paperclip size={12} className="text-slate-400" />
                    <span className="max-w-[180px] truncate">{a.name || a.url}</span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(i)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove attachment"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {noteError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle size={13} />
                {noteError}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-amber-300 hover:text-amber-700">
                {uploading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Paperclip size={13} />
                )}
                {uploading ? 'Uploading…' : 'Attach files'}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttachmentChange}
                  disabled={uploading}
                />
              </label>
              <Button
                type="submit"
                size="sm"
                disabled={
                  postingNote ||
                  uploading ||
                  (!noteText.trim() && pendingAttachments.length === 0)
                }
              >
                {postingNote ? 'Posting…' : 'Post note'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* 4. Reviews — each side has up to two review slots PLUS a read-only
          view of the other side's reviews. Window status banner up top. */}
      {(viewer === 'client' || viewer === 'professional') && (
        <>
          {reviewWindow && booking.status === 'completed' && reviewWindow.closesAt && (
            <Card>
              <p className="text-xs text-slate-600">
                {reviewWindow.open ? (
                  <>
                    Review window closes on{' '}
                    <span className="font-semibold text-slate-800">
                      {formatDate(reviewWindow.closesAt)}
                    </span>
                    . After that, the escrow auto-releases and no further
                    reviews can be added.
                  </>
                ) : (
                  <>
                    The review window for this booking has closed and the
                    escrow has been released. Past reviews remain visible.
                  </>
                )}
              </p>
            </Card>
          )}

          {/* Client side */}
          {viewer === 'client' && (
            <>
              <ReviewCard
                iconBg="bg-blue-100 text-blue-700"
                title="Rate the consultation"
                existingReview={consultationByClient}
                existingNote={
                  consultationByClient &&
                  `You rated the consultation ${consultationByClient.rating} / 5${
                    consultationByClient.comment
                      ? `: "${consultationByClient.comment}"`
                      : '.'
                  }`
                }
                canSubmit={permissions.canReviewConsultationAsClient}
                gateMessage="The consultation review unlocks once your professional marks this booking completed."
                form={
                  <ReviewForm
                    kind="consultation"
                    professionalId={booking.professionalId}
                    bookingId={booking.id}
                    onSubmitted={onReload}
                  />
                }
              />
              <ReviewCard
                iconBg="bg-amber-100 text-amber-700"
                title="Rate the professional (optional)"
                existingReview={professionalReview}
                existingNote={
                  professionalReview &&
                  `You rated ${professional ? professional.name : 'the professional'} ${
                    professionalReview.rating
                  } / 5${
                    professionalReview.comment
                      ? `: "${professionalReview.comment}"`
                      : '.'
                  }`
                }
                canSubmit={permissions.canReviewProfessional}
                gateMessage="The professional review is optional and unlocks once your professional marks this booking completed."
                form={
                  <ReviewForm
                    kind="professional"
                    professionalId={booking.professionalId}
                    bookingId={booking.id}
                    onSubmitted={onReload}
                  />
                }
              />
            </>
          )}

          {/* Professional side — only the consultation review. The pro
              does NOT review the client (per spec). */}
          {viewer === 'professional' && (
            <ReviewCard
              iconBg="bg-blue-100 text-blue-700"
              title="Rate the consultation"
              existingReview={consultationByProfessional}
              existingNote={
                consultationByProfessional &&
                `You rated the consultation ${consultationByProfessional.rating} / 5${
                  consultationByProfessional.comment
                    ? `: "${consultationByProfessional.comment}"`
                    : '.'
                }`
              }
              canSubmit={permissions.canReviewConsultationAsProfessional}
              gateMessage="Mark this booking completed to leave a consultation review."
              form={
                <ReviewForm
                  kind="consultation"
                  professionalId={booking.professionalId}
                  bookingId={booking.id}
                  onSubmitted={onReload}
                />
              }
            />
          )}

          {/* Read-only view of the OTHER side's consultation review. */}
          {viewer === 'client' && consultationByProfessional && (
            <Card>
              <h3 className="text-sm font-semibold text-slate-900">
                Professional's consultation review
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">
                  {consultationByProfessional.rating} / 5
                </span>
                {consultationByProfessional.comment
                  ? ` — "${consultationByProfessional.comment}"`
                  : ''}
              </p>
            </Card>
          )}

          {viewer === 'professional' &&
            (consultationByClient || professionalReview) && (
              <Card>
                <h3 className="text-sm font-semibold text-slate-900">
                  Client's reviews
                </h3>
                {consultationByClient && (
                  <p className="mt-2 text-sm text-slate-600">
                    Consultation:{' '}
                    <span className="font-semibold text-slate-800">
                      {consultationByClient.rating} / 5
                    </span>
                    {consultationByClient.comment
                      ? ` — "${consultationByClient.comment}"`
                      : ''}
                  </p>
                )}
                {professionalReview && (
                  <p className="mt-2 text-sm text-slate-600">
                    About you:{' '}
                    <span className="font-semibold text-slate-800">
                      {professionalReview.rating} / 5
                    </span>
                    {professionalReview.comment
                      ? ` — "${professionalReview.comment}"`
                      : ''}
                  </p>
                )}
              </Card>
            )}
        </>
      )}

      {/* 5. Pro-only: convert-to-case OR open-existing-case. One booking
          can only have one live case at a time — when one already exists
          we show a direct link to it instead of the convert CTA. */}
      {viewer === 'professional' && (linkedCase || permissions.canConvertToCase) && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Briefcase size={16} />
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  {linkedCase ? 'Linked case' : 'Convert to case'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {linkedCase
                  ? `This booking has already been converted into "${linkedCase.title || 'a case'}" (${linkedCase.status}). Delete the case if you want to convert this booking again.`
                  : 'Open a case from this booking — booking notes (with attachments) will be copied into the case timeline.'}
              </p>
            </div>
            {linkedCase ? (
              <Button
                size="sm"
                variant="primary"
                href={`/dashboard/professional/cases/${linkedCase.id}`}
              >
                <Briefcase size={14} />
                Open case
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setConvertTitle(
                    `Case — ${(client && client.name) || 'Client'} (booking ${booking.id.slice(-8)})`
                  );
                  setConvertOpen(true);
                }}
              >
                <Briefcase size={14} />
                Convert
              </Button>
            )}
          </div>
        </Card>
      )}

      <Modal
        open={convertOpen}
        onClose={() => !convertSubmitting && setConvertOpen(false)}
        title="Convert booking to case"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConvertOpen(false)}
              disabled={convertSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConvert}
              disabled={convertSubmitting}
            >
              {convertSubmitting ? 'Creating…' : 'Create case'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleConvert} className="space-y-3">
          <Input
            label="Case title"
            name="title"
            value={convertTitle}
            onChange={(e) => setConvertTitle(e.target.value)}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={convertDescription}
              onChange={(e) => setConvertDescription(e.target.value)}
              placeholder="Notes from the booking will be appended automatically."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <PlanLimitBanner err={convertErrorObj} />
          {convertError && (
            <p className="text-xs text-red-600">{convertError}</p>
          )}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>
    </div>
  );
}

/**
 * ReviewCard — one of the three review surfaces (consultation, professional,
 * client). Renders the existing review when present, the gate message when
 * the action isn't allowed yet, or the supplied ReviewForm otherwise.
 */
function ReviewCard({
  iconBg,
  title,
  existingReview,
  existingNote,
  canSubmit,
  gateMessage,
  form,
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Star size={16} />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {existingReview ? (
        <p className="mt-3 text-sm text-slate-600">{existingNote}</p>
      ) : !canSubmit ? (
        <p className="mt-3 text-sm text-slate-500">{gateMessage}</p>
      ) : (
        <div className="mt-4">{form}</div>
      )}
    </Card>
  );
}
