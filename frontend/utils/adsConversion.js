// Google Ads conversion tracking for verified leads.
//
// Two-phase, so the conversion is counted ONLY when the visitor lands on
// /search?requestVerifed after a genuine phone-OTP verification:
//
//   1. primeLeadConversion()  — at OTP verification (LeadOtpVerification):
//      set Enhanced-Conversions identifiers (verified email + E.164 phone,
//      hashed client-side by the Google tag) and stash the leadId. Does NOT
//      count a conversion yet.
//   2. fireLeadConversionIfPending() — on /search when the URL contains
//      `requestVerifed`: fire `lead_verified` (event-based trigger) and,
//      when NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL is set, a `conversion`
//      with send_to. Consumes the stashed leadId (transaction_id) so it
//      counts exactly once — a reload of the same URL never double-counts,
//      and a hand-typed ?requestVerifed with no prior verification counts
//      nothing.

const ADS_ID = 'AW-18292736304';
const CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || '';

// sessionStorage key holding the leadId of a just-verified lead that hasn't
// been counted as a conversion yet.
const STASH_KEY = 'pf_lead_conv_pending';

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
 * Phase 1 — called the instant a lead's phone OTP is verified. Primes
 * Enhanced-Conversions identity and marks a conversion as pending. No-ops
 * safely when gtag isn't loaded.
 */
export function primeLeadConversion({ leadId, email, phone } = {}) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.gtag === 'function') {
      const userData = {};
      const e = String(email || '').trim().toLowerCase();
      const p = toE164(phone);
      if (e) userData.email = e;
      if (p) userData.phone_number = p;
      if (Object.keys(userData).length > 0) {
        window.gtag('set', 'user_data', userData);
      }
    }
    if (leadId) window.sessionStorage.setItem(STASH_KEY, String(leadId));
  } catch {
    /* never break the verification flow */
  }
}

/**
 * Phase 2 — called on /search when the URL contains `requestVerifed`. Fires
 * the conversion once (deduped by the stashed leadId) and clears the stash.
 * Returns true if a conversion was counted.
 */
export function fireLeadConversionIfPending() {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return false;
  }
  try {
    const leadId = window.sessionStorage.getItem(STASH_KEY) || '';
    // Only count when this session actually just verified a lead — guards
    // against a hand-typed ?requestVerifed or a page reload.
    if (!leadId) return false;

    const params = { transaction_id: leadId };
    window.gtag('event', 'lead_verified', params);
    if (CONVERSION_LABEL) {
      window.gtag('event', 'conversion', {
        send_to: `${ADS_ID}/${CONVERSION_LABEL}`,
        ...params,
      });
    }
    window.sessionStorage.removeItem(STASH_KEY);
    return true;
  } catch {
    return false;
  }
}

const adsConversion = { primeLeadConversion, fireLeadConversionIfPending };
export default adsConversion;
