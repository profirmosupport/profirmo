# Profirmo Mobile

React Native (Expo) app for **clients** and **professionals** on the
Profirmo platform. Single app — the role on the signed-in account
decides which set of tabs is shown. Admin tooling stays on the web.

```
apps/
├── App.js                       # SafeAreaProvider + AuthProvider + RootNavigator
├── app.json                     # Expo config (extra.apiBaseUrl)
├── package.json
└── src/
    ├── config/                  # API base URL, role constants
    ├── contexts/                # AuthContext (session + role)
    ├── services/                # API client + per-domain wrappers
    ├── navigation/              # AuthStack + ProfessionalTabs + ClientTabs
    ├── components/common/       # Button, Input, Card, Badge, ScreenContainer …
    ├── screens/
    │   ├── auth/                # Login, Signup, ForgotPassword
    │   ├── shared/              # Profile, Notifications, BookingDetail …
    │   ├── professional/        # Dashboard, Bookings, Cases, Subscription …
    │   └── client/              # Dashboard, Find professional, Bookings …
    ├── theme/                   # Colors, spacing, radii, type
    └── utils/                   # AsyncStorage helpers, formatters
```

## Run it

The mobile app talks to the existing Profirmo backend (default
`http://localhost:5001`). Start the backend first as you would for the
web app, then:

```bash
cd apps
npm install
npm start
```

`expo start` prints a QR code. Scan it with the Expo Go app on iOS /
Android, or press `i` / `a` in the terminal to open the iOS simulator /
Android emulator.

### Pointing at a backend on your dev machine

Physical devices can't reach `localhost` — set the LAN IP of the
machine running the backend:

```bash
EXPO_PUBLIC_API_URL="http://192.168.1.42:5001" npm start
```

Or edit `app.json → extra.apiBaseUrl`.

## What's wired

**Both roles**

- Email + password sign in / sign up (`POST /api/auth/login`, `/api/auth/signup`)
- Persistent session via AsyncStorage (`profirmo:access_token`)
- Notifications inbox + auto-mark-as-read
- Profile + sign out

**Professional**

- Dashboard with current plan, quota usage, upcoming bookings
- Bookings + Cases lists (tap → detail)
- Subscription page — switch plans, opens Razorpay short_url in the
  device browser for paid plans
- Payments — merged booking payouts + subscription charges
- Wallet — balance + escrow activity
- Firm — owned firm + members + pending invitations

**Client**

- Dashboard with CTA to find a professional + upcoming bookings
- Find a professional (search + list)
- Professional detail with "Book a consultation" CTA
- My bookings + My cases lists
- My payments

## Razorpay subscription flow

Razorpay's native SDK is heavier and platform-specific. For the first
cut we initiate the subscription server-side (`POST
/api/subscriptions/upgrade`), then open the returned `short_url` via
`Linking.openURL(...)` so the user completes the mandate in their
mobile browser. The existing `subscription.activated` webhook + the
self-healing fetch on `getActiveSubscriptionForUser` flip the row to
active server-side; the dashboard refreshes on next pull.

If you need an in-app Checkout UX later, drop in the
`react-native-razorpay` package and reuse `subscriptionService.upgradeSubscription`
to obtain the `subscription_id` for `RazorpayCheckout.open`.

## Admin

Admin users (`role=platform_admin`) who sign in are shown a friendly
"Admin tools are web-only" screen with a Sign out button. There is no
admin surface in the mobile app by design.
