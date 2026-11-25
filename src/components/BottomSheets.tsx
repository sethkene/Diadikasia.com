import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Play,
  UploadCloud,
} from 'lucide-react';
import type {
  CommentItem,
  Friend,
  FriendRequestItem,
  InviteForm,
  NewPostForm,
  NotificationItem,
  PersonCandidate,
  ProcedureVideo,
  ReelPost,
  SheetState,
  UserProfile,
} from '../types';
import {
  formatCount,
  getInitials,
  getProcedureGradient,
} from '../utils/format';

interface BottomSheetsProps {
  sheet: SheetState | null;
  accounts: UserProfile[];
  posts: ReelPost[];
  videos: ProcedureVideo[];
  videoComments: Record<number, CommentItem[]>;
  friends: Friend[];
  notifications: NotificationItem[];
  activeChatFriend: string | null;
  currentUser: UserProfile;
  postForm: NewPostForm;
  inviteForm: InviteForm;
  onChangePostForm: (next: NewPostForm) => void;
  onPickPostFile: (file: File) => void;
  onPublishPost: () => void;
  postSubmitting?: boolean;
  editingPostId?: number | null;
  onAddComment: (
    target: 'post' | 'video',
    id: number,
    text: string,
  ) => Promise<void> | void;
  onDeleteComment?: (reelId: number, commentId: number) => Promise<void> | void;
  canModerateComments?: boolean;
  incomingFriendRequests?: FriendRequestItem[];
  outgoingFriendRequests?: FriendRequestItem[];
  discoverPeople?: PersonCandidate[];
  onAcceptFriendRequest?: (requestId: number) => void;
  onDeclineFriendRequest?: (requestId: number) => void;
  busyFriendIds?: Set<string>;
  onRespondNotification: (id: number, accept: boolean) => void;
  onChangeInviteForm: (next: InviteForm) => void;
  onSendInvite: () => void;
  onShareToFriend: (friendName: string, postId: number) => void;
  onSubmitReport: (postId: number, reason: string) => void;
  onOpenVideo: (videoId: number) => void;
  onClose: () => void;
}

const REPORT_REASONS = [
  'A patient can be identified',
  'Unsafe or wrong clinical advice',
  'Disrespectful or abusive',
  'Something else',
];

const POST_GENRES = [
  'Tip',
  'Educational comedy',
  'Short drama',
  'Question',
  'Skills lab',
];

export const BottomSheets: React.FC<BottomSheetsProps> = ({
  sheet,
  accounts,
  posts,
  videos,
  videoComments,
  friends,
  notifications,
  activeChatFriend,
  currentUser,
  postForm,
  inviteForm,
  onChangePostForm,
  onPickPostFile,
  onPublishPost,
  postSubmitting = false,
  editingPostId = null,
  onAddComment,
  onDeleteComment,
  canModerateComments = false,
  incomingFriendRequests = [],
  outgoingFriendRequests = [],
  discoverPeople = [],
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  busyFriendIds,
  onRespondNotification,
  onChangeInviteForm,
  onSendInvite,
  onShareToFriend,
  onSubmitReport,
  onOpenVideo,
  onClose,
}) => {
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  if (!sheet) return null;

  const renderContent = () => {
    if (sheet.kind === 'comments') {
      const list =
        sheet.target === 'post'
          ? posts.find((p) => p.id === sheet.id)?.comments || []
          : videoComments[sheet.id] || [];

      const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (commentBusy || !commentText.trim()) return;
        const text = commentText.trim();
        setCommentBusy(true);
        try {
          await onAddComment(sheet.target, sheet.id, text);
          setCommentText('');
        } finally {
          setCommentBusy(false);
        }
      };

      return (
        <div>
          <h3 className="font-display font-bold text-base text-slate-900">
            Comments ({list.length})
          </h3>
          <div className="mt-3 divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {list.length > 0 ? (
              list.map((c, idx) => {
                const canDeleteThisComment =
                  sheet.target === 'post' &&
                  typeof c.id === 'number' &&
                  Boolean(onDeleteComment) &&
                  (canModerateComments ||
                    (Boolean(currentUser.id) && c.authorId === currentUser.id));

                return (
                  <div key={c.id ?? idx} className="py-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <strong className="text-slate-900">{c.name}</strong>{' '}
                        <span className="text-slate-400">{c.ago}</span>
                      </div>
                      {canDeleteThisComment && typeof c.id === 'number' && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment?.(sheet.id, c.id as number)}
                          className="text-[11px] font-semibold text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 mt-0.5">{c.text}</div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500 py-4">
                No comments yet. Be the first.
              </p>
            )}
          </div>
          <form
            onSubmit={handleCommentSubmit}
            className="flex items-center gap-2 mt-3"
          >
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment"
              disabled={commentBusy}
              className="flex-1 border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={commentBusy || !commentText.trim()}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-sm min-h-[44px]"
            >
              {commentBusy ? 'Sending…' : 'Send'}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-2">
            Keep it respectful. Never share patient details.
          </p>
        </div>
      );
    }

    if (sheet.kind === 'profile') {
      const normalizeName = (raw: string) =>
        raw.split(',')[0].trim().toLowerCase();
      const targetKey = normalizeName(sheet.by);

      const account = accounts.find(
        (a) => normalizeName(a.name) === targetKey,
      );
      const fallbackPerson = !account
        ? incomingFriendRequests.find(
            (r) => normalizeName(r.name) === targetKey,
          ) ||
          friends.find((f) => normalizeName(f.name) === targetKey) ||
          discoverPeople.find((p) => normalizeName(p.name) === targetKey) ||
          outgoingFriendRequests.find(
            (r) => normalizeName(r.name) === targetKey,
          )
        : undefined;
      const uploadedVideos = videos.filter(
        (v) => normalizeName(v.instructor) === targetKey,
      );
      const authorPosts = posts.filter(
        (p) => normalizeName(p.by) === targetKey,
      );

      const displayName =
        account?.name ||
        fallbackPerson?.name ||
        authorPosts[0]?.by ||
        sheet.by.split(',')[0].trim();

      const rawCredFromVideo = uploadedVideos[0]?.instructor.includes(',')
        ? uploadedVideos[0].instructor.split(',').slice(1).join(',').trim()
        : '';
      const rawCredFromSheet = sheet.by.includes(',')
        ? sheet.by.split(',').slice(1).join(',').trim()
        : '';
      const qualifications =
        account?.qualifications ||
        fallbackPerson?.qualifications ||
        rawCredFromVideo ||
        rawCredFromSheet ||
        '';

      const roleLabel =
        account?.role === 'instructor'
          ? 'Verified clinical instructor'
          : account?.role === 'admin'
          ? 'Clinical director'
          : account?.role === 'sub_admin'
          ? 'Clinical reviewer & staff'
          : fallbackPerson?.role === 'Clinical instructor'
          ? 'Verified clinical instructor'
          : fallbackPerson?.role ||
            authorPosts[0]?.role ||
            (uploadedVideos.length > 0 ? 'Clinical instructor' : 'Learner');

      const isVerified = Boolean(
        account?.role === 'instructor' ||
          account?.role === 'admin' ||
          fallbackPerson?.role === 'Clinical instructor' ||
          fallbackPerson?.role === 'Clinical director' ||
          authorPosts.some((p) => p.verified) ||
          uploadedVideos.length > 0,
      );

      const org =
        uploadedVideos[0]?.organization || authorPosts[0]?.org || '';
      const region = uploadedVideos[0]?.region || authorPosts[0]?.reg || '';
      const bio = authorPosts[0]?.bio || '';
      const totalLikes = authorPosts.reduce((sum, p) => sum + p.likes, 0);

      const youtubeHref = account?.youtubeHandle
        ? account.youtubeHandle.startsWith('http')
          ? account.youtubeHandle
          : account.youtubeHandle.startsWith('youtube.com') ||
            account.youtubeHandle.startsWith('www.')
          ? `https://${account.youtubeHandle}`
          : `https://www.youtube.com/${
              account.youtubeHandle.startsWith('@')
                ? account.youtubeHandle
                : `@${account.youtubeHandle}`
            }`
        : '';

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-full bg-teal-600 text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-base text-slate-900">
                  {displayName}
                </span>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{roleLabel}</div>
            </div>
          </div>

          {qualifications && (
            <div className="flex items-start gap-2 rounded-xl bg-teal-50/70 border border-teal-200/80 px-3.5 py-2.5 text-xs text-teal-950">
              <GraduationCap className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-teal-900">
                  Qualifications
                </div>
                <div className="text-teal-800 mt-0.5">{qualifications}</div>
              </div>
            </div>
          )}

          {bio && <p className="text-sm text-slate-700">{bio}</p>}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 divide-y divide-slate-200/70 text-xs">
            {[
              ['Institution', org || 'Not added'],
              ['Region', region || 'Not added'],
              ['Uploaded procedures', String(uploadedVideos.length)],
              ['Community reels', String(authorPosts.length)],
              ...(authorPosts.length > 0
                ? [['Likes received', String(totalLikes)]]
                : []),
            ].map(([label, val]) => (
              <div
                key={label}
                className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2"
              >
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-900 tabular-nums text-right">
                  {val}
                </span>
              </div>
            ))}
            {account?.youtubeHandle && youtubeHref && (
              <div className="py-2 last:pb-0 flex items-center justify-between gap-2">
                <span className="text-slate-500">YouTube</span>
                <a
                  href={youtubeHref}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>{account.youtubeHandle}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Uploaded procedures ({uploadedVideos.length})
            </div>
            {uploadedVideos.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {uploadedVideos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenVideo(v.id);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50/40 text-left transition-colors"
                  >
                    <div
                      className="w-12 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ background: getProcedureGradient(v.hue) }}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                        {v.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        {v.category} · {v.duration} · {formatCount(v.views)}{' '}
                        views
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
                No reviewed procedure videos uploaded yet.
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Verified means Diadikasia has reviewed this instructor’s
            credentials.
          </p>
        </div>
      );
    }

    if (sheet.kind === 'newpost') {
      const isEditing = editingPostId !== null;
      return (
        <div className="space-y-3.5">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900">
              {isEditing ? 'Edit post' : 'New post'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Update your caption, category, or linked procedure.'
                : 'Posts go live straight away and are not reviewed first.'}
            </p>
          </div>

          {postForm.err && (
            <p className="text-xs font-medium text-red-700" role="alert">
              {postForm.err}
            </p>
          )}

          {!isEditing && (
            <>
              <div className="grid grid-cols-3 bg-slate-100 rounded-xl p-1 gap-1">
                {(
                  [
                    ['video', 'Video'],
                    ['photo', 'Photo'],
                    ['rec', 'Record'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    disabled={postSubmitting}
                    onClick={() => {
                      if (postForm.kind !== k) {
                        onChangePostForm({
                          ...postForm,
                          kind: k,
                          url: '',
                          name: '',
                          err: '',
                        });
                      }
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold min-h-[38px] transition-colors ${
                      postForm.kind === k
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {postForm.url &&
                (postForm.isImg ? (
                  <img
                    src={postForm.url}
                    alt="Preview"
                    className="w-full max-h-48 object-cover rounded-xl"
                  />
                ) : (
                  <video
                    src={postForm.url}
                    controls
                    playsInline
                    className="w-full max-h-52 rounded-xl bg-black"
                  />
                ))}

              <label className="block border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-teal-400 transition-colors">
                <UploadCloud className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  {postForm.name
                    ? `${postForm.name} · Tap to change`
                    : postForm.kind === 'rec'
                    ? 'Tap to record yourself'
                    : postForm.kind === 'photo'
                    ? 'Tap to choose a photo (JPG, PNG, WebP)'
                    : 'Tap to choose a video (MP4, MOV, WebM)'}
                </span>
                <input
                  type="file"
                  accept={
                    postForm.kind === 'photo'
                      ? 'image/jpeg,image/png,image/webp'
                      : 'video/mp4,video/quicktime,video/webm'
                  }
                  capture={postForm.kind === 'rec' ? 'user' : undefined}
                  disabled={postSubmitting}
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPickPostFile(file);
                  }}
                />
              </label>
            </>
          )}

          <div>
            <label
              htmlFor="new-post-caption"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Caption
            </label>
            <input
              id="new-post-caption"
              type="text"
              value={postForm.caption}
              onChange={(e) =>
                onChangePostForm({ ...postForm, caption: e.target.value })
              }
              placeholder="Say something helpful or fun"
              className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="new-post-genre"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Type
              </label>
              <select
                id="new-post-genre"
                value={postForm.genre}
                onChange={(e) =>
                  onChangePostForm({ ...postForm, genre: e.target.value })
                }
                className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {POST_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-post-disc"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Discipline
              </label>
              <select
                id="new-post-disc"
                value={postForm.discipline}
                onChange={(e) =>
                  onChangePostForm({
                    ...postForm,
                    discipline: e.target.value as NewPostForm['discipline'],
                  })
                }
                className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="general">General clinical</option>
                <option value="nursing">Nursing</option>
                <option value="surgical">Surgical</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="new-post-vid"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Link to a procedure (optional)
            </label>
            <select
              id="new-post-vid"
              value={postForm.linkedVid}
              onChange={(e) => {
                const raw = e.target.value;
                const vid = raw ? Number(raw) : '';
                const matched = vid ? videos.find((v) => v.id === vid) : undefined;
                onChangePostForm({
                  ...postForm,
                  linkedVid: vid,
                  discipline: matched ? matched.discipline : postForm.discipline,
                });
              }}
              className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">None (standalone clip)</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title} ({v.category})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Helps learners jump straight to practicing the procedure you
              demonstrate.
            </p>
          </div>

          {!isEditing && (
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={postForm.confirmed}
                disabled={postSubmitting}
                onChange={(e) =>
                  onChangePostForm({ ...postForm, confirmed: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 accent-teal-600 shrink-0"
              />
              <span>
                No patient can be identified, and I have the right to share
                this.
              </span>
            </label>
          )}

          <button
            type="button"
            disabled={postSubmitting}
            onClick={onPublishPost}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-sm min-h-[46px] transition-colors"
          >
            {postSubmitting
              ? isEditing
                ? 'Saving…'
                : 'Uploading & publishing…'
              : isEditing
              ? 'Save changes'
              : 'Post'}
          </button>
        </div>
      );
    }

    if (sheet.kind === 'notifications') {
      const hasAny =
        incomingFriendRequests.length > 0 || notifications.length > 0;
      return (
        <div>
          <h3 className="font-display font-bold text-base text-slate-900">
            Notifications
          </h3>
          <div className="mt-3 divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {hasAny ? (
              <>
                {incomingFriendRequests.map((req) => {
                  const isBusy = Boolean(busyFriendIds?.has(`req:${req.id}`));
                  return (
                    <div key={`freq-${req.id}`} className="py-3">
                      <div className="text-sm text-slate-800">
                        <strong>{req.name}</strong> wants to be your friend.
                      </div>
                      <div className="flex items-center gap-2 mt-2.5">
                        {onAcceptFriendRequest && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onAcceptFriendRequest(req.id)}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[38px]"
                          >
                            Accept
                          </button>
                        )}
                        {onDeclineFriendRequest && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onDeclineFriendRequest(req.id)}
                            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-semibold min-h-[38px]"
                          >
                            Decline
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {notifications.map((n) => {
                  const v = n.vid
                    ? videos.find((x) => x.id === n.vid)
                    : undefined;
                  return (
                    <div key={n.id} className="py-3">
                      <div className="text-sm text-slate-800">
                        {n.type === 'req' && (
                          <>
                            <strong>{n.from}</strong> wants to be your friend.
                          </>
                        )}
                        {n.type === 'invite' && (
                          <>
                            <strong>{n.from}</strong> invited you to study{' '}
                            <strong>{v?.title}</strong>, {n.when}.
                          </>
                        )}
                        {n.type === 'remind' && (
                          <>
                            <strong>{n.from}</strong> is reminding you to study{' '}
                            <strong>{v?.title}</strong>.
                          </>
                        )}
                      </div>

                      {n.type === 'remind' ? (
                        n.status === 'pending' || n.status === 'seen' ? (
                          <div className="flex items-center gap-2 mt-2.5">
                            <button
                              type="button"
                              onClick={() => onRespondNotification(n.id, true)}
                              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[38px]"
                            >
                              Mark done
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 mt-1">Done</div>
                        )
                      ) : n.status === 'pending' ? (
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={() => onRespondNotification(n.id, true)}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[38px]"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => onRespondNotification(n.id, false)}
                            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold min-h-[38px]"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 mt-1">
                          {n.status === 'accepted'
                            ? 'Accepted'
                            : n.status === 'declined'
                            ? 'Declined'
                            : n.status === 'done'
                            ? 'Done'
                            : n.status === 'seen'
                            ? 'Seen'
                            : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="text-sm text-slate-500 py-4">Nothing new.</p>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Friends’ invites and reminders reach you here, and as phone
            notifications if notifications are on.
          </p>
        </div>
      );
    }

    if (sheet.kind === 'invite') {
      const friend = friends.find((f) => f.name === activeChatFriend);
      return (
        <div className="space-y-3.5">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900">
              Study invite for {activeChatFriend}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose a procedure and a time.{' '}
              {friend?.online
                ? 'They are online and will see it straight away.'
                : 'They are offline. They get a notification if their notifications are on.'}
            </p>
          </div>

          {inviteForm.err && (
            <p className="text-xs font-medium text-red-700" role="alert">
              {inviteForm.err}
            </p>
          )}

          <div>
            <label
              htmlFor="invite-vid"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Procedure
            </label>
            <select
              id="invite-vid"
              value={inviteForm.vid}
              onChange={(e) =>
                onChangeInviteForm({
                  ...inviteForm,
                  vid: Number(e.target.value),
                })
              }
              className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {(['nursing', 'surgical'] as const).map((d) => (
                <optgroup
                  key={d}
                  label={d === 'nursing' ? 'Nursing' : 'Surgical'}
                >
                  {videos
                    .filter((v) => v.discipline === d)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="invite-when"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Date and time
            </label>
            <input
              id="invite-when"
              type="datetime-local"
              value={inviteForm.when}
              onChange={(e) =>
                onChangeInviteForm({ ...inviteForm, when: e.target.value })
              }
              className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label
              htmlFor="invite-note"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Note (optional)
            </label>
            <input
              id="invite-note"
              type="text"
              value={inviteForm.note}
              onChange={(e) =>
                onChangeInviteForm({ ...inviteForm, note: e.target.value })
              }
              placeholder="e.g. Let’s go through the steps together"
              className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="button"
            onClick={onSendInvite}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[46px] transition-colors"
          >
            Send invite
          </button>
        </div>
      );
    }

    if (sheet.kind === 'share') {
      const postId = sheet.postId;
      return (
        <div>
          <h3 className="font-display font-bold text-base text-slate-900">
            Send to a friend
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Reels can only be shared with your Diadikasia friends, not outside
            the app.
          </p>
          {friends.length > 0 ? (
            <div className="space-y-2">
              {friends.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => onShareToFriend(f.name, postId)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-400 text-left text-sm font-semibold text-slate-900 min-h-[44px]"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      f.online ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Add a friend first.</p>
          )}
        </div>
      );
    }

    const reportPostId = sheet.postId;
    return (
      <div>
        <h3 className="font-display font-bold text-base text-slate-900">
          Report this post
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          What is wrong with it?
        </p>
        <div className="space-y-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => onSubmitReport(reportPostId, reason)}
              className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-400 text-sm font-semibold text-slate-800 min-h-[44px]"
            >
              {reason}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[85vh] overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl"
      >
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4 sm:hidden" />
        {renderContent()}
        <button
          type="button"
          onClick={onClose}
          className="block mx-auto mt-3 text-sm font-semibold text-teal-600 hover:text-teal-700 py-2 px-4"
        >
          Close
        </button>
      </div>
    </div>
  );
};
