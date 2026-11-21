import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface InstructorApplyModalProps {
  defaultFullName: string;
  onSubmit: (data: {
    fullName: string;
    qualifications: string;
    youtubeHandle: string;
    note: string;
  }) => void;
  onClose: () => void;
}

export const InstructorApplyModal: React.FC<InstructorApplyModalProps> = ({
  defaultFullName,
  onSubmit,
  onClose,
}) => {
  const [fullName, setFullName] = useState(defaultFullName);
  const [qualifications, setQualifications] = useState('');
  const [youtubeHandle, setYoutubeHandle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (!qualifications.trim()) {
      setError('Enter your clinical qualifications and credentials.');
      return;
    }
    setError('');
    onSubmit({
      fullName: fullName.trim(),
      qualifications: qualifications.trim(),
      youtubeHandle: youtubeHandle.trim(),
      note: note.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Apply to become a clinical instructor"
    >
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[88vh] overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:p-6 shadow-xl space-y-4"
      >
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto sm:hidden" />

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-slate-900">
              Apply as a clinical instructor
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Every instructor is verified by an admin before gaining upload
              access so learners receive clear, trustworthy instruction.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-xs font-medium text-red-700" role="alert">
            {error}
          </p>
        )}

        <div>
          <label
            htmlFor="apply-fullname"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Full name
          </label>
          <input
            id="apply-fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Dr. Ngozi Eze"
            className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label
            htmlFor="apply-quals"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Qualifications & clinical credentials
          </label>
          <input
            id="apply-quals"
            type="text"
            value={qualifications}
            onChange={(e) => setQualifications(e.target.value)}
            placeholder="e.g. RN, BNSc, Nurse Educator · Lagos Teaching Hospital"
            className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label
            htmlFor="apply-youtube"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            YouTube handle or channel (optional)
          </label>
          <input
            id="apply-youtube"
            type="text"
            value={youtubeHandle}
            onChange={(e) => setYoutubeHandle(e.target.value)}
            placeholder="e.g. @yourhandle or youtube.com/@channel"
            className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            If you teach on YouTube, share your handle so we can verify your
            previous videos and audio clarity.
          </p>
        </div>

        <div>
          <label
            htmlFor="apply-note"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Teaching background (optional)
          </label>
          <input
            id="apply-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Procedures you teach or skills lab affiliation"
            className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="pt-1 space-y-2">
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[46px] transition-colors"
          >
            Submit application
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
