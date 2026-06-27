// FirmDashboardScreen — mobile mirror of /dashboard/firm on the web.
// Tabbed view across the firm's data:
//
//   Overview        — headline stats (members / clients / cases / reviews).
//   Professionals   — list of firm members + role badges.
//   Join Requests   — pending requests with Approve / Reject CTAs.
//   Clients         — clients across firm cases.
//   Leads           — captured inquiries for firm-owned professionals.
//   Cases           — every case any firm member is on.
//   Reviews         — published reviews for the firm.
//   Firm Profile    — read + edit firm profile (name / contact / etc).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { imageUrl } from '../../utils/imageUrl';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import PhotoUpload from '../../components/auth/PhotoUpload';
import {
  getMyFirm,
  listFirmMembers,
  listFirmClients,
  listFirmCases,
  listFirmReviewsForOwner,
  listMyFirmLeads,
} from '../../services/firmService';
import firmJoinService from '../../services/firmJoinService';
import { apiPut, unwrap } from '../../services/api';
import { displayName, formatDate } from '../../utils/formatters';
import CasesFilterBar from '../../components/cases/CasesFilterBar';
import {
  STAGE_LABEL,
  applyCaseFilters,
  emptyCaseFilter,
  isCaseFilterActive,
} from '../../utils/caseFilters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

// Derive 1–2-letter initials from a firm name. "Chauhan Associates"
// → "CA"; "Acme" → "A". Falls back to "F" so the badge is never
// empty, matching the avatar pattern used elsewhere in the app.
function firmInitials(name) {
  const s = String(name || '').trim();
  if (!s) return 'F';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'professionals', label: 'Professionals', icon: 'users' },
  { key: 'requests', label: 'Join Requests', icon: 'user-plus' },
  { key: 'clients', label: 'Clients', icon: 'user-check' },
  { key: 'leads', label: 'Leads', icon: 'inbox' },
  { key: 'cases', label: 'Cases', icon: 'briefcase' },
  { key: 'reviews', label: 'Reviews', icon: 'star' },
  { key: 'profile', label: 'Firm Profile', icon: 'edit-3' },
];

export default function FirmDashboardScreen({ navigation }) {
  const [firm, setFirm] = useState(null);
  const [loading, setLoading] = useState(true);
  // `tab` controls which section is shown in the main area. The
  // right-hand drawer is the only way to switch between sections —
  // there's no longer a tab strip inline in the page.
  const [tab, setTab] = useState('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Per-tab data + loading flags.
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [cases, setCases] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');
  const [actionBusyId, setActionBusyId] = useState('');

  const loadFirm = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyFirm().catch(() => null);
      // /api/law-firm/mine returns { lawFirm, members, myRole, approval }.
      // Fall back to legacy shape (data.firm or data itself) just in
      // case the endpoint shape ever changes.
      const firmRow = data && (data.lawFirm || data.firm || data);
      setFirm(firmRow && firmRow.id ? firmRow : null);
      // Members come back on the same call — seed them so the
      // Overview + Professionals tabs render without a second fetch.
      if (data && Array.isArray(data.members)) {
        setMembers(data.members);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirm();
  }, [loadFirm]);

  // Inject a hamburger icon into the screen's nav header (right side)
  // + set the header title to match the active section so every
  // internal screen has its own title rather than the generic "Firm
  // Dashboard". Overview keeps the generic title since the hero card
  // below it already names the firm.
  useEffect(() => {
    if (!navigation || !navigation.setOptions) return;
    const activeTab = TABS.find((t) => t.key === tab) || TABS[0];
    const title = tab === 'overview' ? 'Firm Dashboard' : activeTab.label;
    navigation.setOptions({
      title,
      headerRight: () => (
        <Pressable
          onPress={() => setDrawerOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open firm sections"
          style={({ pressed }) => [
            styles.headerMenuBtn,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="menu" size={18} color={colors.textInverse} />
        </Pressable>
      ),
    });
  }, [navigation, tab]);

  const firmId = firm && firm.id;

  const loadTab = useCallback(
    async (key) => {
      if (!firmId) return;
      setTabError('');
      setTabLoading(true);
      try {
        if (key === 'overview' || key === 'professionals') {
          const m = await listFirmMembers().catch(() => []);
          setMembers(Array.isArray(m) ? m : []);
        }
        if (key === 'overview' || key === 'cases') {
          const c = await listFirmCases().catch(() => []);
          setCases(Array.isArray(c) ? c : []);
        }
        if (key === 'overview' || key === 'reviews') {
          const r = await listFirmReviewsForOwner().catch(() => []);
          setReviews(Array.isArray(r) ? r : []);
        }
        if (key === 'overview' || key === 'clients') {
          const c = await listFirmClients().catch(() => []);
          setClients(Array.isArray(c) ? c : []);
        }
        if (key === 'requests') {
          const rq = await firmJoinService
            .listFirmRequests()
            .catch(() => null);
          setRequests(
            rq && Array.isArray(rq.requests) ? rq.requests : []
          );
        }
        if (key === 'leads') {
          const l = await listMyFirmLeads().catch(() => []);
          setLeads(Array.isArray(l) ? l : []);
        }
      } catch (err) {
        setTabError(err?.message || 'Failed to load.');
      } finally {
        setTabLoading(false);
      }
    },
    [firmId]
  );

  useEffect(() => {
    if (firmId) loadTab(tab);
  }, [tab, firmId, loadTab]);

  async function decide(reqId, decision) {
    if (actionBusyId) return;
    setActionBusyId(reqId);
    try {
      await firmJoinService.decideRequest(reqId, decision);
      // Drop the row locally so the list updates without a refetch.
      setRequests((prev) => prev.filter((r) => r.id !== reqId));
      // Also reload members if it was an approval.
      if (decision === 'approve') {
        const m = await listFirmMembers().catch(() => members);
        setMembers(Array.isArray(m) ? m : members);
      }
    } catch (err) {
      setTabError(err?.message || `Could not ${decision} request.`);
    } finally {
      setActionBusyId('');
    }
  }

  if (loading) {
    return (
      <ScreenContainer hasNavHeader>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!firm) {
    return (
      <ScreenContainer hasNavHeader>
        <EmptyState
          icon="briefcase"
          title="No firm yet"
          description="Create a firm from the web app, or accept an invitation to join one."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      hasNavHeader
      keyboard
      contentStyle={styles.page}
      refreshing={tabLoading}
      onRefresh={() => loadTab(tab)}
    >
      {/* Firm hero card — only on the Overview tab. Internal sections
          rely on the nav header title (set via navigation.setOptions
          in the effect above) so the body starts directly with the
          section's content. */}
      {tab === 'overview' ? <FirmHeroCard firm={firm} /> : null}

      {tabError ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{tabError}</Text>
        </View>
      ) : null}

      {/* Tab content */}
      {tab === 'overview' ? (
        <OverviewTab
          members={members}
          cases={cases}
          reviews={reviews}
          clients={clients}
        />
      ) : null}
      {tab === 'professionals' ? (
        <ProfessionalsTab members={members} />
      ) : null}
      {tab === 'requests' ? (
        <RequestsTab
          requests={requests}
          actionBusyId={actionBusyId}
          onDecide={decide}
        />
      ) : null}
      {tab === 'clients' ? <ClientsTab clients={clients} /> : null}
      {tab === 'leads' ? <LeadsTab leads={leads} /> : null}
      {tab === 'cases' ? (
        <CasesTab
          cases={cases}
          onOpenCase={(c) =>
            navigation.navigate('CaseDetail', { caseId: c.id })
          }
        />
      ) : null}
      {tab === 'reviews' ? <ReviewsTab reviews={reviews} /> : null}
      {tab === 'profile' ? (
        <FirmProfileTab firm={firm} onSaved={loadFirm} />
      ) : null}

      <FirmSectionDrawer
        visible={drawerOpen}
        active={tab}
        firm={firm}
        onClose={() => setDrawerOpen(false)}
        onSelect={(key) => {
          setTab(key);
          setDrawerOpen(false);
        }}
      />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// FirmHeroCard — gradient ink card at the top of the dashboard.
// Shows the firm logo (or briefcase fallback), name, HQ / city, and
// decorative glow blobs so the card reads as a brand moment, not a
// flat banner.
// ---------------------------------------------------------------------

function FirmHeroCard({ firm }) {
  const logo = imageUrl(firm.logo);
  const initials = firmInitials(firm.firmName || firm.name);
  // Track image-load failure so a 404 / stale logo URL falls through
  // to the initials badge instead of rendering an empty white square.
  const [photoFailed, setPhotoFailed] = useState(false);
  const showInitials = !logo || photoFailed;
  return (
    <LinearGradient
      colors={['#0b1220', '#0f172a', '#1e293b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.firmHero}
    >
      {/* Decorative glow blobs — same recipe as DashboardHero. */}
      <View style={[styles.heroGlow, styles.heroGlowA]} />
      <View style={[styles.heroGlow, styles.heroGlowB]} />

      <View style={styles.firmHeroRow}>
        <View style={styles.firmLogoWrap}>
          {showInitials ? (
            <Text style={styles.firmLogoInitials}>{initials}</Text>
          ) : (
            <Image
              source={{ uri: logo }}
              style={styles.firmLogoImg}
              onError={() => setPhotoFailed(true)}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.firmHeroEyebrow}>Your firm</Text>
          <Text style={styles.firmHeroName} numberOfLines={2}>
            {firm.firmName || firm.name || 'Your firm'}
          </Text>
          {firm.headquarters || firm.city ? (
            <View style={styles.firmHeroLoc}>
              <Feather
                name="map-pin"
                size={12}
                color="rgba(255,255,255,0.78)"
              />
              <Text style={styles.firmHeroLocText} numberOfLines={1}>
                {firm.headquarters || firm.city}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------
// FirmSectionDrawer — right-hand slide-in panel listing the 8 firm
// dashboard sections. Same animation pattern as the main app's left
// SideNavDrawer, but anchored to the right edge of the screen.
// ---------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.84));

function FirmSectionDrawer({ visible, active, firm, onClose, onSelect }) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: visible ? 0 : PANEL_WIDTH,
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

  const logo = firm && imageUrl(firm.logo);
  const initials = firmInitials(firm && (firm.firmName || firm.name));
  // Same image-load-failure fallback as the hero card.
  const [photoFailed, setPhotoFailed] = useState(false);
  // Reset on each open so re-uploading the logo after a failure
  // refreshes the next time the drawer is opened.
  useEffect(() => {
    if (visible) setPhotoFailed(false);
  }, [visible]);
  const showInitials = !logo || photoFailed;

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
      transparent
      statusBarTranslucent
    >
      <Animated.View style={[styles.drawerBackdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawerPanel,
          {
            // Just clear the device's status-bar / notch — no extra
            // gap above. The drawer slides in from the very top of
            // the safe-area instead of leaving dead space.
            top: insets.top,
            width: PANEL_WIDTH,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        {/* Dark gradient header — mirrors the main hero card. Holds
            the firm logo, name and a tagline so the drawer reads as
            a continuation of the dashboard, not a generic menu. */}
        <LinearGradient
          colors={['#0b1220', '#0f172a', '#1e293b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.drawerHead}
        >
          <View style={styles.drawerHeadRow}>
            <View style={styles.drawerLogoWrap}>
              {showInitials ? (
                <Text style={styles.drawerLogoInitials}>{initials}</Text>
              ) : (
                <Image
                  source={{ uri: logo }}
                  style={styles.drawerLogoImg}
                  onError={() => setPhotoFailed(true)}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.drawerEyebrow}>Firm dashboard</Text>
              <Text style={styles.drawerTitle} numberOfLines={1}>
                {(firm && (firm.firmName || firm.name)) || 'Your firm'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={colors.textInverse} />
            </Pressable>
          </View>
          <Text style={styles.drawerSubtitle}>Pick a section to manage</Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.drawerList}>
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <Pressable
                key={t.key}
                onPress={() => onSelect(t.key)}
                style={({ pressed }) => [
                  styles.drawerItem,
                  isActive && styles.drawerItemActive,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <View
                  style={[
                    styles.drawerItemIcon,
                    isActive && styles.drawerItemIconActive,
                  ]}
                >
                  <Feather
                    name={t.icon}
                    size={15}
                    color={isActive ? colors.textInverse : colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.drawerItemText,
                    isActive && styles.drawerItemTextActive,
                  ]}
                >
                  {t.label}
                </Text>
                {isActive ? (
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ---------- Tabs ------------------------------------------------------

function OverviewTab({ members, cases, reviews, clients }) {
  const totalProfessionals = members.length;
  const totalCases = cases.length;
  const activeCases = cases.filter(
    (c) => String(c.status || '').toLowerCase() !== 'closed'
  ).length;
  const uniqueClients =
    clients.length ||
    new Set(cases.map((c) => c.clientId).filter(Boolean)).size;
  const published = reviews.filter(
    (r) => !r.status || r.status === 'PUBLISHED'
  );
  const reviewsCount = published.length;
  const avgRating =
    reviewsCount > 0
      ? published.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) /
        reviewsCount
      : 0;

  const stats = [
    {
      key: 'pros',
      label: 'Professionals',
      value: totalProfessionals,
      icon: 'users',
      bg: '#dbeafe',
      fg: '#1d4ed8',
    },
    {
      key: 'clients',
      label: 'Clients',
      value: uniqueClients,
      icon: 'user-check',
      bg: '#d1fae5',
      fg: '#047857',
    },
    {
      key: 'cases',
      label: 'Cases',
      value: totalCases,
      icon: 'briefcase',
      bg: '#fef3c7',
      fg: '#b45309',
      hint: `${activeCases} active`,
    },
    {
      key: 'closed',
      label: 'Closed cases',
      value: totalCases - activeCases,
      icon: 'check-circle',
      bg: '#e2e8f0',
      fg: '#475569',
    },
    {
      key: 'rating',
      label: 'Avg rating',
      value: reviewsCount > 0 ? avgRating.toFixed(1) : '—',
      icon: 'star',
      bg: '#fef3c7',
      fg: '#b45309',
      hint: `${reviewsCount} review${reviewsCount === 1 ? '' : 's'}`,
    },
  ];

  return (
    <View style={styles.statsGrid}>
      {stats.map((s) => (
        <Card key={s.key} style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
            <Feather name={s.icon} size={16} color={s.fg} />
          </View>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
          {s.hint ? <Text style={styles.statHint}>{s.hint}</Text> : null}
        </Card>
      ))}
    </View>
  );
}

function ProfessionalsTab({ members }) {
  if (!members.length) {
    return (
      <EmptyState
        icon="users"
        title="No professionals yet"
        description="Invite or accept join requests to grow your firm."
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {members.map((m) => (
        <Card key={m.id || m.userId}>
          <View style={styles.rowSplit}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>
                {displayName(m.user || m) || m.name || 'Member'}
              </Text>
              <Text style={styles.muted}>
                {m.email || (m.user && m.user.email)}
              </Text>
            </View>
            {m.role ? <Badge variant="amber">{m.role}</Badge> : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

function RequestsTab({ requests, actionBusyId, onDecide }) {
  if (!requests.length) {
    return (
      <EmptyState
        icon="inbox"
        title="No pending requests"
        description="When professionals request to join, you'll review them here."
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {requests.map((r) => {
        const busy = actionBusyId === r.id;
        return (
          <Card key={r.id}>
            <Text style={styles.itemTitle}>
              {displayName(r.user) || r.userName || r.email || 'Applicant'}
            </Text>
            <Text style={styles.muted}>{r.email || r.user?.email}</Text>
            {r.message ? (
              <Text style={[styles.muted, { marginTop: 6 }]}>
                “{r.message}”
              </Text>
            ) : null}
            {r.createdAt ? (
              <Text style={styles.tiny}>
                Requested {formatDate(r.createdAt)}
              </Text>
            ) : null}
            <View style={styles.requestActions}>
              <Pressable
                onPress={() => !busy && onDecide(r.id, 'reject')}
                disabled={busy}
                style={({ pressed }) => [
                  styles.rejectBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="x" size={13} color={colors.danger} />
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => !busy && onDecide(r.id, 'approve')}
                disabled={busy}
                style={({ pressed }) => [
                  styles.approveBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="check" size={13} color={colors.textInverse} />
                <Text style={styles.approveText}>
                  {busy ? 'Working…' : 'Approve'}
                </Text>
              </Pressable>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

function ClientsTab({ clients }) {
  if (!clients.length) {
    return (
      <EmptyState
        icon="user-check"
        title="No clients yet"
        description="Clients show up once your firm members start handling cases."
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {clients.map((c) => (
        <Card key={c.id || c.userId || c.email}>
          <Text style={styles.itemTitle}>
            {displayName(c) || c.name || c.email || 'Client'}
          </Text>
          {c.email ? <Text style={styles.muted}>{c.email}</Text> : null}
          {c.mobileNumber ? (
            <Text style={styles.muted}>{c.mobileNumber}</Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

function LeadsTab({ leads }) {
  if (!leads.length) {
    return (
      <EmptyState
        icon="inbox"
        title="No leads yet"
        description="Inquiries captured for your firm's professionals will appear here."
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {leads.map((l) => (
        <Card key={l.id}>
          <Text style={styles.itemTitle}>
            {l.name || l.email || 'Lead'}
          </Text>
          {l.email ? <Text style={styles.muted}>{l.email}</Text> : null}
          {l.phone ? <Text style={styles.muted}>{l.phone}</Text> : null}
          {l.message ? (
            <Text style={[styles.muted, { marginTop: 6 }]}>{l.message}</Text>
          ) : null}
          {l.createdAt ? (
            <Text style={styles.tiny}>{formatDate(l.createdAt)}</Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

function CasesTab({ cases, onOpenCase }) {
  const [filter, setFilter] = useState(emptyCaseFilter());
  const visible = useMemo(() => applyCaseFilters(cases, filter), [cases, filter]);
  const filterActive = isCaseFilterActive(filter);

  if (!cases.length) {
    return (
      <EmptyState
        icon="briefcase"
        title="No cases yet"
        description="Cases assigned to firm members will show up here."
      />
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <CasesFilterBar
        value={filter}
        onChange={setFilter}
        totalCount={cases.length}
        matchCount={visible.length}
      />
      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title="No cases match these filters"
          description={
            filterActive
              ? 'Try clearing the filters above or searching for something else.'
              : ''
          }
          action={
            filterActive ? (
              <Pressable
                onPress={() => setFilter(emptyCaseFilter())}
                style={({ pressed }) => [
                  styles.clearFiltersBtn,
                  { opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Feather name="x" size={12} color={colors.primary} />
                <Text style={styles.clearFiltersText}>Clear filters</Text>
              </Pressable>
            ) : null
          }
        />
      ) : (
        visible.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => onOpenCase(c)}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <FirmCaseCard c={c} />
          </Pressable>
        ))
      )}
    </View>
  );
}

function FirmCaseCard({ c }) {
  const assignees = Array.isArray(c.professionalIds)
    ? c.professionalIds.filter(Boolean)
    : [];
  const isFirmCase = assignees.length >= 2;
  const stageLabel = c.stage ? STAGE_LABEL[c.stage] || c.stage : null;
  const priority = c.priority || 'medium';
  const priorityVariant =
    priority === 'urgent' ? 'red' : priority === 'high' ? 'amber' : 'gray';
  return (
    <Card>
      <View style={styles.rowSplit}>
        <View style={{ flex: 1 }}>
          <View style={styles.rowSplit}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {c.title || c.caseNumber || `Case ${c.id}`}
            </Text>
            {isFirmCase ? (
              <View style={styles.firmCaseChip}>
                <Feather name="briefcase" size={9} color="#6d28d9" />
                <Text style={styles.firmCaseChipText}>Firm</Text>
              </View>
            ) : null}
          </View>
          {c.category ? (
            <Text style={styles.muted}>{c.category}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {stageLabel ? (
            <Badge variant="blue">{stageLabel}</Badge>
          ) : (
            <Badge variant="gray">Stage —</Badge>
          )}
          <Badge variant={priorityVariant}>{priority}</Badge>
        </View>
      </View>
      {c.clientName || c.professionalName ? (
        <Text style={[styles.muted, { marginTop: 6 }]} numberOfLines={1}>
          {c.clientName ? `Client: ${c.clientName}` : ''}
          {c.clientName && c.professionalName ? ' · ' : ''}
          {c.professionalName ? `Pro: ${c.professionalName}` : ''}
        </Text>
      ) : null}
      {c.nextHearingDate ? (
        <Text style={styles.tiny}>
          Next hearing {formatDate(c.nextHearingDate)}
        </Text>
      ) : null}
    </Card>
  );
}

function ReviewsTab({ reviews }) {
  if (!reviews.length) {
    return (
      <EmptyState
        icon="star"
        title="No reviews yet"
        description="Reviews about your firm's professionals will appear here."
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {reviews.map((r) => (
        <Card key={r.id}>
          <View style={styles.rowSplit}>
            <Text style={styles.itemTitle}>
              {r.clientName || r.reviewerName || 'Anonymous'}
            </Text>
            <View style={styles.ratingRow}>
              <Feather name="star" size={13} color="#b45309" />
              <Text style={styles.ratingText}>
                {Number(r.rating || 0).toFixed(1)}
              </Text>
            </View>
          </View>
          {r.comment ? (
            <Text style={[styles.muted, { marginTop: 6 }]}>{r.comment}</Text>
          ) : null}
          {r.createdAt ? (
            <Text style={styles.tiny}>{formatDate(r.createdAt)}</Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

function FirmProfileTab({ firm, onSaved }) {
  // Every editable column on the LawFirm row. Identifiers (logo,
  // registrationCertificate, businessLicense) are uploaded via
  // PhotoUpload which returns the stored S3 key — the same shape
  // the backend already stores.
  const [form, setForm] = useState({
    firmName: firm.firmName || firm.name || '',
    registrationNumber: firm.registrationNumber || '',
    logo: firm.logo || '',
    website: firm.website || '',
    establishedYear: firm.establishedYear ? String(firm.establishedYear) : '',
    about: firm.about || firm.description || '',
    headquarters: firm.headquarters || firm.city || '',
    contactEmail: firm.contactEmail || '',
    contactNumber: firm.contactNumber || '',
    totalEmployees: firm.totalEmployees ? String(firm.totalEmployees) : '',
    numberOfProfessionals: firm.numberOfProfessionals
      ? String(firm.numberOfProfessionals)
      : '',
    registrationCertificate: firm.registrationCertificate || '',
    businessLicense: firm.businessLicense || '',
  });
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ text: '', tone: 'info' });

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
    setBanner((b) => (b.text ? { text: '', tone: 'info' } : b));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // Coerce numerics — backend rejects "20" strings on INTEGER cols
      // depending on the dialect.
      const payload = {
        ...form,
        establishedYear: form.establishedYear
          ? Number(form.establishedYear)
          : null,
        totalEmployees: form.totalEmployees ? Number(form.totalEmployees) : null,
        numberOfProfessionals: form.numberOfProfessionals
          ? Number(form.numberOfProfessionals)
          : null,
      };
      // PUT /api/law-firm/mine — same endpoint the web's firm profile
      // edit uses. Backend authorises the owner/co-owner.
      const res = await apiPut('/api/law-firm/mine', payload);
      unwrap(res);
      setBanner({ text: 'Firm profile saved.', tone: 'success' });
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not save firm profile.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {banner.text ? (
        <View
          style={[
            styles.banner,
            banner.tone === 'success'
              ? styles.bannerSuccess
              : styles.bannerError,
          ]}
        >
          <Feather
            name={banner.tone === 'success' ? 'check-circle' : 'alert-circle'}
            size={14}
            color={banner.tone === 'success' ? '#047857' : colors.danger}
          />
          <Text
            style={[
              styles.bannerText,
              banner.tone === 'success'
                ? { color: '#047857' }
                : { color: colors.danger },
            ]}
          >
            {banner.text}
          </Text>
        </View>
      ) : null}

      {/* Firm logo — square avatar uploader using the same PhotoUpload
          widget the signup / profile screens use. */}
      <Text style={styles.formSection}>Firm logo</Text>
      <PhotoUpload
        value={form.logo}
        onChange={(url) => set('logo', url)}
        category="firm_logo"
      />

      <Text style={styles.formSection}>Identity</Text>
      <AuthInput
        label="Firm name"
        icon="briefcase"
        value={form.firmName}
        onChangeText={(v) => set('firmName', v)}
        autoCapitalize="words"
      />
      <AuthInput
        label="Registration number"
        icon="hash"
        value={form.registrationNumber}
        onChangeText={(v) => set('registrationNumber', v)}
      />
      <AuthInput
        label="Established year"
        icon="calendar"
        value={form.establishedYear}
        onChangeText={(v) =>
          set('establishedYear', v.replace(/[^0-9]/g, '').slice(0, 4))
        }
        keyboardType="number-pad"
      />
      <AuthInput
        label="Website"
        icon="link"
        value={form.website}
        onChangeText={(v) => set('website', v)}
        keyboardType="url"
      />

      <Text style={styles.formSection}>Contact</Text>
      <AuthInput
        label="Contact email"
        icon="mail"
        value={form.contactEmail}
        onChangeText={(v) => set('contactEmail', v)}
        keyboardType="email-address"
      />
      <AuthInput
        label="Contact number"
        icon="phone"
        value={form.contactNumber}
        onChangeText={(v) => set('contactNumber', v)}
        keyboardType="phone-pad"
      />
      <AuthInput
        label="Headquarters"
        icon="map-pin"
        value={form.headquarters}
        onChangeText={(v) => set('headquarters', v)}
        autoCapitalize="words"
      />

      <Text style={styles.formSection}>Team</Text>
      <AuthInput
        label="Total employees"
        icon="users"
        value={form.totalEmployees}
        onChangeText={(v) =>
          set('totalEmployees', v.replace(/[^0-9]/g, ''))
        }
        keyboardType="number-pad"
      />
      <AuthInput
        label="Number of professionals"
        icon="user-check"
        value={form.numberOfProfessionals}
        onChangeText={(v) =>
          set('numberOfProfessionals', v.replace(/[^0-9]/g, ''))
        }
        keyboardType="number-pad"
      />

      <Text style={styles.formSection}>About</Text>
      <AuthInput
        label="Short description"
        icon="edit-3"
        value={form.about}
        onChangeText={(v) => set('about', v)}
        multiline
        numberOfLines={4}
        autoCapitalize="sentences"
      />

      <Text style={styles.formSection}>Documents</Text>
      <Text style={styles.formHint}>
        Registration certificate and business licence files.
      </Text>
      <PhotoUpload
        value={form.registrationCertificate}
        onChange={(url) => set('registrationCertificate', url)}
        category="firm_document"
      />
      <View style={{ height: spacing.sm }} />
      <PhotoUpload
        value={form.businessLicense}
        onChange={(url) => set('businessLicense', url)}
        category="firm_document"
      />

      <GradientButton
        title={saving ? 'Saving…' : 'Save firm profile'}
        loading={saving}
        onPress={save}
        style={{ marginTop: spacing.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  muted: { marginTop: 2, fontSize: fontSize.sm, color: colors.textSecondary },
  tiny: { marginTop: 4, fontSize: 11, color: colors.textMuted },

  firmCaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: '#ede9fe',
  },
  firmCaseChipText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#6d28d9',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  // Hamburger icon embedded in the screen's nav header (right side).
  headerMenuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Firm hero card — gradient ink panel at the top of the dashboard.
  firmHero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', borderRadius: 999 },
  heroGlowA: {
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    backgroundColor: 'rgba(217,119,6,0.22)',
  },
  heroGlowB: {
    bottom: -40,
    left: -30,
    width: 140,
    height: 140,
    backgroundColor: 'rgba(13,148,136,0.22)',
  },
  firmHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  firmLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  firmLogoImg: { width: 64, height: 64, resizeMode: 'cover' },
  firmLogoInitials: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  firmHeroEyebrow: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  firmHeroName: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  firmHeroLoc: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  firmHeroLocText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: fontWeight.semibold,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeaderText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },

  // Right-side drawer
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  drawerPanel: {
    // `top` is set inline using safe-area insets + header height so
    // the drawer card always lands just below the dark nav header.
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  // Dark gradient header — matches the dashboard hero card so the
  // drawer reads as a continuation of the firm brand.
  drawerHead: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  drawerHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  drawerLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  drawerLogoImg: { width: 44, height: 44, resizeMode: 'cover' },
  drawerLogoInitials: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  drawerEyebrow: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  drawerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  drawerSubtitle: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: fontWeight.semibold,
  },
  drawerList: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  drawerItemActive: { backgroundColor: colors.primarySoft },
  drawerItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemIconActive: { backgroundColor: colors.primary },
  drawerItemText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  drawerItemTextActive: { color: colors.primary },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 12, color: colors.danger },

  // Overview stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  statHint: { marginTop: 4, fontSize: 11, color: colors.textMuted },

  // List item layout
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    flexShrink: 1,
  },

  // Join requests
  requestActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#fff5f5',
  },
  rejectText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#047857',
  },
  approveText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  // Reviews
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#b45309',
  },

  // Firm Profile form sectioning
  formSection: {
    marginTop: spacing.md,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  formHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerError: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  bannerSuccess: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: fontWeight.semibold },
});
