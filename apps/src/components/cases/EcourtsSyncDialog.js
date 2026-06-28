// EcourtsSyncDialog — mobile mirror of the web's sync result modal.
// Displays the diff returned by POST /api/cases/:id/sync-ecourts: a
// "what changed since last refresh" banner, a field-change list, the
// full current snapshot (case summary, parties, hearings, orders) with
// "New" pills on entries the latest sync added.

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDate } from '../../utils/formatters';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function EcourtsSyncDialog({
  visible,
  busy,
  error,
  result,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Feather name="refresh-cw" size={14} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>E-Courts sync</Text>
              <Text style={styles.subtitle}>
                Latest snapshot from the eCourts India bridge.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} disabled={busy}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyInner}
          >
            {busy ? (
              <View style={styles.busyBlock}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.busyText}>
                  Fetching the latest record…
                </Text>
                <Text style={styles.busyHint}>
                  E-Courts can take 10–60 seconds.
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : result ? (
              <DiffBody result={result} />
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DiffBody({ result }) {
  const c = (result && result.case) || {};
  const snap = c.eciSnapshot || {};
  const diff = (result && result.diff) || {};

  const newHearingKeys = new Set(
    (diff.newHearings || []).map(
      (h) =>
        `${h.hearingDate || h.businessOnDate || ''}|${h.purposeOfListing || h.purpose || ''}`
    )
  );
  const newOrderKeys = new Set(
    (diff.newOrders || []).map(
      (o) => `${o.orderDate || ''}|${o.orderUrl || o.filename || ''}`
    )
  );

  const hearings = Array.isArray(snap.historyOfCaseHearings)
    ? snap.historyOfCaseHearings
    : [];
  const interim = Array.isArray(snap.interimOrders) ? snap.interimOrders : [];
  const judgments = Array.isArray(snap.judgmentOrders)
    ? snap.judgmentOrders
    : [];
  const orders = [...interim, ...judgments];

  return (
    <View style={{ gap: spacing.md }}>
      {diff.isFirstSync ? (
        <Banner
          tone="success"
          icon="check-circle"
          text="First refresh saved. Future syncs will mark only what's new."
        />
      ) : diff.hasAnyChange ? (
        <Banner
          tone="warning"
          icon="refresh-cw"
          text={`${(diff.fieldChanges || []).length} field change(s), ${(diff.newHearings || []).length} new hearing(s), ${(diff.newOrders || []).length} new order(s) since the last refresh — highlighted below.`}
        />
      ) : (
        <Banner
          tone="muted"
          icon="check-circle"
          text="No new updates from E-Courts India since the last refresh — full current record below."
        />
      )}

      {(diff.fieldChanges || []).length > 0 ? (
        <Section title="What changed">
          {diff.fieldChanges.map((ch, i) => (
            <View key={`${ch.field}-${i}`} style={styles.fieldChange}>
              <Text style={styles.fieldChangeLabel}>{ch.field}</Text>
              <View style={styles.fieldChangeRow}>
                <Text style={styles.fieldFrom} numberOfLines={1}>
                  {String(ch.from || '—')}
                </Text>
                <Text style={styles.fieldArrow}>→</Text>
                <Text style={styles.fieldTo} numberOfLines={1}>
                  {String(ch.to || '—')}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Case summary">
        <View style={styles.kvGrid}>
          <KV label="CNR" value={c.cnr} mono />
          <KV label="Status" value={snap.caseStatus} />
          <KV label="Case type" value={snap.caseType || c.caseType} />
          <KV label="Case number" value={snap.caseNumber || c.caseNumber} />
          <KV
            label="Court"
            value={snap.courtName || snap.courtCode || c.courtName}
          />
          <KV
            label="District / State"
            value={[snap.district || c.district, snap.state || c.state]
              .filter(Boolean)
              .join(', ')}
          />
          <KV label="Filed on" value={formatDate(snap.filingDate || c.filingDate)} />
          <KV label="Registered on" value={formatDate(snap.registrationDate)} />
          <KV
            label="Decision date"
            value={formatDate(snap.decisionDate || c.decisionDate)}
          />
          <KV
            label="Next hearing"
            value={formatDate(snap.nextHearingDate || c.nextHearingDate)}
          />
          <KV
            label="Refreshed"
            value={c.eciSyncedAt ? formatDate(c.eciSyncedAt) : 'just now'}
          />
        </View>
      </Section>

      {hasAnyParty(snap, c) ? (
        <Section title="Parties & counsel">
          <PartyList label="Petitioner(s)" items={snap.petitioners || c.petitioners} />
          <PartyList label="Respondent(s)" items={snap.respondents || c.respondents} />
          <PartyList
            label="Petitioner's advocates"
            items={snap.petitionerAdvocates || c.petitionerAdvocates}
          />
          <PartyList
            label="Respondent's advocates"
            items={snap.respondentAdvocates || c.respondentAdvocates}
          />
          <PartyList label="Judges" items={snap.judges || c.judges} />
        </Section>
      ) : null}

      {Array.isArray(snap.actsAndSections) && snap.actsAndSections.length > 0 ? (
        <Section title="Acts & sections">
          <View style={styles.tagRow}>
            {snap.actsAndSections.map((a, i) => (
              <View key={`${a}-${i}`} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {a}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {hearings.length > 0 ? (
        <Section title={`Hearing history (${hearings.length})`}>
          {hearings.map((h, i) => {
            const k = `${h.hearingDate || h.businessOnDate || ''}|${h.purposeOfListing || h.purpose || ''}`;
            const isNew = newHearingKeys.has(k);
            return (
              <View
                key={i}
                style={[styles.entryRow, isNew ? styles.entryRowNew : null]}
              >
                <View style={styles.entryHead}>
                  <Text style={styles.entryDate}>
                    {formatDate(h.hearingDate || h.businessOnDate) || '—'}
                  </Text>
                  {isNew ? <NewPill /> : null}
                </View>
                <Text style={styles.entrySub}>
                  {h.purposeOfListing || h.purpose || '—'}
                </Text>
                {h.judge ? (
                  <Text style={styles.entrySub}>Bench: {h.judge}</Text>
                ) : null}
              </View>
            );
          })}
        </Section>
      ) : null}

      {orders.length > 0 ? (
        <Section title={`Orders & judgments (${orders.length})`}>
          {orders.map((o, i) => {
            const k = `${o.orderDate || ''}|${o.orderUrl || o.filename || ''}`;
            const isNew = newOrderKeys.has(k);
            return (
              <View
                key={`${k}-${i}`}
                style={[styles.entryRow, isNew ? styles.entryRowNew : null]}
              >
                <View style={styles.entryHead}>
                  <Text style={styles.entryDate}>
                    {formatDate(o.orderDate) || '—'}
                  </Text>
                  {isNew ? <NewPill /> : null}
                </View>
                {o.orderNumber ? (
                  <Text style={styles.entrySub}>Order {o.orderNumber}</Text>
                ) : null}
                {o.purposeOfListing ? (
                  <Text style={styles.entrySub}>{o.purposeOfListing}</Text>
                ) : null}
                {o.filename ? (
                  <Text style={styles.entrySub} numberOfLines={1}>
                    {o.filename}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Section>
      ) : null}
    </View>
  );
}

function hasAnyParty(snap, c) {
  const groups = [
    snap.petitioners || c.petitioners,
    snap.respondents || c.respondents,
    snap.petitionerAdvocates || c.petitionerAdvocates,
    snap.respondentAdvocates || c.respondentAdvocates,
    snap.judges || c.judges,
  ];
  return groups.some((g) => Array.isArray(g) && g.length > 0);
}

function Banner({ tone, icon, text }) {
  const cfg = BANNER_TONES[tone] || BANNER_TONES.muted;
  return (
    <View style={[styles.banner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Feather name={icon} size={14} color={cfg.text} />
      <Text style={[styles.bannerText, { color: cfg.text }]}>{text}</Text>
    </View>
  );
}

const BANNER_TONES = {
  success: { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
  warning: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
  muted: { bg: colors.surfaceMuted, border: colors.border, text: colors.textSecondary },
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function KV({ label, value, mono }) {
  const display = value && String(value).trim() ? String(value) : '—';
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, mono ? styles.kvValueMono : null]}>{display}</Text>
    </View>
  );
}

function PartyList({ label, items }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return null;
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.partyLabel}>{label}</Text>
      {list.map((p, i) => {
        const display =
          typeof p === 'string'
            ? p
            : p && (p.name || p.fullName || p.label || p.title || '—');
        return (
          <Text key={`${display}-${i}`} style={styles.partyItem}>
            • {display || '—'}
          </Text>
        );
      })}
    </View>
  );
}

function NewPill() {
  return (
    <View style={styles.newPill}>
      <Text style={styles.newPillText}>NEW</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  body: { flex: 1 },
  bodyInner: { paddingTop: spacing.md, paddingBottom: spacing.lg },

  busyBlock: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  busyText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  busyHint: { fontSize: 11, color: colors.textMuted },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: { flex: 1, fontSize: 12, color: '#b91c1c' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17 },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  fieldChange: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  fieldChangeLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },
  fieldChangeRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  fieldFrom: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    fontFamily: 'Courier',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  fieldArrow: { color: colors.textMuted, fontSize: 11 },
  fieldTo: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#d1fae5',
    color: '#065f46',
    fontFamily: 'Courier',
    fontSize: 11,
  },

  kvGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  kv: { width: '50%', paddingVertical: 4, paddingRight: 6 },
  kvLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kvValue: { marginTop: 2, fontSize: 12, color: colors.textPrimary },
  kvValueMono: { fontFamily: 'Courier' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  tagText: { fontSize: 11, color: colors.textSecondary },

  entryRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  entryRowNew: {
    borderColor: '#6ee7b7',
    backgroundColor: '#d1fae5',
  },
  entryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryDate: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  entrySub: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
  newPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#059669',
  },
  newPillText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  partyBlock: { marginBottom: 4 },
  partyLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  partyItem: { fontSize: 12, color: colors.textPrimary, marginVertical: 1 },
});
