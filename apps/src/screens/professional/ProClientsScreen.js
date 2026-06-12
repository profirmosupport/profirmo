// ProClientsScreen — mobile mirror of /dashboard/professional/clients.
// Lists every client linked to the calling professional + an "Add
// client" modal that does find-or-create by phone (same flow as
// AddClientModal on the web).

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
import EmptyState from '../../components/common/EmptyState';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import {
  listClients,
  createClient,
  linkExistingClient,
  searchClientByPhone,
} from '../../services/clientService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

function initialsOf(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

export default function ProClientsScreen() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listClients();
      setClients(Array.isArray(res) ? res : []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      return (
        String(c.name || '')
          .toLowerCase()
          .includes(q) ||
        String(c.email || '')
          .toLowerCase()
          .includes(q) ||
        String(c.phone || '')
          .toLowerCase()
          .includes(q) ||
        String(c.city || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [clients, search]);

  return (
    <ScreenContainer hasNavHeader contentStyle={styles.page}>
      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {loading
            ? 'Loading…'
            : `${clients.length} client${clients.length === 1 ? '' : 's'}`}
        </Text>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [
            styles.addBtn,
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Feather name="user-plus" size={13} color={colors.textInverse} />
          <Text style={styles.addBtnText}>Add client</Text>
        </Pressable>
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Feather name="check-circle" size={13} color="#047857" />
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable onPress={() => setNotice('')} hitSlop={6}>
            <Feather name="x" size={12} color="#047857" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Feather name="search" size={14} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, phone or city…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Feather name="x" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {loading && clients.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : clients.length === 0 ? (
        <EmptyState
          icon="users"
          title="No clients yet"
          description="Clients you add or who book you will appear here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="No clients match your search"
          description="Try a different name, email, phone or city."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {filtered.map((c) => (
            <Card key={c.id || c.userId || c.email}>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsOf(c.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.name || c.email || 'Client'}
                  </Text>
                  {c.email ? (
                    <Text style={styles.muted} numberOfLines={1}>
                      {c.email}
                    </Text>
                  ) : null}
                  {c.phone ? (
                    <Text style={styles.muted}>{c.phone}</Text>
                  ) : null}
                </View>
                <View style={styles.metaCol}>
                  {c.city ? (
                    <View style={styles.cityPill}>
                      <Feather name="map-pin" size={10} color={colors.textMuted} />
                      <Text style={styles.cityText}>{c.city}</Text>
                    </View>
                  ) : null}
                  {c.type ? (
                    <Badge variant="gray">{c.type}</Badge>
                  ) : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      <AddClientModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(result) => {
          setAddOpen(false);
          setNotice(
            result && result.inviteSent
              ? `Invitation sent to ${result.email}.`
              : 'Client added.'
          );
          load();
        }}
      />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------
// AddClientModal — find-or-create. Tries phone lookup first; if a
// platform user matches, link them. Otherwise create a fresh row.
// ---------------------------------------------------------------------

function AddClientModal({ visible, onClose, onAdded }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [matched, setMatched] = useState(null);

  useEffect(() => {
    if (visible) {
      setPhone('');
      setName('');
      setEmail('');
      setCity('');
      setError('');
      setMatched(null);
      setBusy(false);
    }
  }, [visible]);

  async function lookup() {
    setError('');
    setMatched(null);
    if (!/^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''))) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    setBusy(true);
    try {
      const res = await searchClientByPhone(phone.trim());
      if (res && res.user) {
        setMatched(res.user);
        if (!name) setName(res.user.fullName || res.user.name || '');
        if (!email) setEmail(res.user.email || '');
      } else {
        setMatched(null);
      }
    } catch (err) {
      setError(err?.message || 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError('');
    if (busy) return;
    if (!name.trim() && !matched) {
      setError('Name is required when creating a new client.');
      return;
    }
    setBusy(true);
    try {
      let result;
      if (matched) {
        result = await linkExistingClient(matched.id);
      } else {
        result = await createClient({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          city: city.trim() || undefined,
        });
      }
      onAdded?.(result || {});
    } catch (err) {
      setError(err?.message || 'Could not add the client.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => !busy && onClose()}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Add client</Text>
            <Pressable onPress={() => !busy && onClose()} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Search by phone first — if the person already has a Profirmo
            account we&apos;ll link them instead of creating a duplicate.
          </Text>

          <AuthInput
            label="Phone number"
            icon="smartphone"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (matched) setMatched(null);
            }}
            placeholder="+91 98xxxxxxxx"
          />
          <Pressable
            onPress={lookup}
            disabled={busy || !phone}
            style={({ pressed }) => [
              styles.lookupBtn,
              { opacity: pressed || busy ? 0.85 : 1 },
            ]}
          >
            <Feather name="search" size={13} color={colors.primary} />
            <Text style={styles.lookupBtnText}>
              {busy ? 'Looking up…' : 'Look up'}
            </Text>
          </Pressable>

          {matched ? (
            <View style={styles.matchedBox}>
              <Feather name="user-check" size={14} color="#047857" />
              <View style={{ flex: 1 }}>
                <Text style={styles.matchedTitle}>
                  Existing user matched
                </Text>
                <Text style={styles.matchedSub}>
                  {matched.fullName || matched.name || matched.email}
                </Text>
              </View>
            </View>
          ) : null}

          <AuthInput
            label="Full name"
            icon="user"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
          <AuthInput
            label="Email (optional)"
            icon="mail"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <AuthInput
            label="City (optional)"
            icon="map-pin"
            autoCapitalize="words"
            value={city}
            onChangeText={setCity}
          />

          {error ? <Text style={styles.modalError}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable
              onPress={() => !busy && onClose()}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalCancel,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <GradientButton
              title={
                busy
                  ? 'Saving…'
                  : matched
                    ? 'Link client'
                    : 'Add client'
              }
              loading={busy}
              onPress={submit}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.md, gap: spacing.sm },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  count: { fontSize: fontSize.sm, color: colors.textSecondary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#6ee7b7',
    backgroundColor: '#d1fae5',
    marginBottom: spacing.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#047857',
    fontWeight: fontWeight.semibold,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    paddingVertical: 4,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  muted: { marginTop: 2, fontSize: 12, color: colors.textSecondary },

  metaCol: { alignItems: 'flex-end', gap: 4 },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  cityText: { fontSize: 11, color: colors.textSecondary },

  // Modal
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
    maxHeight: '90%',
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
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  modalError: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.danger,
  },
  modalActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },

  lookupBtn: {
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
    marginBottom: spacing.md,
  },
  lookupBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  matchedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#6ee7b7',
    backgroundColor: '#d1fae5',
    marginBottom: spacing.md,
  },
  matchedTitle: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#047857',
  },
  matchedSub: { fontSize: 11, color: '#047857' },
});
