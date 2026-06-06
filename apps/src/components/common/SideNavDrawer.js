// SideNavDrawer — full-height slide-in side panel used by the
// Dashboard screen. The list of items is role-aware (client vs
// professional). Selecting an item closes the drawer and asks the
// parent to navigate (caller wires the actual navigation so the
// drawer stays decoupled from any particular navigator shape).

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { computeInitials } from '../guest/ProfessionalHorizontalCard';
import { imageUrl } from '../../utils/imageUrl';
import { displayName } from '../../utils/formatters';
import { getMySubscription } from '../../services/subscriptionService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.84));

// Per-role menu definitions. Each entry surfaces:
//   key   — stable id used by the parent to dispatch
//   icon  — Feather glyph
//   label — visible text
//   tone  — pill colour (amber for primary, neutral otherwise)
const CLIENT_ITEMS = [
  { key: 'profile', icon: 'user', label: 'My profile', tone: 'amber' },
  { key: 'bookings', icon: 'calendar', label: 'My bookings', tone: 'amber' },
  { key: 'cases', icon: 'folder', label: 'My cases' },
  { key: 'payments', icon: 'credit-card', label: 'Payments' },
  { key: 'notifications', icon: 'bell', label: 'Notifications' },
];

const PROFESSIONAL_ITEMS = [
  { key: 'profile', icon: 'user', label: 'My profile', tone: 'amber' },
  { key: 'bookings', icon: 'calendar', label: 'Bookings', tone: 'amber' },
  { key: 'cases', icon: 'folder', label: 'Cases' },
  { key: 'payments', icon: 'credit-card', label: 'Payments' },
  { key: 'wallet', icon: 'pocket', label: 'Wallet' },
  { key: 'subscription', icon: 'award', label: 'Subscription' },
  { key: 'firm', icon: 'briefcase', label: 'Manage firm' },
  { key: 'notifications', icon: 'bell', label: 'Notifications' },
];

export default function SideNavDrawer({
  visible,
  onClose,
  user,
  role, // 'client' | 'professional'
  onSelect, // (key) => void
  onSignOut,
}) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  // Track image-load failures so a stale/404 profilePhoto URL falls
  // through to the initials placeholder instead of rendering empty.
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    if (visible) setPhotoFailed(false);
  }, [visible]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: visible ? 0 : -PANEL_WIDTH,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slide, fade]);

  const items =
    role === 'professional' ? PROFESSIONAL_ITEMS : CLIENT_ITEMS;
  // Same initials logic as the bottom-bar avatar: name → email local
  // part → "?", so we always render readable letters.
  const nameForInitials =
    displayName(user) ||
    (user && user.email ? String(user.email).split('@')[0] : '');
  const initials = computeInitials(nameForInitials);
  const photoUrl = imageUrl(user && user.profilePhoto);
  // If the API gives us a URL but it 404s, treat it as "no photo" and
  // show initials. `photoFailed` is reset every time the drawer opens.
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  // Active subscription — pros see their plan name, clients see a
  // simple "Client" / "Free" surfacing. Fetched lazily the first time
  // the drawer opens so we don't make a network call on cold start.
  const [plan, setPlan] = useState(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  useEffect(() => {
    if (!visible || planLoaded) return;
    if (role !== 'professional') {
      setPlan({ name: 'Free', status: 'active' });
      setPlanLoaded(true);
      return;
    }
    let active = true;
    getMySubscription()
      .then((sub) => {
        if (!active) return;
        if (sub && sub.plan && sub.plan.name) {
          setPlan({
            name: sub.plan.name,
            status: sub.paymentStatus || sub.status || 'active',
          });
        } else {
          setPlan({ name: 'Free', status: 'active' });
        }
      })
      .catch(() => {
        if (active) setPlan({ name: 'Free', status: 'active' });
      })
      .finally(() => {
        if (active) setPlanLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [visible, planLoaded, role]);

  function handleSelect(key) {
    onClose?.();
    // Small delay so the close animation gets a chance to start before
    // the navigation transition kicks in.
    setTimeout(() => onSelect?.(key), 60);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            { transform: [{ translateX: slide }] },
          ]}
        >
          <View style={{ flex: 1 }}>
            {/* Header — gradient strip with avatar + name. Renders
                UNDER the status bar (paddingTop adds insets.top so
                the avatar row sits below it) so the safe-area area
                shows the dark gradient, never the white panel bg. */}
            <LinearGradient
              colors={['#0b1220', '#1e293b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.header, { paddingTop: insets.top + spacing['2xl'] }]}
            >
              <View style={styles.headerRow}>
                {/* Initials live at the BASE layer — always rendered.
                    A successful Image overlays them; if the image is
                    missing, slow, errors, or never fires onError, the
                    "VS"-style initials are still visible. */}
                <View style={styles.avatarWrap}>
                  <LinearGradient
                    colors={['#fde68a', '#f59e0b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.avatarInitials}>{initials}</Text>
                  {showPhoto ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={StyleSheet.absoluteFillObject}
                      onError={() => setPhotoFailed(true)}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName(user) || 'Welcome'}
                  </Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {(user && user.email) || ''}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={styles.closeBtn}
                >
                  <Feather name="x" size={18} color={colors.textInverse} />
                </Pressable>
              </View>
              <View style={styles.roleChipRow}>
                <View style={styles.roleChip}>
                  <Feather
                    name={role === 'professional' ? 'briefcase' : 'user'}
                    size={11}
                    color={colors.primary}
                  />
                  <Text style={styles.roleChipText}>
                    {role === 'professional' ? 'Professional' : 'Client'}
                  </Text>
                </View>
                {plan ? (
                  <View style={styles.planChip}>
                    <Feather
                      name="award"
                      size={11}
                      color="rgba(255,255,255,0.92)"
                    />
                    <Text style={styles.planChipText} numberOfLines={1}>
                      {plan.name}
                    </Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.list}
            >
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => handleSelect(item.key)}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <View
                    style={[
                      styles.itemIcon,
                      item.tone === 'amber' && {
                        backgroundColor: colors.primarySoft,
                      },
                    ]}
                  >
                    <Feather
                      name={item.icon}
                      size={16}
                      color={
                        item.tone === 'amber'
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                  </View>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={colors.textMuted}
                  />
                </Pressable>
              ))}
            </ScrollView>

            <SafeAreaView edges={['bottom']}>
              <View style={styles.footer}>
                <Pressable
                  onPress={() => {
                    onClose?.();
                    setTimeout(() => onSignOut?.(), 60);
                  }}
                  style={({ pressed }) => [
                    styles.signOut,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="log-out" size={15} color={colors.danger} />
                  <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowOffset: { width: 4, height: 0 },
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    paddingHorizontal: spacing.lg,
    // paddingTop is set inline = insets.top + spacing['2xl'] so the
    // gradient paints under the status bar with extra top breathing
    // room for a taller, more prominent banner.
    paddingBottom: spacing['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  // Wrapper for the layered avatar (initials behind, optional photo
  // on top). `overflow:'hidden'` clips the image to the rounded
  // circle even though it's absolutely positioned.
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  email: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  roleChipRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    maxWidth: 160,
  },
  planChipText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  list: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  itemLabel: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    backgroundColor: 'rgba(220,38,38,0.06)',
  },
  signOutText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },
});
