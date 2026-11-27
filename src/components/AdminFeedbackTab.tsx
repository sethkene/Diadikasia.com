import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '../types';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from '../services/feedback';

interface AdminFeedbackTabProps {
  items: FeedbackItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onUpdateFeedback: (params: {
    feedbackId: number;
    status: FeedbackStatus;
    adminResponse: string;
    internalNote: string;
  }) => Promise<{ error?: string }>;
  selectedFeedbackId?: number | null;
  onSelectFeedbackId?: (id: number | null) => void;
}

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  received: 'bg-slate-100 text-slate-700 border-slate-200',
  under_review: 'bg-amber-50 text-amber-800 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  closed: 'bg-slate-200 text-slate-700 border-slate-300',
};

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminFeedbackTab: React.FC<AdminFeedbackTabProps> = ({
  items,
  loading = false,
  error = null,
  onRetry,
  onUpdateFeedback,
  selectedFeedbackId = null,
  onSelectFeedbackId,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    FeedbackCategory | 'all'
  >('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>(
    'all',
  );
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(
    null,
  );
  const activeId = selectedFeedbackId ?? internalSelectedId;

  const setActiveId = (id: number | null) => {
    setInternalSelectedId(id);
    onSelectFeedbackId?.(id);
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return `${item.referenceNumber} ${item.subject} ${item.message} ${
        item.submitterName || ''
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [items, categoryFilter, statusFilter, search]);

  const selectedItem = useMemo(() => {
    if (activeId !== null) {
      const found = items.find((i) => i.id === activeId);
      if (found) return found;
    }
    return filteredItems[0] || null;
  }, [activeId, items, filteredItems]);

  const [draftStatus, setDraftStatus] = useState<FeedbackStatus>('received');
  const [draftResponse, setDraftResponse] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saveOk, setSaveOk] = useState('');

  useEffect(() => {
    if (selectedItem) {
      setDraftStatus(selectedItem.status);
      setDraftResponse(selectedItem.adminResponse || '');
      setDraftNote('');
      setSaveErr('');
      setSaveOk('');
    }
  }, [selectedItem?.id]);

  const counts = useMemo(() => {
    let received = 0;
    let underReview = 0;
    let resolvedOrClosed = 0;
    for (const item of items) {
      if (item.status === 'received') received += 1;
      else if (item.status === 'under_review') underReview += 1;
      else resolvedOrClosed += 1;
    }
    return {
      total: items.length,
      received,
      underReview,
      resolvedOrClosed,
    };
  }, [items]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || saving) return;
    setSaving(true);
    setSaveErr('');
    setSaveOk('');
    try {
      const res = await onUpdateFeedback({
        feedbackId: selectedItem.id,
        status: draftStatus,
        adminResponse: draftResponse,
        internalNote: draftNote,
      });
      if (res.error) {
        setSaveErr(res.error);
        return;
      }
      setDraftNote('');
      setSaveOk('Feedback updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-500">
            Total submissions
          </div>
          <div className="font-display font-bold text-xl text-slate-900 mt-1 tabular-nums">
            {counts.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-500">Received</div>
          <div className="font-display font-bold text-xl text-slate-900 mt-1 tabular-nums">
            {counts.received}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-500">
            Under Review
          </div>
          <div className="font-display font-bold text-xl text-amber-700 mt-1 tabular-nums">
            {counts.underReview}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-500">
            Resolved / Closed
          </div>
          <div className="font-display font-bold text-xl text-emerald-700 mt-1 tabular-nums">
            {counts.resolvedOrClosed}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference number (FDK-...) or subject"
            className="w-full border border-slate-300 bg-white rounded-xl pl-9 pr-3.5 py-2 min-h-[40px] text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as FeedbackCategory | 'all')
          }
          className="border border-slate-300 bg-white rounded-xl px-3 py-2 min-h-[40px] text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All categories</option>
          {(
            Object.entries(FEEDBACK_CATEGORY_LABELS) as Array<
              [FeedbackCategory, string]
            >
          ).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as FeedbackStatus | 'all')
          }
          className="border border-slate-300 bg-white rounded-xl px-3 py-2 min-h-[40px] text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All statuses</option>
          {(
            Object.entries(FEEDBACK_STATUS_LABELS) as Array<
              [FeedbackStatus, string]
            >
          ).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-white border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <span className="text-xs text-red-800">{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-teal-700 hover:underline shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-500">
          Loading feedback submissions…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="font-bold text-sm text-slate-900">
            No matching feedback submissions
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {items.length === 0
              ? 'Submissions from learners, instructors, and staff appear here.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Submission List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pr-0.5">
            {filteredItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-600">
                      {item.referenceNumber}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_BADGE[item.status]}`}
                    >
                      {FEEDBACK_STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <div className="font-display font-bold text-sm text-slate-900 mt-1.5 line-clamp-1">
                    {item.subject}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{FEEDBACK_CATEGORY_LABELS[item.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {item.isAnonymous
                        ? 'Anonymous'
                        : item.submitterName || 'Confidential'}
                    </span>
                    {item.attachmentPath && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-0.5 text-teal-700 font-medium">
                          <ImageIcon className="w-3 h-3" />
                          Image
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Submission Detail & Response Panel */}
          <div className="lg:col-span-7">
            {selectedItem && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {selectedItem.referenceNumber}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${STATUS_BADGE[selectedItem.status]}`}
                      >
                        {FEEDBACK_STATUS_LABELS[selectedItem.status]}
                      </span>
                      {selectedItem.category === 'safety' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Safety concern
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-base text-slate-900 mt-2">
                      {selectedItem.subject}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {FEEDBACK_CATEGORY_LABELS[selectedItem.category]} ·
                      Submitted {formatTimestamp(selectedItem.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Submitter Identity Box */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 flex-wrap">
                  {selectedItem.isAnonymous ? (
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Anonymous submission — submitter identity was not
                        recorded.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-slate-500">Submitted by:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {selectedItem.submitterName || 'Diadikasia Member'}
                      </span>
                      {selectedItem.submitterEmail && (
                        <span className="text-slate-500">
                          {' '}
                          ({selectedItem.submitterEmail})
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500">
                    Updated {formatTimestamp(selectedItem.updatedAt)}
                  </div>
                </div>

                {/* Message Body */}
                <div className="rounded-xl border border-slate-200 p-3.5 bg-white">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Message
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                    {selectedItem.message}
                  </p>
                </div>

                {/* Private Attachment Viewer */}
                {selectedItem.attachmentPath && (
                  <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        Attachment: {selectedItem.attachmentName || 'Screenshot'}
                      </span>
                      {selectedItem.attachmentUrl && (
                        <a
                          href={selectedItem.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                        >
                          <span>Open full image</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {selectedItem.attachmentUrl ? (
                      <img
                        src={selectedItem.attachmentUrl}
                        alt={selectedItem.attachmentName || 'Feedback attachment'}
                        className="max-h-64 rounded-lg border border-slate-200 object-contain bg-white"
                      />
                    ) : (
                      <p className="text-xs text-slate-500">
                        Signed preview unavailable.
                      </p>
                    )}
                  </div>
                )}

                {/* Dates summary */}
                {(selectedItem.respondedAt || selectedItem.resolvedAt) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    {selectedItem.respondedAt && (
                      <span>
                        Last responded:{' '}
                        {formatTimestamp(selectedItem.respondedAt)}
                      </span>
                    )}
                    {selectedItem.resolvedAt && (
                      <span>
                        Resolved: {formatTimestamp(selectedItem.resolvedAt)}
                      </span>
                    )}
                  </div>
                )}

                {/* Response & Status Form */}
                <form
                  onSubmit={handleSave}
                  className="pt-3 border-t border-slate-200 space-y-3"
                >
                  {saveErr && (
                    <p className="text-xs font-medium text-red-700" role="alert">
                      {saveErr}
                    </p>
                  )}
                  {saveOk && (
                    <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{saveOk}</span>
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="admin-fb-status"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Status
                      </label>
                      <select
                        id="admin-fb-status"
                        value={draftStatus}
                        onChange={(e) =>
                          setDraftStatus(e.target.value as FeedbackStatus)
                        }
                        disabled={saving}
                        className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 min-h-[40px] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {(
                          Object.entries(FEEDBACK_STATUS_LABELS) as Array<
                            [FeedbackStatus, string]
                          >
                        ).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-fb-response"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Official response (visible to submitter for confidential
                      reports)
                    </label>
                    <textarea
                      id="admin-fb-response"
                      rows={3}
                      value={draftResponse}
                      onChange={(e) => setDraftResponse(e.target.value)}
                      disabled={saving}
                      placeholder={
                        selectedItem.isAnonymous
                          ? 'Optional summary for record (anonymous submitters do not receive account notifications)'
                          : 'Write a clear, helpful update for the submitter...'
                      }
                      className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-fb-note"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Add private internal administrative note (hidden from
                      learners & sub-admins)
                    </label>
                    <textarea
                      id="admin-fb-note"
                      rows={2}
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      disabled={saving}
                      maxLength={2000}
                      placeholder="Internal triage or investigation note..."
                      className="w-full border border-slate-300 bg-slate-50 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[40px] transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving…' : 'Save status & response'}</span>
                  </button>
                </form>

                {/* Internal Administrative Notes History */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      Private internal notes (
                      {selectedItem.internalNotes?.length || 0})
                    </span>
                  </div>
                  {selectedItem.internalNotes &&
                  selectedItem.internalNotes.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                      {selectedItem.internalNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-800">
                              {note.authorName}
                            </span>
                            <span>
                              {FEEDBACK_STATUS_LABELS[note.statusAtTime]} ·{' '}
                              {formatTimestamp(note.createdAt)}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap break-words">
                            {note.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No internal administrative notes recorded yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
