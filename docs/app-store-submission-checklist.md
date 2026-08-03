# Profirmo — App Store & Google Play Submission Checklist

> Items marked **[CONFIRM]** are reasonable defaults to validate / edit before submission.
> Items marked **[NEEDED]** require external info to be provided.

---

## 1. Basic App Information

- **App Name**: Profirmo
- **Short Description / Subtitle** (≤30 chars iOS / ≤80 Play):
  - "Legal & Tax help on demand"
- **Full Description** (≤4000 chars):

  > Profirmo connects you with verified legal and tax professionals across India — instantly. Book consultations, manage your cases, search e-courts, talk to FirmoAI, and pay securely via Razorpay. For professionals: manage your profile, availability, bookings, cases, wallet & payouts, and firm membership — all from one place.
  >
  > - Verified legal & tax consultants
  > - Instant + scheduled consultations
  > - E-courts India case lookup
  > - Secure escrow payments
  > - Firm management (members, requests, cases, reviews)
  > - AI legal assistant (FirmoAI)

- **Promotional Text** (iOS, ≤170 chars; can be updated without resubmit):
  - "Talk to verified legal & tax experts in minutes. Book consultations, track cases, manage your firm — all in one app."
- **Keywords** (iOS, ≤100 chars CSV):
  - `legal,lawyer,tax,consultant,advocate,CA,gst,income tax,e-courts,case,firm,booking,advice,india`
- **Primary Category**: Business
- **Secondary Category**: Productivity (App Store only)
- **Target Audience**: 18+ (legal/tax services are adult-only by design)

---

## 2. Contact Information

- **Full Name**: [NEEDED — Profirmo legal contact]
- **Mobile Number**: +91 93108 19195 (sales line already wired in the app)
- **Email Address**: manage.loam@gmail.com (recommend `support@profirmo.com` for production)

---

## 3. Branding Assets

- **App Icon (1024×1024)**: present at `apps/src/assets/icon.png`
  - [CONFIRM] file is final 1024×1024 PNG; **no alpha channel** (iOS rejects transparent icons)
- **App Logo (PNG/SVG)**: in `frontend/public/logos/` — same brand mark

---

## 4. Screenshots & Videos

- **Phone Screenshots** — [NEEDED, capture from device]
  - 6.7" iPhone 15 Pro Max: 1290 × 2796
  - 6.5" iPhone 11 Pro Max: 1242 × 2688
  - 5.5" iPhone 8 Plus: 1242 × 2208
  - Android (Play): 1080 × 1920 minimum

  Recommended frames:
  1. Guest landing
  2. Search results
  3. Professional detail
  4. Booking flow
  5. Talk to Firmo
  6. Client dashboard
  7. Pro dashboard with availability / firm CTAs
  8. Firm dashboard

- **Tablet Screenshots**
  - 12.9" iPad Pro: 2048 × 2732 — same scenes
- **App Preview Video** (Optional)
  - 15–30 s walkthrough: landing → search → book → pay

---

## 5. URLs & Legal Pages

- **Support URL**: `https://profirmo.com/contact?topic=app-support`
- **Privacy Policy URL**: `https://profirmo.com/privacy` — [CONFIRM page exists / publish if missing]
- **Terms & Conditions URL**: `https://profirmo.com/terms` — [CONFIRM]
- **Website URL**: `https://profirmo.com`

---

## 6. Login Credentials (for App Review)

- **Test Username/Email**: [NEEDED — provision a non-production reviewer account, e.g. `appreview@profirmo.com`]
- **Test Password**: [NEEDED]
- **OTP Instructions**:
  - India phone signup uses OTP via SMS.
  - For App Review, use the **email + password** path on the sign-in screen so reviewers can bypass SMS.
  - If they need to test phone flows, provide a sandbox number or static OTP override.
- **Reviewer Access Instructions**:

  1. Open app → tap **Sign in** → enter the test email + password (above).
  2. To exercise the **Pro** role, switch to the Pro test account (also above).
  3. Razorpay payments are in **test mode** for review — use card `4111 1111 1111 1111`, any future expiry, any CVV.

---

## 7. Data Collection & Privacy

### Personal Information Collected

- Email, full name, mobile number, profile photo
- Address (country / state / city + line)
- Professional fields (for pros): bio, documents, registration numbers, license uploads
- Payment metadata (Razorpay subscription / customer IDs — **no card data stored**)
- Auth tokens stored locally on device (AsyncStorage)

### Purpose of Data Collection

- Account creation + authentication
- Booking + consultation fulfilment
- Payment processing (Razorpay)
- Professional onboarding + admin approval
- In-app notifications
- Customer support

### Data Sharing

- **No third-party advertising**; data shared only with **Razorpay** (payments) and **AWS** (storage).
- **No tracking SDKs.**

---

## 8. Third-Party Services

| Service | Used? | Notes |
|---|---|---|
| Firebase | ❌ | Not used |
| Google Sign-In | ❌ | Not used |
| Apple Sign-In | ❌ | Not used. *(If any social sign-in is added, Apple requires it as an alternative — Guideline 4.8.)* |
| Payments | ✅ | **Razorpay** (web-embedded via system browser through `Linking.openURL(shortUrl)` — no native SDK, no card collection in-app) |
| Notifications | ❌ | No push (in-app only). [CONFIRM intentional] |
| Analytics | ❌ | None |
| Other | ✅ | **ElevenLabs Convai** (voice assistant — "Talk to Firmo" via WebView) |
| Storage | ✅ | **AWS S3** (profile photos, firm docs) |
| Backend | ✅ | Profirmo own backend (`profirmo.onrender.com`) |
| Native modules | ✅ | `expo-image-picker` (camera + photo library), `react-native-webview` (Razorpay + ElevenLabs) |

---

## 9. Subscriptions & In-App Purchases

> ⚠️ **All paid plans are billed externally via Razorpay outside the app store.** This is permitted for services consumed outside the app (legal/tax consultations are real-world services). Apple App Store Review Guideline **3.1.3(e) Multiplatform Services** applies — confirm and add the right note in App Review.

- **Product Names**: Starter (free), Premium, Custom (sales-led)
- **Pricing**: Premium ₹999 / month (or annual); Starter free; Custom = WhatsApp sales
- **Billing Cycle**: monthly / annual via Razorpay recurring mandate
- **Benefits**: per-plan commission %, case limits, firm allowance, support tier
- **Restore Purchases**: N/A (no IAP) — but the dashboard auto-syncs subscription status from Razorpay webhooks
- ✅ **No StoreKit / Google Play Billing integration** — declare in submission

---

## 10. Permissions

| Permission | Used? | Purpose / Usage Description |
|---|---|---|
| **Camera** | ✅ | Profile photo, firm logo, document uploads (via `expo-image-picker`). `NSCameraUsageDescription`: *"Profirmo uses the camera to capture your profile photo, firm logo, and document uploads."* |
| **Photos** | ✅ | Pick existing profile photo / firm logo / documents. `NSPhotoLibraryUsageDescription`: *"Profirmo accesses your photo library so you can choose a profile photo, firm logo, or upload documents."* |
| **Microphone** | ✅ | ElevenLabs voice agent ("Talk to Firmo") needs mic access. `NSMicrophoneUsageDescription`: *"Profirmo uses the microphone so you can talk with FirmoAI, our voice legal assistant."* — set in `apps/app.json` → `ios.infoPlist`. |
| **Location** | ❌ | Not used |
| **Notifications** | ❌ | Not used (in-app only) |
| **Contacts** | ❌ | Not used |
| **Bluetooth** | ❌ | Not used |

---

## 11. Availability & Accessibility

- **Available Countries**: **India** primary.
  - Optionally roll out to English-speaking regions (US / UK / AU / CA / SG / AE) for discoverability — but legal/tax content is India-specific.
- **Localization**: English (en-IN) initially. Hindi planned (frontend has `LanguageProvider` infrastructure).
- **Accessibility**: VoiceOver / TalkBack labels present on key controls; dynamic font scaling supported by React Native defaults.

---

## 12. App Review Notes

### Special Instructions

- Profirmo is a **legal & tax services marketplace**. Consultations and firm services are **real-world services** rendered outside the app, so payments go through Razorpay (web view) per **App Store Guideline 3.1.3(e)**.
- The **Talk to Firmo** screen uses **ElevenLabs Convai** widget inside a WebView. It may request microphone permission for voice input.
- Test account credentials are above. Razorpay is configured in **test mode** for review.
- Some sections (Pro Dashboard, Firm Dashboard) only render for users with `role: 'professional'`. Use the Pro test account to exercise those.

### Hidden Features

- The **Firm Dashboard** right-side drawer (top-right menu icon) opens tabs for **Overview, Professionals, Join Requests, Clients, Leads, Cases, Reviews, and Firm Profile**.
- The **Pro dashboard's amber "Manage availability"** card opens the weekly schedule editor (per-day on/off + start/end times + rate per minute).
- **Custom plan** opens a WhatsApp deep-link to the sales line (+91 93108 19195).
- E-courts integration: from the **Search → E-courts** path, signed-in clients can save a case to their dashboard.

---

## Action Items Before Submission

1. **Publish privacy + terms** pages on `profirmo.com` — [CONFIRM live]: `https://profirmo.com/privacy`, `https://profirmo.com/terms` (now linked from the in-app signup screen too).
2. **Create dedicated review accounts** (client + professional) and document the credentials in this checklist. — [NEEDED, still open]
3. **Razorpay test mode**: switch the review build to test keys (or document a backend toggle). — [CONFIRM, still open]
4. ~~Add iOS info-plist usage descriptions~~ — ✅ **done** (`apps/app.json` → `ios.infoPlist`): `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription` all set. `expo-image-picker` config plugin added too. Android permissions are inferred by Expo from the plugins.
5. ~~App icon: confirm no alpha channel~~ — ✅ **done**, flattened via `sips`.
6. **Decide on push notifications**: enabling later requires a fresh update with a new permission prompt — easier to ship with the option built in (even if unused at launch). — still open, not built yet.
7. ~~EAS build & submit~~ — ✅ **done for iOS**, see Submission Log below. Android build/submit still pending.

---

## Submission Log

### iOS — v0.1.7 (build 1) — submitted 2026-07-31

- **App**: Profirmo, bundle ID `com.profirmo.app`
- **Apple Team**: LOAM IT Solutions Private Limited (`9ZL4WXFMQC`)
- **App Store Connect App ID (ascAppId)**: `6796593564`
- **EAS project**: `@dcexpo/profirmo` (`35655f73-2172-4c19-b061-c94899ca263d`)
- **Build ID**: `8df68c32-1dbf-4e77-a11c-f8e2d5a2b222`
- **Build artifact**: https://expo.dev/artifacts/eas/CV1vB5XR2grWM6X4jeoZwfuMbylMYONQlKP0WaY8ofI.ipa
- **Submission**: https://expo.dev/accounts/dcexpo/projects/profirmo/submissions/5b3de1ae-d7dc-47ce-802e-4e83430374e0
- **TestFlight**: https://appstoreconnect.apple.com/apps/6796593564/testflight/ios
- **App Store Connect API Key**: `[Expo] EAS Submit nX3aMyVN_O` (Key ID `AW6SHVM7QT`, role ADMIN, stored on EAS servers — reused automatically for future `eas submit` runs)
- **eas.json config**: `cli.appVersionSource: "remote"`, `build.production.ios.autoIncrement: true`, `submit.production.ios.ascAppId: "6796593564"`

### iOS — v0.1.7 (build 2) — submitted 2026-08-03

Superseded build 1: rebuilt to include `NSMicrophoneUsageDescription` (Talk to Firmo voice feature) and `supportsTablet: false` (iPad support removed — the app is phone-layout only, so no iPad screenshots are required).

- **Build ID**: `494a8118-aedb-4114-aebf-fd4f4a4997fb`
- **Build artifact**: https://expo.dev/artifacts/eas/igZT3Q_z3FmrfjK1J4KfB3_jJjPhI2E7iefhh1A-6Q8.ipa
- **Submission**: https://expo.dev/accounts/dcexpo/projects/profirmo/submissions/14947958-1a02-4059-be1a-2a28a02a728c
- **App Store screenshots**: generated in `apps/Screenshots/AppStore/` — `6.9-inch/` (1320×2868) and `6.5-inch/` (1242×2688), 7 images each, cover-cropped from the phone captures in `apps/Screenshots/`.

Remaining before this build can go out for public review: reviewer test accounts (item 2), Razorpay test-mode confirmation (item 3), rest of the App Store Connect listing (description, App Privacy questionnaire, age rating), then attach build 0.1.7 (2) to a version and **Submit for Review**.

### Android — not yet built/submitted

---

*Generated for Profirmo (com.profirmo.app). Last updated 2026-07-31 after first iOS TestFlight submission.*
