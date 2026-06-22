'use client';

// CaseTasks — task list for one case. Lets the team capture, schedule
// and tick off the actionable bits of work that aren't notes (history)
// or updates (chronological narration). Backend ownership rules already
// gate creates/edits, so this component doesn't need to render
// conditionally for client-vs-pro — anyone with read access on the
// case sees the same list.
//
// Assignee selection lands with F3 (firm membership). For now every
// task is "owned by the case" and the team picks up unassigned work.

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import {
  listForCase,
  createForCase,
  updateForCase,
  deleteForCase,
  reorderForCase,
} from '@/services/caseTaskService';

const STATUS_META = {
  open: { label: 'Open', color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In progress', color: 'bg-blue-100 text-blue-800' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700' },
};

const PRIORITY_META = {
  low: { label: 'Low', color: 'text-slate-500' },
  normal: { label: 'Normal', color: 'text-slate-700' },
  high: { label: 'High', color: 'text-red-600 font-semibold' },
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isOverdue(dueDate, status) {
  if (!dueDate || status === 'done' || status === 'cancelled') return false;
  return String(dueDate).slice(0, 10) < todayStr();
}

export default function CaseTasks({ caseId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline-create form state.
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listForCase(caseId);
      setTasks(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createForCase(caseId, {
        title: newTitle.trim(),
        dueDate: newDueDate || undefined,
        priority: newPriority,
      });
      setNewTitle('');
      setNewDueDate('');
      setNewPriority('normal');
      setAdding(false);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  }

  async function patchTask(task, patch) {
    setBusyId(task.id);
    setError('');
    try {
      await updateForCase(caseId, task.id, patch);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to update task.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    setBusyId(task.id);
    setError('');
    try {
      await deleteForCase(caseId, task.id);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete task.');
    } finally {
      setBusyId(null);
    }
  }

  // Swap two tasks' positions via the reorder endpoint. Single network
  // round-trip — the endpoint accepts the full ordered list at once.
  async function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= tasks.length) return;
    const next = tasks.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setTasks(next); // optimistic
    try {
      await reorderForCase(
        caseId,
        next.map((t) => t.id)
      );
    } catch (err) {
      setError(err.message || 'Failed to reorder tasks.');
      await load();
    }
  }

  function cycleStatus(task) {
    // Quick-toggle: open → in_progress → done → open. Cancelled is a
    // less-common state, accessible via the inline status dropdown.
    const order = ['open', 'in_progress', 'done'];
    const idx = order.indexOf(task.status);
    const next = order[(idx + 1) % order.length];
    return patchTask(task, { status: next });
  }

  const openCount = tasks.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length;

  return (
    <Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
          <p className="text-xs text-slate-500">
            Action items for this case.{' '}
            <span className="font-medium text-slate-700">
              {openCount} open
            </span>{' '}
            of {tasks.length}.
          </p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Add task
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {adding && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs doing?"
            maxLength={200}
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600">
              Due&nbsp;
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="text-xs text-slate-600">
              Priority&nbsp;
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setNewTitle('');
                  setNewDueDate('');
                  setNewPriority('normal');
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={saving || !newTitle.trim()}
              >
                {saving ? 'Saving…' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="text-xs text-slate-400">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
            No tasks yet. Add the first one to break this case into actionable
            steps.
          </p>
        ) : (
          tasks.map((task, idx) => {
            const overdue = isOverdue(task.dueDate, task.status);
            const statusMeta = STATUS_META[task.status] || STATUS_META.open;
            const priorityMeta =
              PRIORITY_META[task.priority] || PRIORITY_META.normal;
            const isDone = task.status === 'done';
            const isCancelled = task.status === 'cancelled';

            return (
              <div
                key={task.id}
                className={[
                  'group flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors',
                  isDone || isCancelled
                    ? 'border-slate-200 bg-slate-50/60'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => cycleStatus(task)}
                  disabled={busyId === task.id}
                  className="mt-0.5 text-slate-400 hover:text-blue-600"
                  aria-label="Toggle status"
                  title={`Status: ${statusMeta.label} — click to advance`}
                >
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : task.status === 'in_progress' ? (
                    <Clock size={16} className="text-blue-600" />
                  ) : (
                    <Circle size={16} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p
                      className={[
                        'truncate text-sm',
                        isDone || isCancelled
                          ? 'text-slate-400 line-through'
                          : 'text-slate-800',
                      ].join(' ')}
                    >
                      {task.title}
                    </p>
                    <span
                      className={[
                        'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        statusMeta.color,
                      ].join(' ')}
                    >
                      {statusMeta.label}
                    </span>
                    {task.priority !== 'normal' && (
                      <span
                        className={`text-[10px] uppercase tracking-wide ${priorityMeta.color}`}
                      >
                        {priorityMeta.label}
                      </span>
                    )}
                  </div>
                  {task.dueDate && (
                    <p
                      className={[
                        'mt-0.5 inline-flex items-center gap-1 text-[11px]',
                        overdue
                          ? 'font-medium text-red-600'
                          : 'text-slate-500',
                      ].join(' ')}
                    >
                      <Calendar size={11} />
                      Due {String(task.dueDate).slice(0, 10)}
                      {overdue ? ' · overdue' : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || busyId === task.id}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === tasks.length - 1 || busyId === task.id}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <select
                    value={task.status}
                    onChange={(e) =>
                      patchTask(task, { status: e.target.value })
                    }
                    disabled={busyId === task.id}
                    className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-600"
                    aria-label="Set status"
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleDelete(task)}
                    disabled={busyId === task.id}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
