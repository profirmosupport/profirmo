// ECourtsCaseDetailScreen — mobile mirror of the web case-detail page.
// Renders the upstream `courtCaseData` block: hero, summary grid,
// parties + counsel, hearing history, orders & judgments (with PDF
// download via Linking.openURL on the proxy endpoint).
//
// Detail viewing requires sign-in (the proxy returns 401 to guests).
// Guests see a gate card with Login / Signup CTAs.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCaseByCnr,
  getImportedCase,
  getOrderAi,
  importCaseFromEcourts,
  orderDownloadUrl,
} from '../../services/ecourtsService';
import { setItem, STORAGE_KEYS } from '../../utils/storage';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function StatBlock({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );
}

function PartyList({ label, items }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return (
    <View style={styles.partyCard}>
      <Text style={styles.partyLabel}>{label}</Text>
      {list.length === 0 ? (
        <Text style={styles.partyEmpty}>Not listed</Text>
      ) : (
        list.map((name, i) => (
          <Text key={`${name}-${i}`} style={styles.partyName}>
            {name}
          </Text>
        ))
      )}
    </View>
  );
}

function OrderRow({ order, cnr, downloading, onDownload, aiBusy, onAi }) {
  const filename = order.orderUrl || order.filename;
  const id = `${order.orderDate || ''}|${filename || ''}`;
  const label = order.orderType || order.description || 'Order';
  const isBusy = downloading === id;
  const isAiBusy = aiBusy === id;
  return (
    <View style={styles.orderRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.orderTitle} numberOfLines={2}>
          {label}
        </Text>
        <View style={styles.orderMeta}>
          {order.orderDate ? (
            <View style={styles.orderMetaItem}>
              <Feather name="calendar" size={10} color={colors.textMuted} />
              <Text style={styles.orderMetaText}>{fmtDate(order.orderDate)}</Text>
            </View>
          ) : null}
          {filename ? (
            <Text style={styles.orderFile} numberOfLines={1}>
              {filename}
            </Text>
          ) : null}
        </View>
      </View>
      {filename ? (
        <View style={styles.orderBtnCol}>
          <Pressable
            onPress={() => onAi(id, filename, label)}
            disabled={isAiBusy}
            style={({ pressed }) => [
              styles.aiBtn,
              { opacity: pressed || isAiBusy ? 0.85 : 1 },
            ]}
          >
            {isAiBusy ? (
              <ActivityIndicator size="small" color="#7c3aed" />
            ) : (
              <Feather name="zap" size={11} color="#7c3aed" />
            )}
            <Text style={styles.aiBtnText}>AI</Text>
          </Pressable>
          <Pressable
            onPress={() => onDownload(id, filename)}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.downloadBtn,
              { opacity: pressed || isBusy ? 0.85 : 1 },
            ]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={colors.primarySoftText} />
            ) : (
              <Feather name="download" size={11} color={colors.primarySoftText} />
            )}
            <Text style={styles.downloadText}>{isBusy ? 'Opening' : 'PDF'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function ECourtsCaseDetailScreen({ navigation, route }) {
  const cnr = route?.params?.cnr;
  const { user, isGuest, exitGuest } = useAuth();
  const isAuthed = !!user && !isGuest;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');

  // AI summary modal — opens immediately in a "loading" state, then
  // swaps to the analysis when the upstream LLM call completes
  // (10-60s typical for first hit per file).
  const [aiBusy, setAiBusy] = useState('');
  const [aiModal, setAiModal] = useState({
    open: false,
    title: '',
    data: null,
    error: '',
  });

  const [imported, setImported] = useState({
    imported: false,
    caseId: null,
    role: null,
  });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const load = useCallback(async () => {
    if (!cnr) return;
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getCaseByCnr(cnr);
      setCaseData(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load case.');
    } finally {
      setLoading(false);
    }
  }, [cnr, isAuthed]);

  useEffect(() => {
    load();
  }, [load]);

  // Once we have an authed user, see if they've already saved this CNR
  // into their personal Cases module — flips the CTA below from "Save"
  // to "Check in my cases".
  useEffect(() => {
    if (!isAuthed || !cnr) return;
    let active = true;
    (async () => {
      try {
        const r = await getImportedCase(cnr);
        if (active) setImported(r);
      } catch {
        /* silent */
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthed, cnr]);

  async function handleImport() {
    if (importing) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await importCaseFromEcourts(cnr);
      const role = String(user?.role || '').toLowerCase();
      setImported({
        imported: true,
        caseId: result?.case?.id,
        role,
      });
    } catch (err) {
      setImportError(err.message || 'Could not save this case.');
    } finally {
      setImporting(false);
    }
  }

  async function handleDownload(id, filename) {
    setDownloadError('');
    setDownloading(id);
    try {
      const url = orderDownloadUrl(cnr, filename);
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error('No app on device can open this download URL.');
      await Linking.openURL(url);
    } catch (err) {
      setDownloadError(err.message || 'Could not open the PDF.');
      Alert.alert('Download failed', err.message || 'Please try again.');
    } finally {
      setDownloading('');
    }
  }

  async function handleAi(id, filename, title) {
    if (aiBusy) return;
    setAiBusy(id);
    setAiModal({ open: true, title: title || 'AI summary', data: null, error: '' });
    try {
      const data = await getOrderAi(cnr, filename);
      setAiModal((prev) => ({ ...prev, data, error: '' }));
    } catch (err) {
      setAiModal((prev) => ({
        ...prev,
        error: err.message || 'Could not generate the AI summary.',
      }));
    } finally {
      setAiBusy('');
    }
  }

  const courtData = caseData?.courtCaseData || null;

  const interim = useMemo(
    () =>
      Array.isArray(courtData?.interimOrders) ? courtData.interimOrders : [],
    [courtData]
  );
  const judgments = useMemo(
    () =>
      Array.isArray(courtData?.judgmentOrders) ? courtData.judgmentOrders : [],
    [courtData]
  );
  const hearings = useMemo(
    () =>
      Array.isArray(courtData?.historyOfCaseHearings)
        ? courtData.historyOfCaseHearings
        : [],
    [courtData]
  );

  // --- Auth gate ----------------------------------------------------------
  if (!isAuthed) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.gateCard}>
            <View style={styles.gateIcon}>
              <Feather name="lock" size={22} color={colors.primary} />
            </View>
            <Text style={styles.gateTitle}>Sign in to view this case</Text>
            <Text style={styles.gateBody}>
              Detailed E-Courts records — parties, hearings and downloadable
              order PDFs — are available to Profirmo members only.
            </Text>
            <Text style={styles.gateCnr}>CNR {cnr}</Text>

            <Pressable
              onPress={async () => {
                // Persist intent so the user lands back on this CNR
                // after they finish auth (replayed by GuestHomeScreen
                // on its first mount post-login).
                try {
                  await setItem(STORAGE_KEYS.postAuthIntent, {
                    screen: 'ECourtsCaseDetail',
                    params: { cnr },
                    ts: Date.now(),
                  });
                } catch {}
                exitGuest?.();
              }}
              style={({ pressed }) => [
                styles.gateCta,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gateCtaFill}
              >
                <Feather name="log-in" size={14} color="#fff" />
                <Text style={styles.gateCtaText}>Sign in</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.gateGhost,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.gateGhostText}>Back to search</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- Loading / error ----------------------------------------------------
  if (loading) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.body}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (error || !courtData) {
    return (
      <View style={styles.root}>
        <EmptyState
          icon="alert-circle"
          title={error ? 'Could not load case' : 'Case not found'}
          description={
            error ||
            'We could not find this CNR in E-Courts India. Try the search again.'
          }
        />
      </View>
    );
  }

  // --- Detail render ------------------------------------------------------
  const petitioner =
    (courtData.petitioners && courtData.petitioners[0]) || courtData.cnr;
  const respondent = courtData.respondents && courtData.respondents[0];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.cnr}>CNR {courtData.cnr}</Text>
          <Text style={styles.title}>
            {petitioner}
            {respondent ? (
              <>
                <Text style={styles.titleVs}> vs </Text>
                <Text style={styles.titleAlt}>{respondent}</Text>
              </>
            ) : null}
          </Text>
          <View
            style={[
              styles.statusBadge,
              String(courtData.caseStatus || '')
                .toLowerCase()
                .includes('disposed')
                ? styles.statusDisposed
                : styles.statusPending,
            ]}
          >
            <Text style={styles.statusText}>
              {courtData.caseStatus || 'Unknown'}
            </Text>
          </View>
        </View>

        {/* Save / Check CTA */}
        <View style={styles.savedRow}>
          {imported.imported && imported.caseId ? (
            <Pressable
              onPress={() => {
                // 1) Try cross-tab navigation into the Account
                //    dashboard's My Cases screen.
                // 2) If the tab chain isn't available (it can be on
                //    first-time nested-nav), fall back to the
                //    in-stack "EcourtsMyCases" route which renders
                //    the same screen inside the current HomeStack.
                try {
                  const tabs = navigation.getParent?.()?.getParent?.();
                  if (tabs) {
                    tabs.navigate('GuestSignup', {
                      screen: 'AccountCases',
                      initial: false,
                    });
                    return;
                  }
                } catch {}
                try {
                  navigation.navigate('EcourtsMyCases');
                  return;
                } catch {}
                Alert.alert(
                  'Saved to your dashboard',
                  'Your account dashboard could not be reached from here. Try again from the Account tab.',
                  [{ text: 'OK' }]
                );
              }}
              style={({ pressed }) => [
                styles.savedPill,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Feather name="check-circle" size={13} color={colors.success} />
              <Text style={styles.savedText}>Saved in My cases</Text>
              <Feather
                name="arrow-right"
                size={12}
                color={colors.success}
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleImport}
              disabled={importing}
              style={({ pressed }) => [
                styles.saveBtn,
                { opacity: pressed || importing ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveFill}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="folder-plus" size={13} color="#fff" />
                )}
                <Text style={styles.saveText}>
                  {importing ? 'Saving…' : 'Save to my cases'}
                </Text>
              </LinearGradient>
            </Pressable>
          )}
          {importError ? (
            <Text style={styles.inlineErr}>{importError}</Text>
          ) : null}
        </View>

        {/* Summary stats */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Case summary</Text>
          <View style={styles.statsGrid}>
            <StatBlock label="Case type" value={courtData.caseType} />
            <StatBlock label="Case number" value={courtData.caseNumber} />
            <StatBlock
              label="Court"
              value={courtData.courtName || courtData.courtCode}
            />
            <StatBlock
              label="District / State"
              value={
                [courtData.district, courtData.state]
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
            <StatBlock label="Filed on" value={fmtDate(courtData.filingDate)} />
            <StatBlock
              label="Registered"
              value={fmtDate(courtData.registrationDate)}
            />
            <StatBlock
              label="Decision"
              value={fmtDate(courtData.decisionDate)}
            />
            <StatBlock
              label="Next hearing"
              value={fmtDate(courtData.nextHearingDate)}
            />
          </View>
          {Array.isArray(courtData.actsAndSections) &&
          courtData.actsAndSections.length > 0 ? (
            <View style={styles.actsRow}>
              <Text style={styles.actsLabel}>Acts & sections</Text>
              <View style={styles.actsWrap}>
                {courtData.actsAndSections.map((a, i) => (
                  <View key={`${a}-${i}`} style={styles.actChip}>
                    <Text style={styles.actText} numberOfLines={1}>
                      {a}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Parties */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Parties & counsel</Text>
          <View style={{ gap: spacing.sm }}>
            <PartyList
              label="Petitioner(s)"
              items={courtData.petitioners}
            />
            <PartyList
              label="Respondent(s)"
              items={courtData.respondents}
            />
            <PartyList
              label="Petitioner's advocates"
              items={courtData.petitionerAdvocates}
            />
            <PartyList
              label="Respondent's advocates"
              items={courtData.respondentAdvocates}
            />
            <PartyList label="Judges" items={courtData.judges} />
          </View>
        </View>

        {/* Hearings */}
        {hearings.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              Hearing history ({hearings.length})
            </Text>
            {hearings.slice(0, 20).map((h, i) => (
              <View
                key={`${h.hearingDate || ''}-${i}`}
                style={styles.hearingItem}
              >
                <View style={styles.hearingDot}>
                  <Feather name="calendar" size={11} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hearingDate}>
                    {fmtDate(h.hearingDate || h.businessOnDate)}
                  </Text>
                  <Text style={styles.hearingPurpose} numberOfLines={2}>
                    {h.purposeOfListing || h.purpose || '—'}
                  </Text>
                  {h.judge ? (
                    <Text style={styles.hearingJudge} numberOfLines={1}>
                      Before {h.judge}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
            {hearings.length > 20 ? (
              <Text style={styles.moreNote}>
                +{hearings.length - 20} earlier hearings
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Orders & judgments */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            Orders & judgments ({interim.length + judgments.length})
          </Text>
          <Text style={styles.cardHint}>
            Downloads open a watermarked true-copy PDF in your browser.
          </Text>

          {downloadError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={12} color={colors.danger} />
              <Text style={styles.errorText}>{downloadError}</Text>
            </View>
          ) : null}

          {interim.length + judgments.length === 0 ? (
            <Text style={styles.noOrders}>
              No orders have been published for this case yet.
            </Text>
          ) : (
            <>
              {judgments.length > 0 ? (
                <>
                  <Text style={styles.subsection}>Judgments</Text>
                  {judgments.map((o, i) => (
                    <OrderRow
                      key={`j-${o.orderUrl}-${i}`}
                      order={o}
                      cnr={cnr}
                      downloading={downloading}
                      onDownload={handleDownload}
                      aiBusy={aiBusy}
                      onAi={handleAi}
                    />
                  ))}
                </>
              ) : null}
              {interim.length > 0 ? (
                <>
                  <Text style={styles.subsection}>Interim orders</Text>
                  {interim.map((o, i) => (
                    <OrderRow
                      key={`i-${o.orderUrl}-${i}`}
                      order={o}
                      cnr={cnr}
                      downloading={downloading}
                      onDownload={handleDownload}
                      aiBusy={aiBusy}
                      onAi={handleAi}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </View>

        <Text style={styles.attribution}>
          Powered By <Text style={styles.attrBrand}>E-CourtsIndia.com</Text>
        </Text>
      </ScrollView>

      {/* AI summary modal — opened from each order row */}
      <Modal
        visible={aiModal.open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAiModal((p) => ({ ...p, open: false }))}
      >
        <View style={styles.aiModalRoot}>
          <View style={styles.aiModalBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiModalEyebrow}>AI summary</Text>
              <Text style={styles.aiModalTitle} numberOfLines={1}>
                {aiModal.title}
              </Text>
            </View>
            <Pressable
              onPress={() => setAiModal((p) => ({ ...p, open: false }))}
              hitSlop={10}
              style={styles.aiModalClose}
            >
              <Feather name="x" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.aiModalBody}>
            {!aiModal.data && !aiModal.error ? (
              <View style={styles.aiLoadingBox}>
                <ActivityIndicator size="small" color="#7c3aed" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiLoadingTitle}>
                    Reading the order &amp; generating the summary…
                  </Text>
                  <Text style={styles.aiLoadingSub}>
                    First run takes 10–60 seconds. Repeat opens are instant.
                  </Text>
                </View>
              </View>
            ) : aiModal.error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={13} color={colors.danger} />
                <Text style={styles.errorText}>{aiModal.error}</Text>
              </View>
            ) : (
              <AiSummaryBody data={aiModal.data} />
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// AiSummaryBody — renders summary, outcome, relief, key points,
// statutes referenced. Falls back gracefully when the upstream payload
// omits fields. Markdown is rendered as plain text so we don't pull in
// a markdown library on mobile.
function AiSummaryBody({ data }) {
  const ai = (data && data.aiAnalysis) || {};
  const keyPoints = Array.isArray(ai.keyPoints) ? ai.keyPoints.filter(Boolean) : [];
  const statutes = Array.isArray(ai.statutes) ? ai.statutes.filter(Boolean) : [];
  const hasAny =
    ai.summary ||
    ai.outcome ||
    ai.relief ||
    keyPoints.length > 0 ||
    statutes.length > 0;
  return (
    <View style={{ gap: spacing.md }}>
      {ai.summary ? (
        <View>
          <Text style={styles.aiSectionLabel}>Summary</Text>
          <Text style={styles.aiBody}>{ai.summary}</Text>
        </View>
      ) : null}
      {ai.outcome ? (
        <View style={styles.aiOutcomeCard}>
          <Text style={styles.aiOutcomeLabel}>Outcome</Text>
          <Text style={styles.aiOutcomeText}>{ai.outcome}</Text>
        </View>
      ) : null}
      {ai.relief ? (
        <View>
          <Text style={styles.aiSectionLabel}>Relief granted</Text>
          <Text style={styles.aiBody}>{ai.relief}</Text>
        </View>
      ) : null}
      {keyPoints.length > 0 ? (
        <View>
          <Text style={styles.aiSectionLabel}>Key points</Text>
          {keyPoints.map((p, i) => (
            <View key={i} style={styles.aiBulletRow}>
              <Text style={styles.aiBullet}>•</Text>
              <Text style={[styles.aiBody, { flex: 1 }]}>{p}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {statutes.length > 0 ? (
        <View>
          <Text style={styles.aiSectionLabel}>Statutes referenced</Text>
          <View style={styles.aiChipRow}>
            {statutes.map((s, i) => (
              <View key={`${s}-${i}`} style={styles.aiChip}>
                <Text style={styles.aiChipText} numberOfLines={1}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {!hasAny && data && data.markdown ? (
        <View>
          <Text style={styles.aiSectionLabel}>Extracted text</Text>
          <Text style={styles.aiBody}>{data.markdown}</Text>
        </View>
      ) : null}
      {!hasAny && !(data && data.markdown) ? (
        <Text style={styles.aiBody}>
          E-Courts didn’t return AI fields for this order. Try downloading the
          PDF instead.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },

  skeleton: {
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },

  // Hero
  hero: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cnr: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  titleVs: { fontWeight: fontWeight.regular, color: colors.textMuted },
  titleAlt: { color: colors.textSecondary },
  statusBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPending: {
    backgroundColor: 'rgba(217,119,6,0.1)',
    borderColor: 'rgba(217,119,6,0.3)',
  },
  statusDisposed: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Save / saved CTA
  savedRow: { gap: 6 },
  saveBtn: { borderRadius: radius.md, overflow: 'hidden' },
  saveFill: {
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#fff' },
  savedPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    backgroundColor: 'rgba(16,185,129,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  savedText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
  inlineErr: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
  },

  // Card
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  cardHint: {
    marginTop: -6,
    marginBottom: spacing.sm,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  statLabel: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 2,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },

  // Acts
  actsRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actsLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  actsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  actChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    maxWidth: '100%',
  },
  actText: { fontSize: 10, color: colors.textSecondary, fontWeight: fontWeight.semibold },

  // Parties
  partyCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  partyLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  partyEmpty: { fontSize: fontSize.sm, color: colors.textMuted },
  partyName: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 19 },

  // Hearings
  hearingItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hearingDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearingDate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  hearingPurpose: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  hearingJudge: {
    marginTop: 2,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  moreNote: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: fontWeight.semibold,
  },

  // Orders
  subsection: {
    marginTop: spacing.sm,
    marginBottom: 6,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  orderMeta: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  orderMetaText: { fontSize: 10, color: colors.textMuted },
  orderFile: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  orderBtnCol: { alignItems: 'flex-end', gap: 6 },
  aiBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    backgroundColor: 'rgba(124,58,237,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
    justifyContent: 'center',
  },
  aiBtnText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#7c3aed',
    letterSpacing: 0.4,
  },
  downloadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
    justifyContent: 'center',
  },
  downloadText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },

  // AI modal — full sheet, lives on top of the case detail screen.
  aiModalRoot: { flex: 1, backgroundColor: colors.bg },
  aiModalBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  aiModalEyebrow: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#7c3aed',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  aiModalTitle: {
    marginTop: 2,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  aiModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiModalBody: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  aiLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  aiLoadingTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  aiLoadingSub: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  aiSectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  aiBody: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  aiOutcomeCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  aiOutcomeLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.success,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  aiOutcomeText: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  aiBulletRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  aiBullet: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 21,
  },
  aiChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aiChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    maxWidth: '100%',
  },
  aiChipText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  noOrders: {
    paddingVertical: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(220,38,38,0.08)',
    marginBottom: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
  },

  attribution: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
  attrBrand: { color: colors.primary, fontWeight: fontWeight.bold },

  // Auth gate
  gateCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  gateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gateBody: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  gateCnr: {
    marginTop: spacing.sm,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  gateCta: {
    marginTop: spacing.md,
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  gateCtaFill: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gateCtaText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: '#fff' },
  gateGhost: { marginTop: 8, paddingVertical: 10 },
  gateGhostText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
});
