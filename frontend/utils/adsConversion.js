// Google Ads conversion tracking for verified leads.
//
// Fired once, at the moment a lead's phone OTP is verified (from
// LeadOtpVerification) — the only point where we have the full, trusted
// identity (verified phone + email + leadId). This is far better than a raw
// /search pageview trigger: it counts only real, phone-verified leads and
// feeds Enhanced Conversions with high-quality match data, which is what
// lets Smart Bidding actually optimise.
//
// Two signals are emitted:
//   1. `lead_verified` event — use this as an event-based conversion trigger
//      in Google Ads (works even before a conversion label is configured).
//   2. `conversion` with send_to — the direct conversion action, active once
//      NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL is set (Vercel env).
// Both carry transaction_id = leadId so Google de-duplicates a lead to a
// single conversion no matter how many times the event reaches it.

const ADS_ID = 'AW-18292736304';
const CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || '';

// Normalise an Indian phone number to E.164 (+91XXXXXXXXXX) for Enhanced
// Conversions matching. Best-effort — Google re-normalises + hashes anyway.
function toE164(phone) {
  const d = String(phone || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  if (d.length === 11 && d.startsWith('0')) return `+91${d.slice(1)}`;
  return String(phone).trim().startsWith('+') ? String(phone).trim() : `+${d}`;
}

/**
 * Record a verified-lead conversion. No-ops safely when gtag isn't loaded.
 *
 * @param {object} opts
 * @param {string} opts.leadId - dedup / transaction id
 * @param {string} [opts.email]
 * @param {string} [opts.phone]
 */
export function trackLeadConversion({ leadId, email, phone } = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  try {
    // Enhanced Conversions: provide user-provided identifiers. The Google
    // tag hashes these (SHA-256) client-side before they ever leave the
    // browser. Requires "Enhanced conversions" to also be turned ON in the
    // Google Ads UI.
    const userData = {};
    const e = String(email || '').trim().toLowerCase();
    const p = toE164(phone);
    if (e) userData.email = e;
    if (p) userData.phone_number = p;
    if (Object.keys(userData).length > 0) {
      window.gtag('set', 'user_data', userData);
    }

    const params = leadId ? { transaction_id: String(leadId) } : {};

    // Generic signal — usable as an event-based conversion trigger.
    window.gtag('event', 'lead_verified', params);

    // Direct conversion action (once the label is configured).
    if (CONVERSION_LABEL) {
      window.gtag('event', 'conversion', {
        send_to: `${ADS_ID}/${CONVERSION_LABEL}`,
        ...params,
      });
    }
  } catch {
    /* never let analytics break the verification flow */
  }
}

const adsConversion = { trackLeadConversion };
export default adsConversion;
