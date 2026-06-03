// RazorpayCheckoutModal — full-screen Modal containing a WebView that
// loads Razorpay Standard Checkout. The page boots the official
// checkout.razorpay.com script with the order returned by our backend,
// then forwards Razorpay's `handler` / `payment.failed` / `ondismiss`
// callbacks to React Native via `window.ReactNativeWebView.postMessage`.
//
// Why WebView and not the native SDK?
//   - Works in Expo Go without a custom dev build.
//   - Same code path for iOS and Android.
//   - Production-grade: this is Razorpay's documented "Razorpay Web
//     Standard Checkout in a WebView" pattern.
//
// Inputs:
//   visible   — whether the modal is mounted
//   order     — { id, amount, currency } from /api/payments/orders
//   keyId     — Razorpay public key from /api/payments/orders
//   prefill   — { name, email, contact } for the form
//   notes     — short description shown in checkout
//   onSuccess — fires with { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//   onCancel  — fires when the user dismisses the modal without paying
//   onError   — fires with { code?, description? } when payment.failed terminates

import { useMemo, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

function safeJsonString(value) {
  return JSON.stringify(value || {}).replace(/</g, '\\u003c');
}

function buildHtml({ order, keyId, prefill, notes, professionalName }) {
  const description = (notes || `Consultation with ${professionalName || 'Profirmo professional'}`)
    .slice(0, 120);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Profirmo · Secure payment</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0f172a;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .wrap {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 20px;
    gap: 16px;
  }
  .brand { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: 0.4px; }
  .amber { color: #f59e0b; }
  .muted { font-size: 13px; color: #94a3b8; line-height: 1.5; max-width: 320px; }
  .spinner {
    width: 38px; height: 38px;
    border-radius: 50%;
    border: 3px solid rgba(245,158,11,0.18);
    border-top-color: #f59e0b;
    animation: spin 0.9s linear infinite;
  }
  .err {
    margin-top: 12px;
    color: #fda4af;
    font-size: 13px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">Pro<span class="amber">firmo</span></div>
  <div class="spinner" id="spinner"></div>
  <div class="muted">Opening Razorpay secure checkout…</div>
  <div class="err" id="err"></div>
</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  (function () {
    var ORDER = ${safeJsonString(order)};
    var KEY_ID = ${safeJsonString(keyId)};
    var PREFILL = ${safeJsonString(prefill)};
    var DESCRIPTION = ${safeJsonString(description)};

    function post(payload) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      } catch (e) {
        /* webview is gone */
      }
    }

    function showErr(msg) {
      var el = document.getElementById('err');
      if (el) el.textContent = msg || '';
    }

    function open() {
      if (!window.Razorpay) {
        showErr('Could not load Razorpay. Check your internet and try again.');
        post({ type: 'error', code: 'sdk_unavailable', description: 'Razorpay SDK failed to load.' });
        return;
      }
      var lastFailure = null;
      var settled = false;
      function settle(payload) {
        if (settled) return;
        settled = true;
        post(payload);
      }

      var options = {
        key: KEY_ID,
        amount: ORDER && ORDER.amount,
        currency: (ORDER && ORDER.currency) || 'INR',
        order_id: ORDER && ORDER.id,
        name: 'Profirmo',
        description: DESCRIPTION,
        prefill: {
          name: PREFILL.name || '',
          email: PREFILL.email || '',
          contact: PREFILL.contact || ''
        },
        theme: { color: '#d97706' },
        handler: function (response) {
          settle({ type: 'success', response: response });
        },
        modal: {
          ondismiss: function () {
            if (lastFailure) {
              settle({ type: 'error', code: lastFailure.code || 'failed', description: lastFailure.description || lastFailure.reason || 'Payment failed. Please try again.' });
            } else {
              settle({ type: 'dismiss' });
            }
          }
        }
      };

      var rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        lastFailure = (resp && resp.error) || lastFailure;
      });
      // Hide our holding spinner once Checkout takes over.
      var sp = document.getElementById('spinner');
      if (sp) sp.style.opacity = '0.5';
      rzp.open();
    }

    // Defer slightly so the page can paint the brand splash first.
    setTimeout(open, 50);
  })();
</script>
</body>
</html>`;
}

export default function RazorpayCheckoutModal({
  visible,
  order,
  keyId,
  prefill,
  notes,
  professionalName,
  onSuccess,
  onCancel,
  onError,
}) {
  const webRef = useRef(null);
  const html = useMemo(
    () => buildHtml({ order, keyId, prefill, notes, professionalName }),
    [order, keyId, prefill, notes, professionalName]
  );

  function handleMessage(event) {
    let data = null;
    try {
      data = JSON.parse(event.nativeEvent.data || '{}');
    } catch {
      return;
    }
    if (!data || !data.type) return;
    if (data.type === 'success') {
      const r = data.response || {};
      onSuccess?.({
        razorpay_order_id: r.razorpay_order_id,
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_signature: r.razorpay_signature,
      });
    } else if (data.type === 'dismiss') {
      onCancel?.();
    } else if (data.type === 'error') {
      onError?.({ code: data.code, description: data.description });
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => onCancel?.()}
      presentationStyle="fullScreen"
    >
      <View style={styles.root}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => onCancel?.()}
            hitSlop={10}
            style={styles.barBtn}
          >
            <Feather name="x" size={20} color={colors.textInverse} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.barTitle}>Secure payment</Text>
            <Text style={styles.barSub}>Powered by Razorpay</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {order && keyId ? (
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://checkout.razorpay.com/' }}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            onMessage={handleMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            style={{ flex: 1, backgroundColor: '#0f172a' }}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  bar: {
    paddingTop: 48,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  barBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  barTitle: {
    color: colors.textInverse,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  barSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
