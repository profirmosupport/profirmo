'use client';

// LeadOtpVerification — the shared "enter the 6-digit code" step used by
// every lead form (homepage/advanced-search gate, callback floater,
// professional Contact modal). The parent creates the lead (submitLead),
// then renders this with the returned leadId; on success it calls
// onVerified() — at which point the backend has set the pf_lead access
// cookie and the parent can redirect to /search.
//
// Resend is throttled both here (30s countdown) and on the server
// (cooldown + cap), so the SMS gateway can't be spammed.

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { verifyLeadOtp, resendLeadOtp } from '@/services/leadService';
import { trackLeadConversion } from '@/utils/adsConversion';

const RESEND_COOLDOWN_S = 30;

function fmtCountdown(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

export default function LeadOtpVerification({
  leadId,
  phone,
  email,
  otp,
  onVerified,
}) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resending, setResending] = useState(false);
  // If the initial send failed, allow an immediate resend; otherwise start
  // the cooldown since a code was just dispatched on capture.
  const [resendIn, setResendIn] = useState(
    otp && otp.error ? 0 : RESEND_COOLDOWN_S
  );
  const [debugCode, setDebugCode] = useState((otp && otp.debugCode) || '');

  useEffect(() => {
    if (otp && otp.error) {
      setError(otp.message || "We couldn't send the code — tap Resend.");
    } else {
      setInfo(`We sent a 6-digit code to ${phone}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setInterval(
      () => setResendIn((s) => (s <= 1 ? 0 : s - 1)),
      1000
    );
    return () => clearInterval(t);
  }, [resendIn]);

  async function verify(e) {
    if (e) e.preventDefault();
    if (verifying) return;
    const c = code.replace(/\D/g, '').slice(0, 6);
    if (c.length !== 6) {
      setError('Enter the 6-digit code from the SMS.');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      await verifyLeadOtp(leadId, c);
      // Phone is now OTP-verified — record the Google Ads conversion with
      // Enhanced Conversions data (verified phone + email), deduped by
      // leadId. Fires here (not on /search) so the identifiers are present.
      trackLeadConversion({ leadId, email, phone });
      onVerified?.();
    } catch (err) {
      const data = err && err.payload && err.payload.data;
      let msg = (err && err.message) || 'Verification failed. Please try again.';
      if (data && typeof data.attemptsRemaining === 'number') {
        msg += ` (${data.attemptsRemaining} attempt${
          data.attemptsRemaining === 1 ? '' : 's'
        } left)`;
      }
      setError(msg);
      setVerifying(false);
    }
  }

  async function resend() {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      const res = await resendLeadOtp(leadId);
      setInfo(`A new code was sent to ${phone}.`);
      if (res && res.debugCode) setDebugCode(res.debugCode);
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      const data = err && err.payload && err.payload.data;
      if (data && data.retryAfterMs) {
        setResendIn(Math.ceil(data.retryAfterMs / 1000));
      }
      setError((err && err.message) || 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldCheck size={16} className="text-emerald-600" />
        Verify your phone number
      </div>
      <p className="text-xs leading-snug text-slate-500">
        {info || `Enter the 6-digit code sent to ${phone}.`}
      </p>
      <form onSubmit={verify} className="space-y-2.5">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            setError('');
          }}
          placeholder="••••••"
          aria-label="6-digit verification code"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg font-semibold tracking-[0.5em] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        {debugCode && (
          <p className="text-[11px] text-amber-600">Dev code: {debugCode}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={verifying}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {verifying ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ShieldCheck size={15} />
          )}
          {verifying ? 'Verifying…' : 'Verify & continue'}
        </button>
      </form>
      <button
        type="button"
        onClick={resend}
        disabled={resending || resendIn > 0}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
        {resending
          ? 'Sending…'
          : resendIn > 0
            ? `Resend code in ${fmtCountdown(resendIn)}`
            : 'Resend code'}
      </button>
    </div>
  );
}
