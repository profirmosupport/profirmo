// TalkToFirmoScreen — full-screen AI consultant entry.
//
// Guest / unauthenticated → branded sign-in landing. We persist a
// post-auth intent so the user comes back to this screen automatically
// once they finish authentication (see GuestHomeScreen's replay
// effect).
//
// Authenticated → ElevenLabs Convai widget rendered inside a WebView.
// The widget script is dropped into a minimal HTML page on our side
// so we can fully control the surrounding chrome (gradient backdrop,
// status pills, safe-area handling) — the screen reads as a Profirmo
// surface, not a raw embed.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../contexts/AuthContext';
import { setItem, STORAGE_KEYS } from '../../utils/storage';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const ELEVENLABS_AGENT_ID = 'agent_8401kshm0a9zfngb6jfbx0afser9';

// Build the minimal HTML page that hosts the ElevenLabs widget. The
// dark gradient mirrors the rest of the brand and gives the voice
// orb a clear surface. CSS keeps the embed centred and free of any
// scroll/overflow at any device size. The widget script is loaded
// with `async`, so we surface a loading state via `<noscript>` and
// a CSS spinner that fades out as soon as the custom element
// upgrades.
function buildWidgetHtml(agentId) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover" />
  <title>Talk to Firmo</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      height: 100%; width: 100%;
      overflow: hidden;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
    }

    /* Soft cream-to-amber wash so the white isn't clinical. */
    .bg-wash {
      position: fixed; inset: 0; z-index: 0;
      background:
        radial-gradient(60% 50% at 18% 12%, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0) 60%),
        radial-gradient(55% 45% at 82% 88%, rgba(217,119,6,0.08) 0%, rgba(217,119,6,0) 60%),
        linear-gradient(180deg, #ffffff 0%, #fffdf6 100%);
    }

    /* Decorative infographic layer — legal / tax SVG glyphs scattered
       around the edges at low opacity. Sits behind the widget. */
    .deco {
      position: fixed; inset: 0; z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .deco svg {
      position: absolute;
      opacity: 0.10;
      color: #b45309;
    }
    .deco .g1 { top: 6%;  left: 4%;  width: 88px;  transform: rotate(-12deg); }
    .deco .g2 { top: 14%; right: 6%; width: 72px;  transform: rotate(10deg); }
    .deco .g3 { bottom: 22%; left: 8%; width: 76px; transform: rotate(8deg);  opacity: 0.08; }
    .deco .g4 { bottom: 8%;  right: 10%; width: 92px; transform: rotate(-6deg); opacity: 0.09; color: #92400e; }
    .deco .g5 { top: 42%; left: -3%; width: 60px; transform: rotate(20deg); opacity: 0.07; }
    .deco .g6 { top: 38%; right: -2%; width: 64px; transform: rotate(-18deg); opacity: 0.07; color: #92400e; }

    /* Full-bleed widget container with a 4% safe gap at the bottom
       so the floating orb / hang-up control isn't flush to the
       phone's home indicator. */
    .stage {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 4%;
      z-index: 1;
      display: flex; align-items: stretch; justify-content: stretch;
    }
    elevenlabs-convai,
    elevenlabs-convai > * {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      display: flex !important;
      flex: 1 1 auto !important;
      position: relative !important;
      inset: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
    }
  </style>
</head>
<body>
  <div class="bg-wash"></div>
  <div class="deco" aria-hidden="true">
    <!-- g1: scales of justice -->
    <svg class="g1" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 8v48"/>
      <path d="M16 56h32"/>
      <path d="M14 22h36"/>
      <path d="M14 22 6 38h16z"/>
      <path d="M50 22l8 16h-16z"/>
      <circle cx="32" cy="10" r="2"/>
    </svg>
    <!-- g2: gavel -->
    <svg class="g2" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="50" width="44" height="6" rx="1"/>
      <path d="M30 14l20 20"/>
      <rect x="22" y="6" width="20" height="14" rx="2" transform="rotate(45 32 13)"/>
    </svg>
    <!-- g3: contract / document with signature -->
    <svg class="g3" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 6h28l10 10v42H14z"/>
      <path d="M42 6v10h10"/>
      <path d="M20 26h24M20 34h24M20 42h16"/>
      <path d="M22 50c6-4 10 4 16 0"/>
    </svg>
    <!-- g4: calculator (tax) -->
    <svg class="g4" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="12" y="6" width="40" height="52" rx="4"/>
      <rect x="18" y="12" width="28" height="10" rx="2"/>
      <circle cx="22" cy="32" r="2"/>
      <circle cx="32" cy="32" r="2"/>
      <circle cx="42" cy="32" r="2"/>
      <circle cx="22" cy="42" r="2"/>
      <circle cx="32" cy="42" r="2"/>
      <circle cx="42" cy="42" r="2"/>
      <circle cx="22" cy="52" r="2"/>
      <circle cx="32" cy="52" r="2"/>
      <circle cx="42" cy="52" r="2"/>
    </svg>
    <!-- g5: book / law book -->
    <svg class="g5" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 12c8-4 14-4 22 0v40c-8-4-14-4-22 0z"/>
      <path d="M32 12c8-4 14-4 22 0v40c-8-4-14-4-22 0z"/>
      <path d="M32 12v40"/>
    </svg>
    <!-- g6: briefcase -->
    <svg class="g6" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="18" width="52" height="38" rx="3"/>
      <path d="M22 18v-6h20v6"/>
      <path d="M6 34h52"/>
      <circle cx="32" cy="34" r="2"/>
    </svg>
  </div>

  <div class="stage">
    <elevenlabs-convai agent-id="${agentId}"></elevenlabs-convai>
  </div>
  <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
</body>
</html>`;
}

export default function TalkToFirmoScreen({ navigation }) {
  const { user, isGuest, exitGuest } = useAuth();
  const isAuthed = !isGuest && !!user;

  // No back stack inside this tab — "back" returns the user to the
  // Home tab on the parent bottom-tab navigator.
  function handleBack() {
    const tabs = navigation.getParent?.()?.getParent?.();
    if (tabs?.navigate) tabs.navigate('GuestHome');
    else navigation.goBack?.();
  }

  if (!isAuthed) {
    return <SignedOutLanding onSignIn={exitGuest} onBack={handleBack} />;
  }
  return <SignedInWidget onBack={handleBack} />;
}

// Floating back chip — pinned to the top-left of the SafeArea.
// Reused by both states so the back affordance sits in a consistent
// spot whether the user is signed in or not.
function BackChip({ onBack }) {
  return (
    <Pressable
      onPress={onBack}
      hitSlop={10}
      style={({ pressed }) => [
        styles.backChip,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Feather name="arrow-left" size={16} color={colors.textInverse} />
      <Text style={styles.backChipText}>Back</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Signed-out landing
// ---------------------------------------------------------------------

function SignedOutLanding({ onSignIn, onBack }) {
  async function handleSignIn() {
    // Persist intent so GuestHomeScreen replays us back here once the
    // user finishes auth.
    try {
      await setItem(STORAGE_KEYS.postAuthIntent, {
        screen: 'TalkToFirmo',
        ts: Date.now(),
      });
    } catch {}
    onSignIn?.();
  }
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0b1220', '#0f172a', '#1e293b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.lockedWrap} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <BackChip onBack={onBack} />
        </View>
        <View style={styles.lockedIcon}>
          <Feather name="mic" size={30} color="#fbbf24" />
        </View>
        <Text style={styles.lockedTitle}>Talk to Firmo</Text>
        <Text style={styles.lockedBody}>
          Voice-first AI consultant for Indian tax, GST, compliance, and
          legal procedure. Sign in to start the conversation —
          we&apos;ll keep your chat history under your account.
        </Text>

        <View style={styles.featureList}>
          <FeatureRow
            icon="message-circle"
            label="Plain-English answers"
            sub="Ask anything, get a clear walk-through"
          />
          <FeatureRow
            icon="users"
            label="Hand-off to verified pros"
            sub="When you need a real lawyer or CA, we route you"
          />
          <FeatureRow
            icon="lock"
            label="Private to your account"
            sub="Conversations stay tied to your profile"
          />
        </View>

        <Pressable
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.signInBtn,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.signInFill}
          >
            <Feather name="log-in" size={16} color={colors.textInverse} />
            <Text style={styles.signInText}>Sign In — Free</Text>
          </LinearGradient>
        </Pressable>
        <Text style={styles.lockedFootnote}>
          We&apos;ll bring you right back to this screen after sign in.
        </Text>
      </SafeAreaView>
    </View>
  );
}

function FeatureRow({ icon, label, sub }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Feather name={icon} size={14} color="#fbbf24" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={styles.featureSub}>{sub}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
// Signed-in widget
// ---------------------------------------------------------------------

function SignedInWidget({ onBack }) {
  const html = buildWidgetHtml(ELEVENLABS_AGENT_ID);
  return (
    <View style={styles.rootLight}>
      {/* Top safe-area inset paints dark navy so the status bar
          area blends into the header instead of cutting a white
          band above it. The lower SafeAreaView keeps the widget
          surface (white) edge-to-edge. */}
      <SafeAreaView
        edges={['top']}
        style={styles.safeTopDark}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        {/* Slim dark header — back arrow on the left, "Live" pill on
            the right, title perfectly centered. Equal-width side
            slots keep the title centered regardless of pill width. */}
        <View style={styles.headerDark}>
          <View style={styles.headerSide}>
            <Pressable
              onPress={onBack}
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerBackDark,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather
                name="arrow-left"
                size={16}
                color={colors.textInverse}
              />
            </Pressable>
          </View>
          <Text style={styles.headerTitleDark} numberOfLines={1}>
            Talk to Firmo
          </Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <View style={styles.brandPillDark}>
              <View style={styles.brandPillDot} />
              <Text style={styles.brandPillTextDark}>Live</Text>
            </View>
          </View>
        </View>

        <View style={styles.webHost}>
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://elevenlabs.io' }}
            style={styles.web}
            containerStyle={styles.web}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            scalesPageToFit={false}
            scrollEnabled={false}
            allowsFullscreenVideo
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },

  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.lg,
  },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  backChipText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
  brandBack: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Signed-out
  lockedWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  lockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    marginTop: spacing.md,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  lockedBody: {
    marginTop: 8,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },
  featureList: {
    marginTop: spacing.xl,
    width: '100%',
    maxWidth: 360,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  featureSub: {
    marginTop: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 15,
  },
  signInBtn: {
    marginTop: 'auto',
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  signInFill: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signInText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
  lockedFootnote: {
    marginTop: 10,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  // Signed-in widget
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brandTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.1,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  brandPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  brandPillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#047857',
    letterSpacing: 0.4,
  },

  // White widget surface (legal/tax infographic wash lives in the
  // WebView HTML). The chrome header sits on top with a dark theme.
  rootLight: { flex: 1, backgroundColor: '#fffdf6' },
  safeTopDark: { backgroundColor: '#0f172a' },

  // Dark header strip with centered title. Equal-width left + right
  // side slots so the title stays optically centered regardless of
  // the back button vs. Live-pill widths.
  headerDark: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#0f172a',
  },
  headerSide: {
    width: 76,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSideRight: { alignItems: 'flex-end' },
  headerBackDark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleDark: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  brandPillDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
  },
  brandPillTextDark: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#a7f3d0',
    letterSpacing: 0.4,
  },

  webHost: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  web: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
