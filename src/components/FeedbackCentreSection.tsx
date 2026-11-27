import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Lock,
  MessageSquarePlus,
  Send,
  X,
} from 'lucide-react';
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '../types';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  validateFeedbackAttachment,
  validateFeedbackDraft,
} from '../services/feedback';

interface FeedbackCentreSectionProps {
  items: FeedbackItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSubmit: (params: {
    category: FeedbackCategory;
    subject: string;
    message: string;
    isAnonymous: boolean;
    file?: File | null;
  }) => Promise<{ item?: FeedbackItem; error?: string }>;
  highlightedFeedbackId?: number | null;
  onClearHighlight?: () => void;
}

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  received: 'bg-slate-100 text-slate-700 border-slate-200',
  under_review: 'bg-amber-50 text-amber-800 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-300',
};

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const FeedbackCentreSection: React.FC<FeedbackCentreSectionProps> = ({
  items,
  loading = false,
  error = null,
  onRetry,
  onSubmit,
  highlightedFeedbackId = null,
  onClearHighlight,
}) => {
  const [view, setView] = useState<'form' | 'history'>('form');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [category, setCategory] = useState<FeedbackCategory>('suggestions');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [formErr, setFormErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedItem, setConfirmedItem] = useState<FeedbackItem | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (highlightedFeedbackId) {
      setExpanded(true);
      setView('history');
      setSelectedHistoryId(highlightedFeedbackId);
    }
  }, [highlightedFeedbackId]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [previewUrl]);

  const handlePickFile = (picked: File) => {
    const fileErr = validateFeedbackAttachment(picked);
    if (fileErr) {
      setFormErr(fileErr);
      return;
    }
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // ignore
      }
    }
    let nextUrl = '';
    try {
      nextUrl = URL.createObjectURL(picked);
    } catch {
      nextUrl = '';
    }
    setFile(picked);
    setPreviewUrl(nextUrl);
    setFormErr('');
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // ignore
      }
    }
    setFile(null);
    setPreviewUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validationErr = validateFeedbackDraft({
      category,
      subject,
      message,
    });
    if (validationErr) {
      setFormErr(validationErr);
      return;
    }

    setSubmitting(true);
    setFormErr('');
    try {
      const res = await onSubmit({
        category,
        subject: subject.trim(),
        message: message.trim(),
        isAnonymous,
        file,
      });
      if (res.error || !res.item) {
        setFormErr(res.error || 'Unable to submit feedback.');
        return;
      }

      setConfirmedItem(res.item);
      setCopiedRef(false);
      setSubject('');
      setMessage('');
      setIsAnonymous(false);
      handleRemoveFile();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyRef = async (refNum: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(refNum);
        setCopiedRef(true);
      }
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-teal-600 shrink-0" />
            <h2 className="font-display font-bold text-sm text-slate-900">
              Diadikasia Feedback Centre
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Report technical problems, clinical safety concerns, complaints, or
            platform suggestions confidentially to administration.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setExpanded((prev) => !prev);
            if (onClearHighlight) onClearHighlight();
          }}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 shrink-0 min-h-[36px] transition-colors"
        >
          <span>{expanded ? 'Hide' : 'Open'}</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {!expanded && items.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setView('history');
          }}
          className="text-xs font-semibold text-teal-700 hover:underline"
        >
          View my submitted feedback ({items.length})
        </button>
      )}

      {expanded && (
        <div className="pt-2 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setView('form')}
              className={`py-2 rounded-lg text-xs font-semibold min-h-[38px] transition-colors ${
                view === 'form'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Submit feedback
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              className={`py-2 rounded-lg text-xs font-semibold min-h-[38px] transition-colors tabular-nums ${
                view === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My submissions ({items.length})
            </button>
          </div>

          {view === 'form' && (
            <div className="space-y-3.5">
              {confirmedItem && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Feedback received</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmedItem(null)}
                      className="text-emerald-700 hover:text-emerald-900"
                      aria-label="Dismiss confirmation"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Reference number
                      </div>
                      <div className="font-mono font-bold text-sm text-slate-900">
                        {confirmedItem.referenceNumber}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyRef(confirmedItem.referenceNumber)
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    {confirmedItem.isAnonymous
                      ? 'Submitted anonymously — your account identity was not stored, so this report will not appear in My submissions or trigger account reply notifications. Save your reference number above for your own records.'
                      : 'Submitted confidentially. You can track status updates and official responses under My submissions.'}
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Never include patient names, medical record numbers, or
                  identifiable clinical photos in your feedback.
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {formErr && (
                  <p className="text-xs font-medium text-red-700" role="alert">
                    {formErr}
                  </p>
                )}

                <div>
                  <label
                    htmlFor="fb-category"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="fb-category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as FeedbackCategory)
                    }
                    disabled={submitting}
                    className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[42px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
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
                </div>

                <div>
                  <label
                    htmlFor="fb-subject"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Subject
                  </label>
                  <input
                    id="fb-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={submitting}
                    maxLength={160}
                    placeholder="Short summary of your feedback"
                    className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[42px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fb-message"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Details
                  </label>
                  <textarea
                    id="fb-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={submitting}
                    maxLength={4000}
                    placeholder="Describe the issue, suggestion, or safety concern clearly..."
                    className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1">
                    Screenshot or image (optional)
                  </div>
                  {file ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="Attachment preview"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-teal-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">
                            {file.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        disabled={submitting}
                        className="text-xs font-semibold text-red-700 hover:underline shrink-0 px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-xl p-3 text-xs font-semibold text-slate-600 hover:border-teal-500 hover:text-teal-700 cursor-pointer transition-colors">
                      <ImageIcon className="w-4 h-4" />
                      <span>Attach screenshot (JPG, PNG, WebP · max 10 MB)</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        disabled={submitting}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePickFile(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    disabled={submitting}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
                  />
                  <div className="text-xs text-slate-700 leading-snug">
                    <div className="font-semibold text-slate-900 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-teal-600" />
                      <span>Submit anonymously</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {isAnonymous
                        ? 'Your user ID will NOT be stored. You will receive an immediate confirmation and reference number, but anonymous submissions cannot be tracked through your normal account history or reply notifications.'
                        : 'Off by default: submitted confidentially to Supreme Admin so you can track status and replies in My submissions.'}
                    </div>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold min-h-[44px] transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Submitting…' : 'Submit feedback'}</span>
                </button>
              </form>
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
                Showing your confidential submissions. Anonymous submissions do
                not record your account identity and cannot be tracked through
                your normal account history.
              </div>
              {loading ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Loading your submissions…
                </p>
              ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-800 flex items-center justify-between gap-2">
                  <span>{error}</span>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="font-semibold text-teal-700 hover:underline shrink-0"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  No confidential feedback submissions yet. Anonymous submissions
                  do not link to your account history.
                </div>
              ) : (
                items.map((item) => {
                  const isOpen = selectedHistoryId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedHistoryId(isOpen ? null : item.id)
                        }
                        className="w-full text-left flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-slate-600">
                              {item.referenceNumber}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_STYLE[item.status]}`}
                            >
                              {FEEDBACK_STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <div className="font-semibold text-sm text-slate-900 mt-1 break-words">
                            {item.subject}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {FEEDBACK_CATEGORY_LABELS[item.category]} ·{' '}
                            {formatDateTime(item.createdAt)}
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="pt-2 border-t border-slate-200/80 space-y-2.5 text-xs">
                          <p className="text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                            {item.message}
                          </p>

                          {item.attachmentUrl && (
                            <div>
                              <a
                                href={item.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block"
                              >
                                <img
                                  src={item.attachmentUrl}
                                  alt={item.attachmentName || 'Attachment'}
                                  className="max-h-40 rounded-lg border border-slate-200 object-contain bg-white"
                                />
                              </a>
                            </div>
                          )}

                          {item.adminResponse ? (
                            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 space-y-1">
                              <div className="font-bold text-teal-900">
                                Official response
                              </div>
                              <p className="text-teal-950 whitespace-pre-wrap break-words">
                                {item.adminResponse}
                              </p>
                              {item.respondedAt && (
                                <div className="text-[11px] text-teal-700">
                                  Responded {formatDateTime(item.respondedAt)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">
                              No official response yet. Submitted feedback cannot
                              be edited or deleted.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
