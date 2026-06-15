# PROFIRMO Project Overview

This document describes the React Native mobile app located in `apps/`.
The repository is a monorepo, but this file focuses on the mobile app
only.

## 1. Project Overview

### What the app appears to do

Profirmo is a marketplace and workflow app for legal and professional
services. The mobile app supports:

- Guest browsing of featured professionals, firms, blog posts, and
  eCourts-related content
- Client registration and login
- Professional registration and login
- Role-based dashboards for clients and professionals
- Bookings, cases, notifications, payments, wallet, subscription, and
  profile management
- A guest "Talk to Firmo" experience that uses an embedded web surface

The app is split into three user states:

- Guest
- Authenticated client
- Authenticated professional

Admin users are not supported in the mobile app and are redirected to an
"admin tools are web-only" screen.

### Main technology stack

- React Native
- Expo SDK 54
- React 19
- React Navigation v7
- AsyncStorage for persistent local session data
- Expo Linear Gradient, Expo Splash Screen, Expo Image Picker, Expo
  Status Bar
- `react-native-webview` for in-app checkout and embedded experiences
- `react-native-safe-area-context` and `react-native-screens`

### React Native setup details

The mobile app is configured as an Expo-managed app:

- `apps/index.js` registers the root component with Expo
- `apps/App.js` mounts the safe-area provider, auth context, and root
  navigator
- `apps/app.json` contains Expo metadata, icons, splash config, app
  scheme, package/bundle identifiers, and the API base URL fallback
- `apps/babel.config.js` uses `babel-preset-expo`

The project uses the new architecture flag in Expo config:

- `newArchEnabled: true`

There are no `apps/android/` or `apps/ios/` native project folders in
the repository, so the mobile app is currently managed through Expo
rather than a bare React Native setup.

## 2. Folder Structure

### Top-level files in `apps/`

- `App.js` - app bootstrap, splash handling, auth provider, root
  navigation
- `index.js` - Expo entrypoint
- `app.json` - Expo application configuration
- `babel.config.js` - Babel preset configuration for Expo
- `package.json` - scripts and dependencies
- `package-lock.json` - locked dependency tree
- `README.md` - short app-specific usage notes

### Major directories inside `apps/src/`

- `assets/`
  - App icons, splash image, and onboarding imagery
- `components/`
  - Reusable UI and feature components
  - `auth/` - onboarding and authentication UI pieces
  - `booking/` - booking flows and Razorpay checkout UI
  - `common/` - shared layout, cards, buttons, loaders, drawer, splash,
    and base controls
  - `firm/` - firm-related modals and UI
  - `guest/` - guest landing and marketplace cards
- `config/`
  - API base URL resolution and app constants such as role enums
- `contexts/`
  - Authentication/session context
- `navigation/`
  - Root and tab navigators for auth, guest, client, and professional
    flows
- `screens/`
  - Route-level UI grouped by audience
  - `auth/` - welcome, login, signup, forgot password, admin fallback
  - `guest/` - landing, search, blog, eCourts, support, booking
  - `client/` - client dashboard, bookings, cases, payments, find
    professional
  - `professional/` - professional dashboard, bookings, cases, wallet,
    subscriptions, firm management
  - `shared/` - profile, booking detail, case detail, notifications,
    and shared dashboard pieces
- `services/`
  - Thin API wrappers for each backend domain
- `theme/`
  - Color palette, spacing, radii, typography tokens
- `utils/`
  - AsyncStorage wrapper, asset preloader, formatters, image helpers

### Important file roles

- `apps/src/navigation/RootNavigator.js`
  - Chooses between splash, auth flow, guest flow, and admin fallback
- `apps/src/contexts/AuthContext.js`
  - Holds the current user, guest mode, token hydration, login/logout
    helpers, and refresh logic
- `apps/src/services/api.js`
  - Shared fetch wrapper with bearer auth, 401 refresh, and response
    unwrapping
- `apps/src/utils/storage.js`
  - Namespaced AsyncStorage key helpers

## 3. Key Dependencies

### Runtime dependencies

- `expo`
  - Managed runtime for the mobile app
- `react`
  - Component model and hooks
- `react-native`
  - Native UI runtime
- `@react-navigation/native`
  - Navigation container and core navigation primitives
- `@react-navigation/native-stack`
  - Native-style stack navigators
- `@react-navigation/bottom-tabs`
  - Tab navigation
- `@react-native-async-storage/async-storage`
  - Persisted session, guest flag, and post-auth intent state
- `expo-splash-screen`
  - Keeps the native splash visible until the app is ready
- `expo-status-bar`
  - Consistent status bar styling
- `expo-linear-gradient`
  - Brand gradients across onboarding, dashboard, and cards
- `expo-image-picker`
  - Profile photos and document uploads
- `react-native-safe-area-context`
  - Safe area and keyboard-safe layouts
- `react-native-screens`
  - Navigation performance support
- `react-native-svg`
  - Vector illustrations and icon-like artwork
- `react-native-webview`
  - Razorpay checkout and embedded web experiences
- `@expo/vector-icons`
  - Feather and MaterialCommunityIcons icon set

### Development dependencies

- `@babel/core`
  - Babel build support
- `babel-preset-expo`
  - Expo-specific Babel preset

### Why these libraries matter

The app is intentionally light on global state libraries. Most shared
behavior is handled through:

- React Context for auth/session state
- Local component state for screen-specific flows
- A shared API wrapper instead of per-screen fetch logic

That keeps the architecture simple, but it also means the app depends
heavily on the backend API contract being stable.

## 4. App Architecture

### Navigation

The navigation flow is:

1. `index.js` registers `App`
2. `App.js` mounts `SafeAreaProvider`, `AuthProvider`, and
   `RootNavigator`
3. `RootNavigator` shows a branded splash until:
   - auth hydration finishes
   - assets are ready
   - the minimum splash duration elapses
4. After splash:
   - authenticated non-admin users enter the main tab experience
   - guests stay in the landing + auth flow
   - platform admins see a web-only fallback screen

The mobile UI uses a role-aware tab structure:

- Guest landing tabs: Home, Search, Talk to Firmo, Support, Account
- Account content switches by role
- Client and professional dashboards each expose their own role-specific
  feature stack

Notable navigation behavior:

- Guests can skip onboarding and persist that choice
- Post-auth deep links are stored in AsyncStorage and replayed after
  login
- Several screens use nested stack navigation to preserve state across
  tabs and detail screens

### State management

There is no Redux, MobX, or Zustand layer in the mobile app.

Current state patterns:

- `AuthContext` stores the current user, guest mode, loading state, and
  login/logout helpers
- Screen-local `useState` / `useEffect` manage form state, timers,
  loading states, and API results
- The session token, refresh token, guest flag, user snapshot, and
  post-auth intent are persisted in AsyncStorage

### API handling

The mobile app talks to the backend through a shared fetch wrapper in
`src/services/api.js`.

Behavior:

- Adds `Authorization: Bearer <accessToken>` when a token is present
- Unwraps the backend's `{ success, message, data }` response envelope
- Refreshes access tokens transparently on 401s using the stored refresh
  token
- Triggers a global unauthorized handler for `/api/auth/me` and
  `/api/auth/refresh`

The app uses domain-specific service modules, including:

- `authService`
- `bookingService`
- `caseService`
- `paymentService`
- `subscriptionService`
- `professionalService`
- `profileService`
- `supportService`
- `notificationService`
- `appSettingsService`

### Storage

`src/utils/storage.js` wraps AsyncStorage with a `profirmo:` key prefix.

Stored keys include:

- `access_token`
- `refresh_token`
- `user`
- `guest`
- `post_auth_intent`

### Authentication

Authentication is centered on `AuthContext`:

- Hydrates cached user and guest state on launch
- Revalidates the session through `/api/auth/me`
- Stores access and refresh tokens after login/signup
- Supports email/password and phone-OTP login
- Supports guest mode via the skip flow
- Supports logout and token cleanup

The app also contains a phone-change OTP flow in the profile screen.

### Booking and payment flow

Observed payment patterns:

- Booking payments use a Razorpay checkout modal inside a WebView
- The backend creates and verifies payment orders
- Subscription upgrades use a backend call plus a browser-based
  handoff, rather than the native Razorpay SDK

### UI architecture

The UI is heavily componentized:

- Shared layout primitives live under `components/common`
- Feature-specific building blocks live under `components/auth`,
  `components/guest`, `components/booking`, and `components/firm`
- Screens are mostly thin orchestration layers that compose reusable
  UI and service calls

## 5. How to Run the Project

### Required setup

1. Install Node.js and npm
2. Start the backend service first, because the mobile app depends on
   the Profirmo API
3. Ensure the app can reach the API host from your device or simulator

### Install commands

From the repo root:

```bash
cd apps
npm install
```

### Start the app

```bash
npm start
```

This runs `expo start`.

### Android run command

```bash
npm run android
```

This runs `expo start --android`.

### iOS run command

```bash
npm run ios
```

This runs `expo start --ios`.

Notes:

- iOS requires macOS and an available simulator or device workflow
- Because the app is Expo-managed, the commands above are the primary
  entrypoint rather than `react-native run-android` / `run-ios`

## 6. Environment Configuration

### Found configuration

The mobile app does not contain an `apps/.env` file in the repository.

API configuration is resolved in this order:

1. `EXPO_PUBLIC_API_URL`
2. `app.json -> expo.extra.apiBaseUrl`
3. hardcoded fallback `https://profirmo.onrender.com`

The current `app.json` value points to:

- `https://profirmo.onrender.com`

### Required variables

The only explicit environment override found in the mobile app is:

- `EXPO_PUBLIC_API_URL`

Use this when pointing the app at a local or staging backend, for
example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.42:5001 npm start
```

### Missing or implicit configuration

No other mobile-only environment variables were found in `apps/`.

If the backend requires additional runtime configuration, it is not
declared in the mobile app tree and would need to be documented
separately.

## 7. Build and Release Notes

### Build-related files found

- `apps/app.json`
  - Expo app metadata
  - app icon and splash config
  - Android package name
  - iOS bundle identifier
  - URL scheme
  - `newArchEnabled`
- `apps/babel.config.js`
  - Expo Babel preset
- `apps/package.json`
  - Expo start scripts

### Native configuration

Observed identifiers:

- Android package: `com.profirmo.app`
- iOS bundle identifier: `com.profirmo.app`
- App scheme: `profirmo`

### Signing and release notes

No Android keystore, iOS entitlements, provisioning profile, or
certificate files were found under `apps/`.

That suggests signing is either handled outside the repo or will be set
up later through Expo/EAS tooling.

## 8. Developer Notes

### Important observations

- `RootNavigator` is the real app gatekeeper. It owns splash timing,
  auth gating, and the admin fallback.
- `AuthContext` is the only shared session source of truth.
- `src/services/api.js` centralizes token attachment and refresh logic,
  which is the main reason the app can stay relatively stateless.
- The mobile app shares a lot of naming and API shape with the web
  frontend and backend, so many screens are thin wrappers over backend
  endpoints.
- The UI is intentionally branded with gradients, dark hero surfaces,
  and a custom tab bar instead of default platform styling.

### Possible issues

- `apps/src/navigation/ClientTabs.js` and
  `apps/src/navigation/ProfessionalTabs.js` exist, but the active root
  flow appears to route through `GuestTabs.js` for guest, client, and
  professional states. These files may be legacy, unused, or reserved
  for a future refactor.
- `apps/src/navigation/GuestTabs.js` is the main tab navigator despite
  the filename. That naming can be misleading for new contributors.
- The app depends on the backend API contract for auth, refresh, and
  role handling. If backend response shapes change, many screens will
  need updates.
- There is no `.env` file in the mobile app tree, so local backend
  targeting relies on Expo env vars or `app.json`.

### Areas that need clarification or improvement

- Confirm whether `ClientTabs.js` and `ProfessionalTabs.js` are still
  intended to be used
- Consider renaming `GuestTabs.js` to something like `MainTabs.js`
  because it now serves all roles
- Add a dedicated mobile environment example file if more config values
  are introduced later
- Document the backend API contract separately if this mobile app is
  expected to be maintained independently

