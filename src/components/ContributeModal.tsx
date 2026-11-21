import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { CATEGORIES, REGIONS } from '../data/seed';
import type { ContributeForm, Discipline, Region } from '../types';

interface ContributeModalProps {
  form: ContributeForm;
  submittedOk: boolean;
  onChange: (next: ContributeForm) => void;
  onPickFile: (file: File) => void;
  onSubmit: () => void;
  onClose: () => void;
  onSeeSubmissions: () => void;
}

const DRAFT_TIMESTAMPS = ['00:12', '01:05', '02:40', '04:10', '05:30'];

export const ContributeModal: React.FC<ContributeModalProps> = ({
  form,
  submittedOk,
  onChange,
  onPickFile,
  onSubmit,
  onClose,
  onSeeSubmissions,
}) => {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Contribute a video"
    >
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {submittedOk ? (
            <span className="w-14" />
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 min-h-[44px] px-2 -ml-2"
            >
              Cancel
            </button>
          )}
          <span className="font-display font-bold text-sm text-slate-900">
            {submittedOk ? 'Submitted' : 'Contribute a video'}
          </span>
          {submittedOk ? (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 min-h-[44px] px-2 -mr-2"
            >
              Close
            </button>
          ) : (
            <span className="w-14" />
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {submittedOk ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg text-slate-900">
              Thank you. Your video is in review.
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              A clinical reviewer checks every video before anyone can watch it.
              You can follow the status under Profile.
            </p>
            <button
              type="button"
              onClick={onSeeSubmissions}
              className="w-full mt-5 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[46px] transition-colors"
            >
              See my submissions
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {form.errors.length > 0 && (
              <div
                className="bg-white border border-red-600 rounded-2xl p-4"
                role="alert"
              >
                <div className="font-bold text-sm text-slate-900">
                  Before you submit
                </div>
                <ul className="mt-1.5 space-y-1">
                  {form.errors.map((err, i) => (
                    <li key={i} className="text-xs font-medium text-red-700">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {form.url && (
              <div>
                <video
                  src={form.url}
                  controls
                  playsInline
                  className="w-full rounded-2xl bg-black max-h-64"
                />
                <div className="text-xs text-slate-500 mt-1">{form.name}</div>
              </div>
            )}

            <label
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) onPickFile(file);
              }}
              className={`block border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-slate-300 bg-white hover:border-teal-400'
              }`}
            >
              <UploadCloud className="w-7 h-7 text-teal-600 mx-auto mb-2" />
              <div className="font-semibold text-sm text-slate-800">
                {form.name
                  ? 'Choose a different video'
                  : 'Drag a video here, or tap to choose one'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                MP4 or MOV. Filming on a phone is fine.
              </div>
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPickFile(file);
                }}
              />
            </label>

            {form.genState === 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="font-bold text-sm text-slate-900">
                  Analysing video…
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Drafting the step-by-step guide and practice activities.
                </p>
              </div>
            )}

            {form.genState === 2 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="font-bold text-sm text-slate-900">
                  Draft guide ready
                </div>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                  In the real app these steps come from your video. You will
                  review and edit them before submitting.
                </p>
                <div className="space-y-2">
                  {DRAFT_TIMESTAMPS.map((ts, i) => (
                    <div key={ts} className="flex items-center gap-2.5">
                      <span className="font-mono tabular-nums text-xs text-slate-500 w-11 shrink-0">
                        {ts}
                      </span>
                      <input
                        type="text"
                        value={form.steps[i] || ''}
                        onChange={(e) => {
                          const nextSteps = [...form.steps];
                          nextSteps[i] = e.target.value;
                          onChange({ ...form, steps: nextSteps });
                        }}
                        className="flex-1 border border-slate-300 bg-white rounded-xl px-3 py-2 min-h-[40px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Procedure type
                </span>
                <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1">
                  {(['nursing', 'surgical'] as Discipline[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        onChange({ ...form, discipline: d, category: '' })
                      }
                      className={`py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${
                        form.discipline === d
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {d === 'nursing' ? 'Nursing' : 'Surgical'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="contrib-cat"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="contrib-cat"
                    value={form.category}
                    onChange={(e) =>
                      onChange({ ...form, category: e.target.value })
                    }
                    className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Choose a category</option>
                    {CATEGORIES[form.discipline].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="contrib-region"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Region of your teaching context
                  </label>
                  <select
                    id="contrib-region"
                    value={form.region}
                    onChange={(e) =>
                      onChange({ ...form, region: e.target.value as Region })
                    }
                    className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="contrib-title"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Procedure title
                </label>
                <input
                  id="contrib-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => onChange({ ...form, title: e.target.value })}
                  placeholder="e.g. Manual blood pressure measurement"
                  className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label
                  htmlFor="contrib-by"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Your name and credentials
                </label>
                <input
                  id="contrib-by"
                  type="text"
                  value={form.by}
                  onChange={(e) => onChange({ ...form, by: e.target.value })}
                  placeholder="e.g. Amina Garba, RN, Nurse Educator"
                  className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label
                  htmlFor="contrib-org"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  School, hospital or organization
                </label>
                <input
                  id="contrib-org"
                  type="text"
                  value={form.org}
                  onChange={(e) => onChange({ ...form, org: e.target.value })}
                  className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ownsRights}
                    onChange={(e) =>
                      onChange({ ...form, ownsRights: e.target.checked })
                    }
                    className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
                  />
                  <span className="text-sm text-slate-700">
                    I own the rights to this video or have permission to share
                    it.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.patientConsent}
                    onChange={(e) =>
                      onChange({ ...form, patientConsent: e.target.checked })
                    }
                    className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
                  />
                  <span className="text-sm text-slate-700">
                    No patient can be identified in this video, or I hold
                    written patient consent.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[46px] transition-colors"
            >
              Submit for review
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
