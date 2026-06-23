'use client';

// CaseAiClerk — floating-button AI assistant on the case detail
// page. Sits bottom-left as a small bot icon; clicking expands a
// side panel with four actions:
//
//   1. Summarize the case  → POSTs /ai/summarize, server persists
//      the result on Case.aiSummary (visible to client + pro).
//   2. Suggest next step    → POSTs /ai/suggest-next-step.
//   3. Help                 → free-prompt textarea; response can be
//      saved as a CaseUpdate via /ai/save-as-update.
//   4. Analyse a document   → placeholder (PDF extraction lands in
//      a future iteration).
//
// Only the assigned professional can press these — the backend
// gates on case access (caseService.userCanAccessCase) implicitly
// via the AI service. Clients see the persisted aiSummary via the
// case header, but no clerk button is offered.

import { useState } from 'react';
import {
  Bot,
  Sparkles,
  ListChecks,
  Send,
  FileSearch,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  summarizeCase,
  suggestNextStep,
  aiPrompt,
  saveAiResponseAsUpdate,
} from '@/services/caseAiService';

export default function CaseAiClerk({ caseId, onChange }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // 'summary' | 'next' | 'help'
  const [result, setResult] = useState('');
  const [resultMode, setResultMode] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  function reset() {
    setMode(null);
    setResult('');
    setResultMode(null);
    setInstruction('');
    setError('');
    setSavedAt(null);
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

  async function handleSaveAsUpdate() {
    setBusy(true);
    setError('');
    try {
      await saveAiResponseAsUpdate(caseId, {
        title: 'AI Clerk draft',
        body: result,
      });
      setSavedAt(new Date());
      if (typeof onChange === 'function') onChange();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating launcher — bottom-right so it stays clear of the
          dashboard sidebar (which fixes itself at left:0, z-30 and
          would otherwise sit on top of the button). z-40 keeps it
          above any sticky sub-headers. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="AI Clerk"
          className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg ring-4 ring-white transition hover:from-indigo-500 hover:to-violet-500"
        >
          <Bot size={22} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex w-[min(420px,calc(100vw-2rem))] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
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

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3 text-xs">
            <ActionButton
              icon={<Sparkles size={14} />}
              label="Summarize the case"
              disabled={busy}
              onClick={runSummary}
              active={mode === 'summary'}
            />
            <ActionButton
              icon={<ListChecks size={14} />}
              label="Suggest next step"
              disabled={busy}
              onClick={runSuggest}
              active={mode === 'next'}
            />
            <ActionButton
              icon={<Send size={14} />}
              label="Help (free prompt)"
              disabled={busy}
              onClick={() => {
                setMode('help');
                setResult('');
                setResultMode(null);
                setError('');
              }}
              active={mode === 'help'}
            />
            <ActionButton
              icon={<FileSearch size={14} />}
              label="Analyse document"
              disabled
              title="Coming soon — PDF analysis lands in v2"
            />
          </div>

          {/* Body */}
          <div className="max-h-[60vh] space-y-3 overflow-y-auto p-3 text-sm">
            {mode === 'help' && (
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  What do you need?
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
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
                      : 'AI Clerk draft'}
                </p>
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-800">
                  {result}
                </pre>
                {resultMode === 'help' && (
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

function ActionButton({ icon, label, onClick, disabled, active, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={[
        'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-medium transition',
        active
          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
          : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}
