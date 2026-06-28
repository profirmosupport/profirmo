// ProFirmScreen — mobile mirror of /dashboard/professional/firm.
// Renders the pro's current firm membership card with two CTAs:
//
//   • "Firm dashboard"  → owners + co-owners only.
//                         Opens the firm's public detail screen.
//   • "Leave firm"      → every member EXCEPT the owner. Confirm
//                         modal → POST /api/firm-join/leave → reload.
//
// If the pro has no firm yet, falls through to the existing empty
// state. Pending invitations stay surfaced at the top.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Section from '../../components/common/Section';
import EmptyState from '../../components/common/EmptyState';
import GradientButton from '../../components/auth/GradientButton';
import { listFirmInvitations } from '../../services/firmService';
import firmJoinService from '../../services/firmJoinService';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function ProFirmScreen({ navigation }) {
  const [membership, setMembership] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [banner, setBanner] = useState('');

  // Joinable-firms list + the caller's own pending join requests.
  // Both surface in the "no firm yet" branch so the user can pick
  // one to ask to join (or see their pending asks).
  const [joinableFirms, setJoinableFirms] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [firmSearch, setFirmSearch] = useState('');

  // Join-firm modal state.
  const [joinTarget, setJoinTarget] = useState(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [cancellingId, setCancellingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, inv, reqs] = await Promise.all([
        firmJoinService.getMyMembership().catch(() => null),
        listFirmInvitations().catch(() => []),
        firmJoinService.listMyRequests().catch(() => []),
      ]);
      setMembership(m || null);
      setInvitations(Array.isArray(inv) ? inv : []);
      setMyRequests(Array.isArray(reqs) ? reqs : []);
      if (!m) {
        const list = await firmJoinService
          .listJoinableFirms()
          .catch(() => []);
        setJoinableFirms(Array.isArray(list) ? list : []);
      } else {
        setJoinableFirms([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus so returning from FirmCreate / FirmDashboard
  // reflects the latest membership state.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredFirms = useMemo(() => {
    const q = firmSearch.trim().toLowerCase();
    if (!q) return joinableFirms;
    return joinableFirms.filter((f) =>
      String(f.firmName || '')
        .toLowerCase()
        .includes(q)
    );
  }, [joinableFirms, firmSearch]);

  async function submitJoinRequest() {
    if (!joinTarget || joining) return;
    setJoining(true);
    setJoinError('');
    try {
      await firmJoinService.requestJoin(joinTarget.id, joinMessage.trim());
      setJoinTarget(null);
      setJoinMessage('');
      await load();
    } catch (err) {
      setJoinError(err?.message || 'Could not send your join request.');
    } finally {
      setJoining(false);
    }
  }

  async function cancelMyRequest(reqId) {
    if (cancellingId) return;
    setCancellingId(reqId);
    try {
      await firmJoinService.cancelRequest(reqId);
      await load();
    } catch {
      // Silent — the load reflects truth.
    } finally {
      setCancellingId('');
    }
  }

  const firm = membership && membership.firm;
  const member = membership && membership.member;
  const role = (member && member.role) || '';
  const isOwner = role === 'owner';
  const isCoOwner = role === 'co-owner';
  const canManageFirm = isOwner || isCoOwner;

  async function confirmLeave() {
    setLeaving(true);
    setLeaveError('');
    try {
      await firmJoinService.leaveFirm();
      setLeaveOpen(false);
      setBanner('You have left the firm.');
      await load();
    } catch (err) {
      setLeaveError(err?.message || 'Could not leave the firm.');
    } finally {
      setLeaving(false);
    }
  }

  function openFirmDashboard() {
    if (!firm || !firm.id) return;
    // FirmDashboard is the in-app dashboard with tabs for overview,
    // members, requests, clients, leads, cases, reviews, profile.
    navigation.navigate('FirmDashboard');
  }

  return (
    <ScreenContainer
      refreshing={loading}
      onRefresh={load}
      hasNavHeader
      contentStyle={styles.page}
    >
      {loading && !membership && invitations.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {banner ? (
        <View style={styles.banner}>
          <Feather name="check-circle" size={14} color="#047857" />
          <Text style={styles.bannerText}>{banner}</Text>
          <Pressable onPress={() => setBanner('')} hitSlop={6}>
            <Feather name="x" size={12} color="#047857" />
          </Pressable>
        </View>
      ) : null}

      {invitations.length > 0 ? (
        <Section title="Pending invitations">
          {invitations.map((inv) => (
            <Card key={inv.id} style={{ marginBottom: spacing.sm }}>
              <Text style={styles.title}>
                {inv.firmName || 'Firm invitation'}
              </Text>
              <Text style={styles.muted}>
                Role: {inv.role || 'member'}
                {inv.invitedByName ? ` · from ${inv.invitedByName}` : ''}
              </Text>
              <Text style={styles.muted}>
                Accept this invitation from the web app to join the firm.
              </Text>
            </Card>
          ))}
        </Section>
      ) : null}

      {membership && firm ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Card>
            <View style={styles.firmHeader}>
              <View style={styles.firmIcon}>
                <Feather name="briefcase" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.firmName} numberOfLines={2}>
                  {firm.firmName || firm.name || 'Your firm'}
                </Text>
                <Text style={styles.muted}>
                  {role ? `Role: ${role}` : 'Member'}
                </Text>
                {member && member.joinedAt ? (
                  <Text style={styles.muted}>
                    Joined {formatDate(member.joinedAt)}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.actionsRow}>
              {canManageFirm ? (
                <GradientButton
                  title="Firm dashboard"
                  onPress={openFirmDashboard}
                  style={{ flex: 1 }}
                />
              ) : null}
              <Pressable
                onPress={() => !isOwner && setLeaveOpen(true)}
                disabled={isOwner}
                style={({ pressed }) => [
                  styles.leaveBtn,
                  isOwner && styles.leaveBtnDisabled,
                  { opacity: pressed && !isOwner ? 0.85 : 1, flex: 1 },
                ]}
              >
                <Feather
                  name="log-out"
                  size={14}
                  color={isOwner ? colors.textMuted : colors.danger}
                />
                <Text
                  style={[
                    styles.leaveText,
                    isOwner && { color: colors.textMuted },
                  ]}
                >
                  Leave firm
                </Text>
              </Pressable>
            </View>
            {isOwner ? (
              <Text style={styles.ownerHint}>
                Firm owners cannot leave. Transfer ownership first.
              </Text>
            ) : null}
          </Card>
        </View>
      ) : !loading ? (
        <>
          {/* Create-your-own CTA */}
          <Section
            title="Create your own firm"
            subtitle="Start your own law firm. You will be its owner."
          >
            <Card>
              <Text style={styles.muted}>
                Set up your firm to invite other professionals to join.
                Your professional profile must be approved first.
              </Text>
              <GradientButton
                title="Create firm"
                onPress={() => navigation.navigate('FirmCreate')}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          </Section>

          {/* Browse firms to join — searchable list */}
          <Section
            title="Browse firms to join"
            subtitle="Search and request to join an existing firm."
          >
            <View style={styles.searchWrap}>
              <Feather name="search" size={14} color={colors.textMuted} />
              <TextInput
                value={firmSearch}
                onChangeText={setFirmSearch}
                placeholder="Search firms by name…"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {firmSearch ? (
                <Pressable onPress={() => setFirmSearch('')} hitSlop={8}>
                  <Feather name="x" size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {joinableFirms.length === 0 ? (
              <EmptyState
                icon="briefcase"
                title="No firms available"
                description="There are no law firms accepting members right now."
              />
            ) : filteredFirms.length === 0 ? (
              <EmptyState
                icon="search"
                title="No firms match your search"
                description="Try a different name."
              />
            ) : (
              filteredFirms.map((f) => (
                <Card key={f.id} style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.title}>{f.firmName}</Text>
                  {f.headquarters ? (
                    <Text style={styles.muted}>{f.headquarters}</Text>
                  ) : null}
                  {f.about ? (
                    <Text style={styles.muted} numberOfLines={3}>
                      {f.about}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      setJoinError('');
                      setJoinMessage('');
                      setJoinTarget(f);
                    }}
                    style={({ pressed }) => [
                      styles.joinBtn,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather
                      name="user-plus"
                      size={13}
                      color={colors.primary}
                    />
                    <Text style={styles.joinBtnText}>Request to join</Text>
                  </Pressable>
                </Card>
              ))
            )}
          </Section>

          {/* My join requests */}
          {myRequests.length > 0 ? (
            <Section
              title="My join requests"
              subtitle="Track the firms you have asked to join."
            >
              {myRequests.map((r) => (
                <Card key={r.id} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.rowSplit}>
                    <Text style={styles.title} numberOfLines={1}>
                      {r.firmName || 'Firm'}
                    </Text>
                    {r.status ? (
                      <Badge
                        variant={
                          r.status === 'APPROVED'
                            ? 'green'
                            : r.status === 'REJECTED'
                              ? 'red'
                              : r.status === 'CANCELLED'
                                ? 'gray'
                                : 'amber'
                        }
                      >
                        {r.status}
                      </Badge>
                    ) : null}
                  </View>
                  {r.message ? (
                    <Text style={styles.muted}>{r.message}</Text>
                  ) : null}
                  {r.createdAt ? (
                    <Text style={styles.tiny}>{formatDate(r.createdAt)}</Text>
                  ) : null}
                  {r.status === 'PENDING' ? (
                    <Pressable
                      onPress={() => cancelMyRequest(r.id)}
                      disabled={cancellingId === r.id}
                      style={({ pressed }) => [
                        styles.cancelReqBtn,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={styles.cancelReqText}>
                        {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                      </Text>
                    </Pressable>
                  ) : null}
                </Card>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}

      {/* Request-to-join modal */}
      <Modal
        visible={!!joinTarget}
        animationType="fade"
        transparent
        onRequestClose={() => !joining && setJoinTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Request to join{' '}
                {joinTarget ? joinTarget.firmName : 'firm'}
              </Text>
              <Pressable
                onPress={() => !joining && setJoinTarget(null)}
                hitSlop={8}
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              Add a short message to introduce yourself (optional).
            </Text>
            <TextInput
              value={joinMessage}
              onChangeText={setJoinMessage}
              placeholder="I'd like to join your firm because…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              style={styles.joinTextarea}
            />
            {joinError ? (
              <Text style={styles.modalError}>{joinError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setJoinTarget(null)}
                disabled={joining}
                style={({ pressed }) => [
                  styles.modalCancel,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <GradientButton
                title={joining ? 'Sending…' : 'Send request'}
                loading={joining}
                onPress={submitJoinRequest}
                style={{ flexShrink: 0 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Leave-firm confirmation modal */}
      <Modal
        visible={leaveOpen}
        animationType="fade"
        transparent
        onRequestClose={() => !leaving && setLeaveOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Leave firm</Text>
              <Pressable onPress={() => !leaving && setLeaveOpen(false)} hitSlop={8}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              Are you sure you want to leave
              {firm && (firm.firmName || firm.name)
                ? ` ${firm.firmName || firm.name}`
                : ' this firm'}? You will need to send a new request to
              rejoin.
            </Text>
            {leaveError ? (
              <Text style={styles.modalError}>{leaveError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setLeaveOpen(false)}
                disabled={leaving}
                style={({ pressed }) => [
                  styles.modalCancel,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmLeave}
                disabled={leaving}
                style={({ pressed }) => [
                  styles.modalConfirm,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalConfirmText}>
                  {leaving ? 'Leaving…' : 'Leave firm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.md },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7',
    marginBottom: spacing.md,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: '#047857',
  },

  firmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  firmIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  firmName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  muted: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  actionsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#fff5f5',
  },
  leaveBtnDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  leaveText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },
  ownerHint: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  tiny: { marginTop: 4, fontSize: 11, color: colors.textMuted },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  // Searchable firm browser
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  joinBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  cancelReqBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelReqText: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },

  // Join-request modal extras
  joinTextarea: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 96,
    textAlignVertical: 'top',
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  modalBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalError: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.danger,
  },
  modalActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  modalCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCancelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  modalConfirm: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  modalConfirmText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
});
