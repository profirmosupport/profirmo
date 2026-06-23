'use client';

// CaseAiClerk — floating AI assistant on the case detail page.
// The actual capability gate is the admin-configured Claude API
// key — when no key is set the backend returns 503 and we surface
// that error inline. (Earlier iterations hid the launcher behind a
// premium plan; that was rolled back so the only cost dial is the
// admin's API key.)
//
// Visual design: gradient bot button with a pulsing aura that
// breathes (CSS animation), a rotating tagline next to it cycling
// the four things the clerk can do — draws the eye without being
// obnoxious. Click expands a side panel with four actions:
//
//   1. Summarize the case
//   2. Suggest next step
//   3. Help (free prompt → save as update)
//   4. Analyse a document (pick from the case's client docs;
//      backend pulls from S3 + sends to Claude as a doc block)

import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Sparkles,
  ListChecks,
  Send,
  FileSearch,
  Upload,
  X,
  Save,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import {
  summarizeCase,
  suggestNextStep,
  aiPrompt,
  saveAiResponseAsUpdate,
  listAnalysableDocuments,
  analyseDocument,
  analyseUploadedDocument,
} from '@/services/caseAiService';
import { uploadFile } from '@/services/fileService';

// Taglines rotated next to the button to advertise what the clerk
// can do for the pro. Short imperative lines pair well with the
// pulse animation.
const TAGLINES = [
  'Summarise this case',
  'Suggest the next step',
  'Draft a notice reply',
  'Analyse a document',
];

export default function CaseAiClerk({ caseId, onChange }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [result, setResult] = useState('');
  const [resultMode, setResultMode] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  // Document picker state (Analyse Document mode).
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  // Hidden file input — driven by the "Upload new" button so the pro
  // can analyse a file off their disk without first stashing it in the
  // client's document bucket.
  const uploadInputRef = useRef(null);

  // When the user analyses a document we remember enough about the
  // source to attach it to the saved CaseUpdate. Two shapes:
  //   { kind: 'client-doc', storagePath, fileName, mimeType, size }
  //   { kind: 'upload',     file (File), fileName, mimeType, size }
  // For the 'upload' kind we defer the actual S3 write until the user
  // clicks Save-as-update — we don't want to keep a file the user
  // never persists.
  const [analyseSource, setAnalyseSource] = useState(null);

  // Rotating tagline index.
  const [tagIndex, setTagIndex] = useState(0);
  const tickRef = useRef(null);

  // Rotate tagline every 2.4s while the launcher is collapsed.
  useEffect(() => {
    if (open) return undefined;
    tickRef.current = setInterval(() => {
      setTagIndex((i) => (i + 1) % TAGLINES.length);
    }, 2400);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [open]);

  function reset() {
    setMode(null);
    setResult('');
    setResultMode(null);
    setInstruction('');
    setError('');
    setSavedAt(null);
    setAnalyseSource(null);
  }

  async function runSummary() {
    setMode('summary');
    setBusy(true);
    setError('');
    setResult('');
    try {
      const out = await summarizeCase(caseId);
      setResult(out.summary || '');
      setResultMode('summary');
      if (typeof onChange === 'function') onChange();
    } catch (err) {
      setError(err.message || 'Summary failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runSuggest() {
    setMode('next');
    setBusy(true);
    setError('');
    setResult('');
    try {
      const out = await suggestNextStep(caseId);
      setResult(out.suggestion || '');
      setResultMode('next');
    } catch (err) {
      setError(err.message || 'Could not generate next-step suggestions.');
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt() {
    if (!instruction.trim()) {
      setError('Type what you want help with first.');
      return;
    }
    setMode('help');
    setBusy(true);
    setError('');
    setResult('');
    try {
      const out = await aiPrompt(caseId, instruction.trim());
      setResult(out.response || '');
      setResultMode('help');
    } catch (err) {
      setError(err.message || 'Prompt failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openAnalyseDoc() {
    setMode('analyse');
    setResult('');
    setError('');
    setDocsLoading(true);
    try {
      const list = await listAnalysableDocuments(caseId);
      setDocs(list);
    } catch (err) {
      setError(err.message || 'Could not load documents.');
    } finally {
      setDocsLoading(false);
    }
  }

  async function runAnalyseDoc(doc) {
    setBusy(true);
    setError('');
    setResult('');
    setAnalyseSource(null);
    try {
      const out = await analyseDocument(caseId, doc.id);
      setResult(out.analysis || '');
      setResultMode('analyse');
      // Capture the storage key + display metadata so "Save as
      // update" can stitch the file onto the new timeline entry.
      setAnalyseSource({
        kind: 'client-doc',
        storagePath: out.storagePath || doc.storagePath || null,
        fileName: doc.fileName || doc.label || doc.docKey || 'Document',
        mimeType: doc.mimeType || out.mimeType || null,
        size: typeof doc.size === 'number' ? doc.size : null,
      });
    } catch (err) {
      setError(err.message || 'Document analysis failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadAndAnalyse(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    // Reset the input so the same filename can be re-picked after a failure.
    if (event && event.target) event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setResult('');
    setAnalyseSource(null);
    try {
      const out = await analyseUploadedDocument(caseId, file);
      setResult(out.analysis || '');
      setResultMode('analyse');
      // Hold onto the File blob so we can upload it to S3 only when
      // the pro actually saves the analysis as an update.
      setAnalyseSource({
        kind: 'upload',
        file,
        fileName: file.name || 'Upload',
        mimeType: file.type || null,
        size: typeof file.size === 'number' ? file.size : null,
      });
    } catch (err) {
      setError(err.message || 'Document analysis failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAsUpdate() {
    setBusy(true);
    setError('');
    try {
      let attachments;
      if (analyseSource && analyseSource.kind === 'client-doc' && analyseSource.storagePath) {
        attachments = [
          {
            url: analyseSource.storagePath,
            name: analyseSource.fileName,
            type: analyseSource.mimeType,
            size: analyseSource.size,
          },
        ];
      } else if (analyseSource && analyseSource.kind === 'upload' && analyseSource.file) {
        // Persist the uploaded file under the case's attachment
        // prefix only NOW — keeps S3 clean of files the pro looked
        // at but didn't keep.
        const stored = await uploadFile(analyseSource.file, 'case_note', { caseId });
        const key = stored && (stored.storedPath || stored.path || stored.url || stored.key);
        if (key) {
          attachments = [
            {
              url: key,
              name: analyseSource.fileName,
              type: analyseSource.mimeType,
              size: analyseSource.size,
            },
          ];
        }
      }
      const saveTitle =
        resultMode === 'analyse'
          ? 'AI document analysis'
          : resultMode === 'next'
            ? 'AI suggested next steps'
            : 'AI Clerk draft';
      await saveAiResponseAsUpdate(caseId, {
        title: saveTitle,
        body: result,
        attachments,
      });
      setSavedAt(new Date());
      // After save, drop the source — the file is now persisted
      // against the update, so a second save would create a
      // duplicate attachment.
      setAnalyseSource(null);
      if (typeof onChange === 'function') onChange();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher — gradient bot icon with a breathing aura + a
          rotating tagline pill to its left. The aura uses two layered
          ::before-style spans (ping + slow pulse) so the eye is
          drawn without being distracting. */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
          <span
            className="hidden rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-md ring-1 ring-indigo-100 sm:inline-flex"
            aria-hidden="true"
            key={tagIndex}
            style={{
              animation: 'aiClerkFadeIn 240ms ease-out',
            }}
          >
            {TAGLINES[tagIndex]}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="AI Clerk"
            className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-xl ring-4 ring-white transition hover:scale-105 hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-500"
          >
            <span className="absolute inset-0 -z-0 animate-ping rounded-full bg-violet-400/40" />
            <span className="absolute inset-0 -z-0 animate-pulse rounded-full bg-fuchsia-400/20" />
            <Bot size={26} className="relative z-10" />
          </button>

          {/* Tagline fade-in keyframes scoped inline so we don't need
              a global stylesheet edit. */}
          <style jsx>{`
            @keyframes aiClerkFadeIn {
              from { opacity: 0; transform: translateX(6px); }
              to   { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex w-[min(440px,calc(100vw-2rem))] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              {mode && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
                  title="Back"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <Bot size={18} />
              <p className="text-sm font-semibold">AI Clerk</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {!mode && (
            <div className="grid grid-cols-2 gap-2 p-3 text-xs">
              <ActionTile
                gradient="from-indigo-500 to-violet-500"
                icon={<Sparkles size={18} />}
                label="Summarize the case"
                blurb="6-10 sentence overview"
                onClick={runSummary}
              />
              <ActionTile
                gradient="from-emerald-500 to-teal-500"
                icon={<ListChecks size={18} />}
                label="Suggest next step"
                blurb="3-5 actions, prioritised"
                onClick={runSuggest}
              />
              <ActionTile
                gradient="from-amber-500 to-orange-500"
                icon={<Send size={18} />}
                label="Help / draft"
                blurb="Reply, application, email"
                onClick={() => setMode('help')}
              />
              <ActionTile
                gradient="from-rose-500 to-fuchsia-500"
                icon={<FileSearch size={18} />}
                label="Analyse document"
                blurb="Pick a PDF / image"
                onClick={openAnalyseDoc}
              />
            </div>
          )}

          <div className="max-h-[60vh] space-y-3 overflow-y-auto p-3 text-sm">
            {mode === 'help' && !result && (
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  What do you need?
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={4}
                  placeholder="e.g. Draft a reply to the 142(1) notice noting the assessment year and that the documents are attached."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={runPrompt}
                    disabled={busy || !instruction.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:bg-slate-300"
                  >
                    <Send size={12} />
                    {busy ? 'Drafting…' : 'Ask'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'analyse' && !result && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Pick a document
                  </p>
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
                  >
                    <Upload size={11} />
                    Upload new
                  </button>
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleUploadAndAnalyse}
                />
                {docsLoading ? (
                  <p className="text-xs text-slate-500">Loading documents…</p>
                ) : docs.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                    No documents stored against this case&apos;s client yet — use{' '}
                    <span className="font-semibold">Upload new</span> above to
                    analyse a one-off file without saving it.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {docs.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => runAnalyseDoc(d)}
                          disabled={busy}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs hover:border-rose-200 hover:bg-rose-50 disabled:opacity-60"
                        >
                          <span className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {d.fileName || d.label || d.docKey}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {d.docKey}
                              {d.financialYear ? ` · FY ${d.financialYear}` : ''}
                              {d.mimeType ? ` · ${d.mimeType}` : ''}
                            </p>
                          </span>
                          <FileSearch size={14} className="text-rose-500" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {busy && !result && (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw size={12} className="animate-spin" />
                Thinking…
              </p>
            )}

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            {result && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {resultMode === 'summary'
                    ? 'Case summary (saved)'
                    : resultMode === 'next'
                      ? 'Suggested next steps'
                      : resultMode === 'analyse'
                        ? 'Document analysis'
                        : 'AI Clerk draft'}
                </p>
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-800">
                  {result}
                </pre>
                {(resultMode === 'help' ||
                  resultMode === 'analyse' ||
                  resultMode === 'next') && (
                  <div className="flex items-center justify-end gap-2">
                    {savedAt && (
                      <span className="text-[11px] text-emerald-700">
                        Saved as update {savedAt.toLocaleTimeString()}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveAsUpdate}
                      disabled={busy || !result || !!savedAt}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Save size={12} />
                      Save as case update
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ActionTile({ gradient, icon, label, blurb, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-start gap-1 rounded-xl bg-gradient-to-br ${gradient} p-3 text-left text-white shadow-sm transition hover:scale-[1.02] hover:shadow-md`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
        {icon}
      </span>
      <span className="text-[12px] font-semibold leading-tight">{label}</span>
      <span className="text-[10px] font-medium text-white/85">{blurb}</span>
    </button>
  );
}
