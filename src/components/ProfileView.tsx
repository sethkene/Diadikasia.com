import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Flag,
  LogOut,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Video,
} from 'lucide-react';
import type {
  InstructorApplication,
  ProcedureVideo,
  ReelPost,
  ReportedPost,
  StaffPermissions,
  SubmissionItem,
  UserProfile,
} from '../types';
import { getInitials } from '../utils/format';
import { ProcedureCard } from './ProcedureCard';

interface ProfileViewProps {
  user: UserProfile;
  accounts: UserProfile[];
  applications: InstructorApplication[];
  submissions: SubmissionItem[];
  reports: ReportedPost[];
  posts: ReelPost[];
  videos: ProcedureVideo[];
  savedVideos: ProcedureVideo[];
  extraViews: Record<number, number>;
  completedStepsMap: Record<number, boolean[]>;
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
  onOpenApplyInstructor: () => void;
  onApproveApplication: (appId: number) => void;
  onDeclineApplication: (appId: number, note: string) => void;
  onRevokeInstructor: (account: UserProfile) => void;
  onAddSubAdmin: (data: {
    name: string;
    email: string;
    permissions: StaffPermissions;
  }) => Promise<string | null> | string | null;
  onUpdateSubAdminPermissions: (
    account: UserProfile,
    permissions: StaffPermissions,
  ) => void;
  onRemoveSubAdmin: (account: UserProfile) => void;
  onModerateReport: (reportId: number, action: 'removed' | 'dismissed') => void;
  onOpenContribute: () => void;
  onOpenReviewQueue: () => void;
  onOpenVideo: (id: number) => void;
  onOpenInstructorProfile?: (instructorName: string) => void;
  onSignOut: () => void;
}

const STATUS_LABELS: Record<SubmissionItem['status'], string> = {
  pending: 'Pending review',
  ok: 'Published',
  chg: 'Changes requested',
  rej: 'Not published',
};

type AdminSection =
  | 'applications'
  | 'instructors'
  | 'staff'
  | 'moderation'
  | 'users';

function formatYoutubeHref(handle: string): string {
  const trimmed = handle.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('youtube.com') || trimmed.startsWith('www.')) {
    return `https://${trimmed}`;
  }
  const cleanHandle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  return `https://www.youtube.com/${cleanHandle}`;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  accounts,
  applications,
  submissions,
  reports,
  posts,
  videos,
  savedVideos,
  extraViews,
  completedStepsMap,
  shareEnabled,
  onToggleShare,
  onOpenApplyInstructor,
  onApproveApplication,
  onDeclineApplication,
  onRevokeInstructor,
  onAddSubAdmin,
  onUpdateSubAdminPermissions,
  onRemoveSubAdmin,
  onModerateReport,
  onOpenContribute,
  onOpenReviewQueue,
  onOpenVideo,
  onOpenInstructorProfile,
  onSignOut,
}) => {
  const [adminTab, setAdminTab] = useState<AdminSection>('applications');
  const [declineNotes, setDeclineNotes] = useState<Record<number, string>>({});
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffCanReview, setStaffCanReview] = useState(true);
  const [staffCanModerate, setStaffCanModerate] = useState(true);
  const [staffErr, setStaffErr] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const pendingVideosCount = submissions.filter(
    (s) => s.status === 'pending',
  ).length;
  const openReports = reports.filter((r) => r.status === 'open');
  const pendingApps = applications.filter((a) => a.status === 'pending');
  const approvedInstructors = accounts.filter((a) => a.role === 'instructor');
  const subAdmins = accounts.filter((a) => a.role === 'sub_admin');
  const learners = accounts.filter((a) => a.role === 'learner');
  const admins = accounts.filter((a) => a.role === 'admin');

  const myApplication = applications.find(
    (a) => a.email.toLowerCase() === user.email.toLowerCase(),
  );

  const mySubmissions = submissions.filter(
    (s) =>
      s.submittedByEmail?.toLowerCase() === user.email.toLowerCase() ||
      s.instructor.toLowerCase().includes(user.name.toLowerCase()),
  );

  const renderSavedVideosSection = () => (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
        Saved videos ({savedVideos.length})
      </h2>
      {savedVideos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedVideos.map((v) => (
            <ProcedureCard
              key={v.id}
              video={v}
              extraViews={extraViews[v.id] || 0}
              completedCount={
                (completedStepsMap[v.id] || []).filter(Boolean).length
              }
              onOpen={onOpenVideo}
              onOpenInstructor={onOpenInstructorProfile}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="font-bold text-slate-900">Nothing saved yet</div>
          <p className="text-sm text-slate-600 mt-1">
            Tap Save on any procedure video to keep it here for quick revision.
          </p>
        </div>
      )}
    </div>
  );

  const renderPracticePopupToggle = () => (
    <label className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={shareEnabled}
        onChange={(e) => onToggleShare(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
      />
      <span className="text-xs text-slate-700 leading-snug">
        Show brief practice score pop-ups in Reels (on by default; turn off to
        keep scores private).
      </span>
    </label>
  );

  const renderReportedPostsList = () => (
    <div className="space-y-3">
      {openReports.length > 0 ? (
        openReports.map((rep) => {
          const post = posts.find((p) => p.id === rep.postId);
          return (
            <div
              key={rep.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5" />
                    <span>{rep.reason}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Reported by {rep.reportedBy} · {rep.reportedAt}
                  </div>
                </div>
              </div>

              {post ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-900">
                    Post by {post.by} · {post.role}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">
                    {post.caption ||
                      (post.kind === 'practice'
                        ? 'Practice milestone post'
                        : 'Media post')}
                  </p>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Original post was already removed.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onModerateReport(rep.id, 'removed')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold min-h-[38px] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Take down post</span>
                </button>
                <button
                  type="button"
                  onClick={() => onModerateReport(rep.id, 'dismissed')}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold min-h-[38px] transition-colors"
                >
                  Dismiss report
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="font-semibold text-sm text-slate-900">
            No open reported posts
          </div>
          <p className="text-xs text-slate-500 mt-1">
            When users report a community Reel, it appears here for moderation.
          </p>
        </div>
      )}
    </div>
  );

  // 1. NORMAL USER (LEARNER) PROFILE — Simple: Name, Apply to teach, Saved videos, Sign out
  if (user.role === 'learner') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-full bg-teal-600 text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-base text-slate-900 truncate">
                {user.name}
              </div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="font-display font-bold text-sm text-slate-900">
              Teach on Diadikasia
            </div>

            {myApplication?.status === 'pending' ? (
              <div className="space-y-2">
                <div className="text-xs font-bold text-amber-700">
                  Instructor application pending verification
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  An admin is reviewing your qualifications before enabling
                  video uploads on your profile.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
                  <div>
                    <span className="text-slate-500">Full name:</span>{' '}
                    {myApplication.fullName}
                  </div>
                  <div>
                    <span className="text-slate-500">Qualifications:</span>{' '}
                    {myApplication.qualifications}
                  </div>
                  {myApplication.youtubeHandle && (
                    <div>
                      <span className="text-slate-500">YouTube:</span>{' '}
                      {myApplication.youtubeHandle}
                    </div>
                  )}
                </div>
              </div>
            ) : myApplication?.status === 'declined' ? (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-red-700">
                  Application not approved
                </div>
                {myApplication.decisionNote && (
                  <p className="text-xs text-slate-600">
                    Admin note: {myApplication.decisionNote}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onOpenApplyInstructor}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold min-h-[44px] transition-colors"
                >
                  Apply again
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Want to contribute clinical procedure videos? Apply with your
                  full name, qualifications, and YouTube handle for admin
                  verification.
                </p>
                <button
                  type="button"
                  onClick={onOpenApplyInstructor}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold min-h-[44px] transition-colors"
                >
                  Apply as clinical instructor
                </button>
              </>
            )}
          </div>

          {renderPracticePopupToggle()}

          <button
            type="button"
            onClick={onSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 min-h-[44px] transition-colors"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Sign out</span>
          </button>
        </div>

        <div className="lg:col-span-7">{renderSavedVideosSection()}</div>
      </div>
    );
  }

  // 2. VERIFIED CLINICAL INSTRUCTOR PORTAL
  if (user.role === 'instructor') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-full bg-teal-600 text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-base text-slate-900 truncate">
                    {user.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Instructor
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            {user.qualifications && (
              <div className="text-xs text-slate-700 pt-2 border-t border-slate-100">
                <span className="text-slate-500">Qualifications:</span>{' '}
                {user.qualifications}
              </div>
            )}
            {user.youtubeHandle && (
              <div className="text-xs text-slate-700">
                <span className="text-slate-500">YouTube:</span>{' '}
                <a
                  href={formatYoutubeHref(user.youtubeHandle)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-600 hover:underline inline-flex items-center gap-1"
                >
                  {user.youtubeHandle}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Instructor Portal */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="font-display font-bold text-sm text-slate-900">
              Instructor portal
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your instructor verification is active. Upload clinical procedure
              videos below; every submission is reviewed again before
              publishing.
            </p>
            <button
              type="button"
              onClick={onOpenContribute}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold min-h-[44px] transition-colors"
            >
              <Video className="w-4 h-4" />
              <span>Add a clinical video</span>
            </button>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              My video submissions ({mySubmissions.length})
            </h2>
            {mySubmissions.length > 0 ? (
              <div className="space-y-2.5">
                {mySubmissions.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4"
                  >
                    <div className="font-semibold text-sm text-slate-900">
                      {s.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {s.discipline === 'nursing' ? 'Nursing' : 'Surgical'} ·{' '}
                      {s.category} · {s.region}
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                      <span
                        className={`text-xs font-bold ${
                          s.status === 'ok'
                            ? 'text-emerald-700'
                            : s.status === 'rej'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[s.status]}
                      </span>
                    </div>
                    {s.note && s.status !== 'pending' && (
                      <p className="text-xs text-slate-600 mt-2">
                        Reviewer note: {s.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-500">
                Videos you submit appear here with their clinical review status.
              </div>
            )}
          </div>

          {renderPracticePopupToggle()}

          <button
            type="button"
            onClick={onSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 min-h-[44px] transition-colors"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Sign out</span>
          </button>
        </div>

        <div className="lg:col-span-7">{renderSavedVideosSection()}</div>
      </div>
    );
  }

  // 3. SUB-ADMIN STAFF PORTAL
  if (user.role === 'sub_admin') {
    const perms = user.permissions || {
      canReviewVideos: false,
      canModeratePosts: false,
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-full bg-slate-900 text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-base text-slate-900 truncate">
                  {user.name}
                </div>
                <div className="text-xs font-semibold text-teal-700">
                  Sub-Admin Staff
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-700">
                Assigned access controls
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Approve & review videos</span>
                <span
                  className={`font-semibold ${
                    perms.canReviewVideos ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {perms.canReviewVideos ? 'Permitted' : 'Not permitted'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Take down reported posts</span>
                <span
                  className={`font-semibold ${
                    perms.canModeratePosts ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {perms.canModeratePosts ? 'Permitted' : 'Not permitted'}
                </span>
              </div>
            </div>
          </div>

          {!perms.canReviewVideos && !perms.canModeratePosts && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">
              No moderation permissions are currently assigned to your staff
              account. Ask the Supreme Admin to grant video review or post
              moderation access.
            </div>
          )}

          {perms.canReviewVideos && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="font-display font-bold text-sm text-slate-900">
                Video review queue
              </div>
              <p className="text-xs text-slate-600">
                Approve, request changes, or reject clinical procedure videos
                submitted by verified instructors.
              </p>
              <button
                type="button"
                onClick={onOpenReviewQueue}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold min-h-[44px] transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span className="tabular-nums">
                  Open review queue ({pendingVideosCount} waiting)
                </span>
              </button>
            </div>
          )}

          {perms.canModeratePosts && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Reported posts ({openReports.length} open)
              </h2>
              {renderReportedPostsList()}
            </div>
          )}

          {renderPracticePopupToggle()}

          <button
            type="button"
            onClick={onSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 min-h-[44px] transition-colors"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Sign out</span>
          </button>
        </div>

        <div className="lg:col-span-7">{renderSavedVideosSection()}</div>
      </div>
    );
  }

  // 4. SUPREME ADMIN SEPARATE PORTAL
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staffSaving) return;
    if (!staffName.trim() || !staffEmail.trim()) {
      setStaffErr('Enter full name and email.');
      return;
    }
    setStaffSaving(true);
    setStaffErr('');
    try {
      const err = await onAddSubAdmin({
        name: staffName.trim(),
        email: staffEmail.trim().toLowerCase(),
        permissions: {
          canReviewVideos: staffCanReview,
          canModeratePosts: staffCanModerate,
        },
      });
      if (err) {
        setStaffErr(err);
        return;
      }
      setStaffErr('');
      setStaffName('');
      setStaffEmail('');
      setShowAddStaff(false);
    } finally {
      setStaffSaving(false);
    }
  };

  const filteredUsers = accounts.filter((acc) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return `${acc.name} ${acc.email} ${acc.role}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Supreme Admin Header Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full bg-teal-500 text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-bold text-lg">{user.name}</div>
            <div className="text-xs text-teal-300 font-semibold">
              Supreme Admin Portal · Full platform control
            </div>
            <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {approvedInstructors.length} verified instructors ·{' '}
              {pendingApps.length} pending applications · {subAdmins.length}{' '}
              sub-admins
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenContribute}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold min-h-[42px] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add video</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-semibold min-h-[42px] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Admin Section Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-200/75 p-1 rounded-xl w-full sm:w-fit">
        {(
          [
            ['applications', `Applications (${pendingApps.length})`],
            ['instructors', `Approved Instructors (${approvedInstructors.length})`],
            ['staff', `Sub-Admin Staff (${subAdmins.length})`],
            [
              'moderation',
              `Reviews & Reports (${pendingVideosCount + openReports.length})`,
            ],
            ['users', `Users (${accounts.length})`],
          ] as Array<[AdminSection, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAdminTab(id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] transition-colors tabular-nums ${
              adminTab === id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: Instructor Applications */}
      {adminTab === 'applications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending instructor applications ({pendingApps.length})
            </h2>

            {pendingApps.length > 0 ? (
              pendingApps.map((app) => (
                <div
                  key={app.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-base text-slate-900">
                        {app.fullName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {app.email} · Applied {app.submittedAt}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                    <div>
                      <span className="font-semibold text-slate-600">
                        Qualifications:
                      </span>{' '}
                      <span className="text-slate-900">
                        {app.qualifications}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">
                        YouTube handle:
                      </span>{' '}
                      {app.youtubeHandle ? (
                        <a
                          href={formatYoutubeHref(app.youtubeHandle)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-600 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          {app.youtubeHandle}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">Not provided</span>
                      )}
                    </div>
                    {app.note && (
                      <div>
                        <span className="font-semibold text-slate-600">
                          Background:
                        </span>{' '}
                        <span className="text-slate-800">{app.note}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={declineNotes[app.id] || ''}
                      onChange={(e) =>
                        setDeclineNotes((prev) => ({
                          ...prev,
                          [app.id]: e.target.value,
                        }))
                      }
                      placeholder="Optional note if declining (e.g. please link teaching video)"
                      className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2 min-h-[40px] text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onApproveApplication(app.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[40px] transition-colors"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Approve & grant upload access</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDeclineApplication(
                          app.id,
                          declineNotes[app.id]?.trim() || '',
                        )
                      }
                      className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold min-h-[40px] transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="font-bold text-slate-900">
                  No pending applications
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  New instructor verification requests appear here.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-5">
            {renderPracticePopupToggle()}
            {renderSavedVideosSection()}
          </div>
        </div>
      )}

      {/* Tab 2: Directory of Approved Instructors */}
      {adminTab === 'instructors' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Verified clinical instructors allowed ({approvedInstructors.length})
            </h2>
          </div>

          {approvedInstructors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvedInstructors.map((inst) => {
                const videoCount = videos.filter((v) =>
                  v.instructor
                    .toLowerCase()
                    .includes(inst.name.toLowerCase().split(',')[0]),
                ).length;

                return (
                  <div
                    key={inst.email}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-teal-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                            {getInitials(inst.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-display font-bold text-sm text-slate-900 truncate flex items-center gap-1.5">
                              <span>{inst.name}</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {inst.email}
                            </div>
                          </div>
                        </div>
                      </div>

                      {inst.qualifications && (
                        <div className="text-xs text-slate-700 pt-1">
                          {inst.qualifications}
                        </div>
                      )}

                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="tabular-nums">
                          {videoCount} published videos
                        </span>
                        {inst.approvedAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Allowed {inst.approvedAt}</span>
                          </>
                        )}
                        {inst.youtubeHandle && (
                          <>
                            <span aria-hidden="true">·</span>
                            <a
                              href={formatYoutubeHref(inst.youtubeHandle)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-600 hover:underline inline-flex items-center gap-1"
                            >
                              {inst.youtubeHandle}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-emerald-700">
                        Upload portal active
                      </span>
                      <button
                        type="button"
                        onClick={() => onRevokeInstructor(inst)}
                        className="text-xs font-semibold text-red-700 hover:underline py-1"
                      >
                        Revoke permission
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
              No instructors have been approved yet.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Sub-Admin Staff & Granular Access Control */}
      {adminTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sub-admin staff access control ({subAdmins.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Delegate video review or reported post moderation to trusted
                staff without granting full admin control.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddStaff((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[40px] transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddStaff ? 'Cancel' : 'Add sub-admin'}</span>
            </button>
          </div>

          {showAddStaff && (
            <form
              onSubmit={handleAddStaffSubmit}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 max-w-xl"
            >
              <div className="font-display font-bold text-sm text-slate-900">
                Appoint sub-admin staff
              </div>
              {staffErr && (
                <p className="text-xs font-medium text-red-700" role="alert">
                  {staffErr}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="staff-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Full name
                  </label>
                  <input
                    id="staff-name"
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Dr. Kenji Mori"
                    className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 min-h-[42px] text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="staff-email"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="staff@diadikasia.org"
                    className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 min-h-[42px] text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffCanReview}
                    onChange={(e) => setStaffCanReview(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>Approve & review videos</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffCanModerate}
                    onChange={(e) => setStaffCanModerate(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>Take down reported posts</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={staffSaving}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[40px]"
              >
                {staffSaving ? 'Saving…' : 'Save sub-admin'}
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subAdmins.map((staff) => {
              const perms = staff.permissions || {
                canReviewVideos: false,
                canModeratePosts: false,
              };
              return (
                <div
                  key={staff.email}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-slate-900 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                        {getInitials(staff.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-slate-900 truncate">
                          {staff.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {staff.email}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveSubAdmin(staff)}
                      className="text-xs font-semibold text-red-700 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perms.canReviewVideos}
                        onChange={(e) =>
                          onUpdateSubAdminPermissions(staff, {
                            ...perms,
                            canReviewVideos: e.target.checked,
                          })
                        }
                        className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">
                          Approve & review videos
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Allows approving, requesting changes, or rejecting
                          submitted procedure videos.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perms.canModeratePosts}
                        onChange={(e) =>
                          onUpdateSubAdminPermissions(staff, {
                            ...perms,
                            canModeratePosts: e.target.checked,
                          })
                        }
                        className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
                      />
                      <div>
                        <div className="font-semibold text-xs text-slate-900">
                          Take down reported posts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Allows reviewing reported community Reels and removing
                          unsafe or inappropriate posts.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Video Review Queue & Reported Posts Moderation */}
      {adminTab === 'moderation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="font-display font-bold text-base text-slate-900">
                Clinical video review queue
              </div>
              <p className="text-xs text-slate-600">
                Review procedure submissions from verified instructors before
                they publish to Learners.
              </p>
              <button
                type="button"
                onClick={onOpenReviewQueue}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold min-h-[44px] transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span className="tabular-nums">
                  Open review queue ({pendingVideosCount} waiting)
                </span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Reported community posts ({openReports.length} open)
            </h2>
            {renderReportedPostsList()}
          </div>
        </div>
      )}

      {/* Tab 5: User Management & Platform Oversight */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-slate-500">Admins</div>
              <div className="font-display font-bold text-xl text-slate-900 mt-1 tabular-nums">
                {admins.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-slate-500">
                Sub-Admins
              </div>
              <div className="font-display font-bold text-xl text-slate-900 mt-1 tabular-nums">
                {subAdmins.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-slate-500">
                Instructors
              </div>
              <div className="font-display font-bold text-xl text-slate-900 mt-1 tabular-nums">
                {approvedInstructors.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-slate-500">
                Learners
              </div>
              <div className="font-display font-bold text-xl text-slate-900 mt-1 tabular-nums">
                {learners.length}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Registered users ({filteredUsers.length})
            </h2>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by name, email, or role"
              className="w-full sm:w-72 border border-slate-300 bg-white rounded-xl px-3.5 py-2 min-h-[40px] text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {filteredUsers.length > 0 ? (
            <div className="space-y-2.5">
              {filteredUsers.map((acc) => {
                const roleDisplay =
                  acc.role === 'admin'
                    ? 'Supreme Admin'
                    : acc.role === 'sub_admin'
                    ? 'Sub-Admin Staff'
                    : acc.role === 'instructor'
                    ? 'Verified Instructor'
                    : 'Learner';

                return (
                  <div
                    key={acc.id || acc.email}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                        {getInitials(acc.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-slate-900 truncate">
                          {acc.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {acc.email} ·{' '}
                          <span className="font-semibold text-teal-700">
                            {roleDisplay}
                          </span>
                        </div>
                        {acc.qualifications && (
                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                            {acc.qualifications}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {acc.role === 'admin' && (
                        <span className="text-xs font-semibold text-slate-500">
                          Protected account
                        </span>
                      )}
                      {acc.role === 'learner' && (
                        <button
                          type="button"
                          onClick={() => {
                            setStaffName(acc.name);
                            setStaffEmail(acc.email);
                            setStaffErr('');
                            setShowAddStaff(true);
                            setAdminTab('staff');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold min-h-[36px] transition-colors"
                        >
                          Appoint sub-admin
                        </button>
                      )}
                      {acc.role === 'instructor' && (
                        <button
                          type="button"
                          onClick={() => onRevokeInstructor(acc)}
                          className="px-3 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold min-h-[36px] transition-colors"
                        >
                          Revoke instructor
                        </button>
                      )}
                      {acc.role === 'sub_admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAdminTab('staff')}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold min-h-[36px] transition-colors"
                          >
                            Edit permissions
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSubAdmin(acc)}
                            className="px-3 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold min-h-[36px] transition-colors"
                          >
                            Remove sub-admin
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
              No matching users found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
