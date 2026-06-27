// CaseAiClerk — mobile mirror of the web's floating AI assistant. Four
// actions drive the panel: summarize the case, suggest a next step,
// free-form prompt and document analysis (case-attached doc OR upload-
// only one-shot file). All AI calls route through services/caseAiService.
//
// "Analyse uploaded" deliberately keeps the file in memory until the
// pro chooses Save as update — only then does the upload land in S3
// and the AI response is saved as a CaseUpdate with that attachment.
// Same contract the web honours so case-files stay tidy.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  aiPrompt,
  analyseDocument,
  analyseUploadedDocument,
  listAnalysableDocuments,
  saveAiResponseAsUpdate,
  suggestNextStep,
  summarizeCase,
} from '../../services/caseAiService';
import { uploadFile } from '../../services/uploadService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const MODES = {
  HOME: 'home',
  SUMMARIZE: 'summarize',
  NEXT_STEP: 'next-step',
  PROMPT: 'prompt',
  ANALYSE: 'analyse',
};

export default function CaseAiClerk({ caseId, visible, onClose, onSaved }) {
  const [mode, setMode] = useState(MODES.HOME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [resultMode, setResultMode] = useState(null);

  // Free-prompt input.
  const [instruction, setInstruction] = useState('');

  // Document analysis state.
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Source the user picked, so Save-as-update can attach the file.
  // Two shapes mirror the web:
  //   { kind: 'client-doc', storagePath, fileName, mimeType?, size? }
  //   { kind: 'upload', file: {uri,name,type}, fileName, mimeType?, size? }
  const [analyseSource, setAnalyseSource] = useState(null);

  // Set when a "Save as update" lands; locks the result + flips the
  // CTA so a second tap can't create a duplicate update.
  const [savedAt, setSavedAt] = useState(null);

  const reset = useCallback(() => {
    setMode(MODES.HOME);
    setBusy(false);
    setError('');
    setResult('');
    setResultMode(null);
    setInstruction('');
    setAnalyseSource(null);
    setSavedAt(null);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  function close() {
    if (busy) return;
    reset();
    onClose?.();
  }

  async function runSummarize() {
    setError('');
    setBusy(true);
    setResultMode('summarize');
    try {
      const out = await summarizeCase(caseId);
      setResult(extractText(out));
      setMode(MODES.SUMMARIZE);
    } catch (err) {
      setError(err?.message || 'Could not run the summary.');
    } finally {
      setBusy(false);
    }
  }

  async function runSuggestNextStep() {
    setError('');
    setBusy(true);
    setResultMode('next-step');
    try {
      const out = await suggestNextStep(caseId);
      setResult(extractText(out));
      setMode(MODES.NEXT_STEP);
    } catch (err) {
      setError(err?.message || 'Could not suggest a next step.');
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt() {
    const text = instruction.trim();
    if (!text) {
      setError('Enter a question or instruction first.');
      return;
    }
    setError('');
    setBusy(true);
    setResultMode('prompt');
    try {
      const out = await aiPrompt(caseId, text);
      setResult(extractText(out));
      setMode(MODES.PROMPT);
    } catch (err) {
      setError(err?.message || 'Could not run the prompt.');
    } finally {
      setBusy(false);
    }
  }

  async function openAnalyseList() {
    setMode(MODES.ANALYSE);
    setError('');
    setDocsLoading(true);
    try {
      const rows = await listAnalysableDocuments(caseId);
      setDocs(rows || []);
    } catch (err) {
      setError(err?.message || 'Could not load documents.');
    } finally {
      setDocsLoading(false);
    }
  }

  async function runAnalyseDoc(doc) {
    if (!doc) return;
    setError('');
    setBusy(true);
    setResultMode('analyse');
    try {
      const out = await analyseDocument(caseId, doc.id);
      setResult(extractText(out));
      setAnalyseSource({
        kind: 'client-doc',
        storagePath: doc.storagePath || doc.url || doc.storage_path,
        fileName: doc.name || doc.fileName,
        mimeType: doc.mimeType,
        size: doc.size,
      });
    } catch (err) {
      setError(err?.message || 'Could not analyse this document.');
      setAnalyseSource(null);
    } finally {
      setBusy(false);
    }
  }

  async function pickAndAnalyseUploaded() {
    setError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(
          'Allow Photos access to upload a document for analysis.'
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsMultipleSelection: false,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const file = {
        uri: asset.uri,
        name: asset.fileName || `upload-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      };
      setBusy(true);
      setResultMode('analyse');
      const out = await analyseUploadedDocument(caseId, file);
      setResult(extractText(out));
      setAnalyseSource({
        kind: 'upload',
        file,
        fileName: file.name,
        mimeType: file.type,
        size: asset.fileSize,
      });
    } catch (err) {
      setError(err?.message || 'Could not analyse the uploaded file.');
      setAnalyseSource(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveAsUpdate() {
    if (busy || !result || savedAt) return;
    setBusy(true);
    setError('');
    try {
      let attachments;
      if (
        analyseSource &&
        analyseSource.kind === 'client-doc' &&
        analyseSource.storagePath
      ) {
        attachments = [
          {
            url: analyseSource.storagePath,
            name: analyseSource.fileName,
            type: analyseSource.mimeType,
            size: analyseSource.size,
          },
        ];
      } else if (
        analyseSource &&
        analyseSource.kind === 'upload' &&
        analyseSource.file
      ) {
        // The uploaded file was only OCR'd in memory; persist it now
        // so the saved update keeps the source document attached.
        const stored = await uploadFile({
          ...analyseSource.file,
          category: 'case_note',
          caseId,
        });
        const url = stored && (stored.url || stored.publicUrl || stored.path);
        if (url) {
          attachments = [
            {
              url,
              name: analyseSource.fileName,
              type: analyseSource.mimeType,
              size: analyseSource.size,
            },
          ];
        }
      }
      const title =
        resultMode === 'analyse'
          ? 'AI Clerk · Document analysis'
          : resultMode === 'summarize'
            ? 'AI Clerk · Case summary'
            : resultMode === 'next-step'
              ? 'AI Clerk · Next step'
              : 'AI Clerk · Note';
      await saveAiResponseAsUpdate(caseId, {
        title,
        body: result,
        attachments,
      });
      setSavedAt(new Date());
      onSaved?.();
    } catch (err) {
      setError(err?.message || 'Could not save as update.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Feather name="zap" size={14} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>AI Clerk</Text>
              <Text style={styles.subtitle}>
                Summarize · Plan next steps · Draft · Analyse documents
              </Text>
            </View>
            <Pressable onPress={close} disabled={busy} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={11} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {busy && !result ? (
            <View style={styles.busyBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.busyText}>Working…</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyInner}
            keyboardShouldPersistTaps="handled"
          >
            {mode === MODES.HOME ? (
              <HomePane
                onSummarize={runSummarize}
                onNextStep={runSuggestNextStep}
                onPrompt={() => setMode(MODES.PROMPT)}
                onAnalyse={openAnalyseList}
                disabled={busy}
              />
            ) : null}

            {mode === MODES.PROMPT && !result ? (
              <PromptPane
                value={instruction}
                onChange={setInstruction}
                onBack={() => setMode(MODES.HOME)}
                onSubmit={runPrompt}
                busy={busy}
              />
            ) : null}

            {mode === MODES.ANALYSE && !result ? (
              <AnalysePane
                docs={docs}
                loading={docsLoading}
                onBack={() => setMode(MODES.HOME)}
                onAnalyseDoc={runAnalyseDoc}
                onUpload={pickAndAnalyseUploaded}
                busy={busy}
              />
            ) : null}

            {result ? (
              <ResultPane
                title={resultTitle(resultMode)}
                body={result}
                savedAt={savedAt}
                busy={busy}
                onBack={() => {
                  setResult('');
                  setResultMode(null);
                  setAnalyseSource(null);
                  setSavedAt(null);
                  setMode(MODES.HOME);
                }}
                onSave={saveAsUpdate}
              />
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function HomePane({ onSummarize, onNextStep, onPrompt, onAnalyse, disabled }) {
  return (
    <View style={styles.tileGrid}>
      <Tile
        icon="file-text"
        label="Summarize the case"
        blurb="One-paragraph snapshot of where this case stands."
        onPress={onSummarize}
        disabled={disabled}
      />
      <Tile
        icon="flag"
        label="Suggest next step"
        blurb="Up to five prioritised action items."
        onPress={onNextStep}
        disabled={disabled}
      />
      <Tile
        icon="message-square"
        label="Help / draft"
        blurb="Ask anything — drafts, summaries, checklists."
        onPress={onPrompt}
        disabled={disabled}
      />
      <Tile
        icon="upload"
        label="Analyse a document"
        blurb="OCR + analysis of a case file or one-off upload."
        onPress={onAnalyse}
        disabled={disabled}
      />
    </View>
  );
}

function Tile({ icon, label, blurb, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        { opacity: disabled ? 0.5 : pressed ? 0.94 : 1 },
      ]}
    >
      <View style={styles.tileIcon}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileBlurb}>{blurb}</Text>
    </Pressable>
  );
}

function PromptPane({ value, onChange, onBack, onSubmit, busy }) {
  return (
    <View style={{ gap: spacing.md }}>
      <BackRow label="Help / draft" onBack={onBack} />
      <Text style={styles.paneSub}>
        Tell the AI Clerk what you want. Examples: "Draft a reminder
        email to the client", "What strikes you as risky here?",
        "Outline a hearing prep checklist".
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Type your instruction…"
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={styles.promptInput}
      />
      <Pressable
        onPress={onSubmit}
        disabled={busy}
        style={({ pressed }) => [
          styles.primaryBtn,
          { opacity: busy ? 0.7 : pressed ? 0.94 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Feather name="send" size={12} color="#ffffff" />
        )}
        <Text style={styles.primaryBtnText}>
          {busy ? 'Working…' : 'Run'}
        </Text>
      </Pressable>
    </View>
  );
}

function AnalysePane({ docs, loading, onBack, onAnalyseDoc, onUpload, busy }) {
  return (
    <View style={{ gap: spacing.md }}>
      <BackRow label="Analyse a document" onBack={onBack} />
      <Text style={styles.paneSub}>
        Pick one of the case's attachments to analyse, or upload a one-
        off file. Uploaded files are only stored if you save the
        analysis as an update.
      </Text>
      <Pressable
        onPress={onUpload}
        disabled={busy}
        style={({ pressed }) => [
          styles.secondaryBtn,
          { opacity: busy ? 0.6 : pressed ? 0.94 : 1 },
        ]}
      >
        <Feather name="upload" size={12} color={colors.primary} />
        <Text style={styles.secondaryBtnText}>Upload from device</Text>
      </Pressable>
      <View style={styles.divider} />
      <Text style={styles.paneSubHeader}>Case documents</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : docs.length === 0 ? (
        <Text style={styles.muted}>No analysable documents on this case yet.</Text>
      ) : (
        docs.map((doc) => (
          <Pressable
            key={doc.id}
            onPress={() => onAnalyseDoc(doc)}
            disabled={busy}
            style={({ pressed }) => [
              styles.docRow,
              { opacity: busy ? 0.6 : pressed ? 0.94 : 1 },
            ]}
          >
            <Feather name="file" size={14} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.docName} numberOfLines={1}>
                {doc.name || 'Document'}
              </Text>
              {doc.source ? (
                <Text style={styles.docMeta}>{doc.source}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={14} color={colors.textMuted} />
          </Pressable>
        ))
      )}
    </View>
  );
}

function ResultPane({ title, body, savedAt, busy, onBack, onSave }) {
  return (
    <View style={{ gap: spacing.md }}>
      <BackRow label={title} onBack={onBack} />
      <View style={styles.resultBody}>
        <Text style={styles.resultText} selectable>
          {body}
        </Text>
      </View>
      {savedAt ? (
        <Text style={styles.savedNote}>
          Saved as case update at {savedAt.toLocaleTimeString()}.
        </Text>
      ) : null}
      <Pressable
        onPress={onSave}
        disabled={busy || !!savedAt}
        style={({ pressed }) => [
          styles.primaryBtn,
          { opacity: busy || savedAt ? 0.55 : pressed ? 0.94 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Feather name="save" size={12} color="#ffffff" />
        )}
        <Text style={styles.primaryBtnText}>
          {savedAt ? 'Saved' : busy ? 'Saving…' : 'Save as case update'}
        </Text>
      </Pressable>
    </View>
  );
}

function BackRow({ label, onBack }) {
  return (
    <View style={styles.backRow}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
        <Feather name="chevron-left" size={14} color={colors.textSecondary} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.paneTitle}>{label}</Text>
    </View>
  );
}

function resultTitle(resultMode) {
  switch (resultMode) {
    case 'summarize':
      return 'Case summary';
    case 'next-step':
      return 'Suggested next step';
    case 'analyse':
      return 'Document analysis';
    default:
      return 'AI Clerk';
  }
}

function extractText(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.body === 'string') return payload.body;
  if (typeof payload.summary === 'string') return payload.summary;
  if (Array.isArray(payload.steps)) {
    return payload.steps
      .map((s, i) => {
        const title = s.title ? `${s.title}\n` : '';
        const body = s.body || s.detail || '';
        return `${i + 1}. ${title}${body}`.trim();
      })
      .join('\n\n');
  }
  if (Array.isArray(payload)) {
    return payload
      .map((s) => (typeof s === 'string' ? s : s.text || s.body || ''))
      .join('\n\n');
  }
  // Fall back to JSON so the user at least sees something.
  return JSON.stringify(payload, null, 2);
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: '70%',
    maxHeight: '92%',
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
  subtitle: {
    marginTop: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
  body: { flex: 1 },
  bodyInner: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  errorBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: { flex: 1, fontSize: 12, color: '#b91c1c' },
  busyBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  busyText: { fontSize: 12, color: colors.textSecondary },

  tileGrid: { gap: spacing.sm },
  tile: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  tileBlurb: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  paneTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  paneSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  paneSubHeader: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  muted: { fontSize: 12, color: colors.textMuted },

  promptInput: {
    minHeight: 100,
    maxHeight: 220,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  docName: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  docMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  resultBody: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  resultText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  savedNote: {
    fontSize: 11,
    color: '#047857',
    fontWeight: fontWeight.semibold,
  },
});
