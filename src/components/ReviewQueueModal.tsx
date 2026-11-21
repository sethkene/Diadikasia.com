import React, { useState } from 'react';
import { Check, Play } from 'lucide-react';
import { REVIEW_CHECKLIST } from '../data/seed';
import type { SubmissionItem, SubmissionStatus } from '../types';
import { getProcedureGradient } from '../utils/format';

interface ReviewQueueModalProps {
  queue: SubmissionItem[];
  onToggleCheck: (submissionId: number, checkIndex: number) => void;
  onChangeNote: (submissionId: number, note: string) => void;
  onDecide: (
    submissionId: number,
    decision: Exclude<SubmissionStatus, 'pending'>,
  ) => void;
  onClose: () => void;
}

const DECIDED_LABELS: Record<Exclude<SubmissionStatus, 'pending'>, string> = {
  ok: 'Published',
  chg: 'Changes requested',
  rej: 'Not published',
};

export const ReviewQueueModal: React.FC<ReviewQueueModalProps> = ({
  queue,
  onToggleCheck,
  onChangeNote,
  onDecide,
  onClose,
}) => {
  const [failedIds, setFailedIds] = useState<Set<number>>(() => new Set());
  const pending = queue.filter((q) => q.status === 'pending');
  const decided = queue.filter((q) => q.status !== 'pending');

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Review queue"
    >
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-teal-600 hover:text-teal-700 min-h-[44px] px-2 -ml-2"
          >
            Close
          </button>
          <span className="font-display font-bold text-sm text-slate-900">
            Review queue
          </span>
          <span className="w-12" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-16 space-y-5">
        <p className="text-sm text-slate-600 tabular-nums">
          {pending.length} waiting for review. Nothing is published until a
          reviewer approves it.
        </p>

        {pending.length > 0 ? (
          pending.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
            >
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  {item.title}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  {item.instructor} · {item.organization}
                </div>
                <div className="text-xs text-teal-700 font-medium mt-1.5">
                  {item.discipline === 'nursing' ? 'Nursing' : 'Surgical'} ·{' '}
                  {item.category} · {item.region}
                </div>
              </div>

              {item.url && !failedIds.has(item.id) ? (
                <video
                  src={item.url}
                  controls
                  playsInline
                  onError={() =>
                    setFailedIds((prev) => new Set(prev).add(item.id))
                  }
                  className="w-full rounded-xl bg-black max-h-64"
                />
              ) : (
                <div
                  className="aspect-video rounded-xl flex items-center justify-center text-white"
                  style={{
                    background: getProcedureGradient((item.id * 47) % 360),
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-white/90 text-slate-900 flex items-center justify-center">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Draft step guide
                </div>
                <div className="space-y-1 text-sm text-slate-700">
                  {item.steps.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-mono tabular-nums text-xs text-slate-400 mt-0.5">
                        {i + 1}.
                      </span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Contributor confirmed
                </div>
                <div className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Owns the rights or has permission to share
                </div>
                <div className="text-xs font-medium text-emerald-700 flex items-center gap-1.5 mt-1">
                  <Check className="w-3.5 h-3.5" />
                  No identifiable patient, or written consent held
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Reviewer checklist
                </div>
                <div className="space-y-2">
                  {REVIEW_CHECKLIST.map((label, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(item.checks[idx])}
                        onChange={() => onToggleCheck(item.id, idx)}
                        className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor={`review-note-${item.id}`}
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Note to the contributor
                </label>
                <input
                  id={`review-note-${item.id}`}
                  type="text"
                  value={item.note}
                  onChange={(e) => onChangeNote(item.id, e.target.value)}
                  placeholder="Required to request changes or reject"
                  className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {item.err && (
                <p className="text-xs font-medium text-red-700" role="alert">
                  {item.err}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onDecide(item.id, 'ok')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs min-h-[44px] transition-colors"
                >
                  Approve and publish
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(item.id, 'chg')}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs min-h-[44px] transition-colors"
                >
                  Request changes
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(item.id, 'rej')}
                  className="py-2.5 px-3 rounded-xl border border-red-600 bg-white hover:bg-red-50 text-red-700 font-semibold text-xs min-h-[44px] transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="font-bold text-slate-900">Nothing waiting</div>
            <p className="text-sm text-slate-600 mt-1">
              New submissions appear here.
            </p>
          </div>
        )}

        {decided.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Decided
            </h3>
            {decided.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-4"
              >
                <div className="font-semibold text-sm text-slate-900">
                  {item.title}
                </div>
                <div className="mt-1.5">
                  <span
                    className={`text-xs font-bold ${
                      item.status === 'ok'
                        ? 'text-emerald-700'
                        : item.status === 'rej'
                        ? 'text-red-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {
                      DECIDED_LABELS[
                        item.status as Exclude<SubmissionStatus, 'pending'>
                      ]
                    }
                  </span>
                </div>
                {item.note && (
                  <p className="text-xs text-slate-600 mt-1.5">{item.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
