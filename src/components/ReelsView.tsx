import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Share2,
} from 'lucide-react';
import type {
  PracticeMilestone,
  ProcedureVideo,
  ReelPost,
  ReelSignals,
  ReelsFeedTab,
} from '../types';
import {
  formatCount,
  getInitials,
  getProcedureGradient,
} from '../utils/format';

interface ReelsViewProps {
  posts: ReelPost[];
  reasonsByPostId: Record<number, string>;
  topInterests: string[];
  signals: ReelSignals;
  milestones: PracticeMilestone[];
  shareEnabled: boolean;
  feedTab: ReelsFeedTab;
  onChangeFeedTab: (tab: ReelsFeedTab) => void;
  videos: ProcedureVideo[];
  likedIds: Set<string>;
  onToggleLike: (postId: number) => void;
  onEnsureLike: (postId: number) => void;
  onOpenComments: (postId: number) => void;
  onOpenShare: (postId: number) => void;
  onOpenReport: (postId: number) => void;
  onNotInterested: (post: ReelPost) => void;
  onOpenProfile: (author: string) => void;
  onOpenNewPost: () => void;
  onTryProcedure: (videoId: number, fromPostId: number) => void;
  onRecordView: (postId: number) => void;
  onRecordDwell: (post: ReelPost, dwellMs: number) => void;
  onResetPreferences: () => void;
}

export const ReelsView: React.FC<ReelsViewProps> = ({
  posts,
  reasonsByPostId,
  topInterests,
  signals,
  milestones,
  shareEnabled,
  feedTab,
  onChangeFeedTab,
  videos,
  likedIds,
  onToggleLike,
  onEnsureLike,
  onOpenComments,
  onOpenShare,
  onOpenReport,
  onNotInterested,
  onOpenProfile,
  onOpenNewPost,
  onTryProcedure,
  onRecordView,
  onRecordDwell,
  onResetPreferences,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeEntryRef = useRef<{ post: ReelPost; startedAt: number } | null>(
    null,
  );
  const viewedInSessionRef = useRef<Set<number>>(new Set());
  const shownMilestonesRef = useRef<Set<number>>(new Set());

  const [floatingMilestone, setFloatingMilestone] = useState<{
    postId: number;
    milestone: PracticeMilestone;
    key: number;
  } | null>(null);

  const [heartBurst, setHeartBurst] = useState<{
    postId: number;
    x: number;
    y: number;
    key: number;
  } | null>(null);
  const [failedMediaIds, setFailedMediaIds] = useState<Set<number>>(
    () => new Set(),
  );

  const postsRef = useRef(posts);
  postsRef.current = posts;
  const milestonesRef = useRef(milestones);
  milestonesRef.current = milestones;
  const shareEnabledRef = useRef(shareEnabled);
  shareEnabledRef.current = shareEnabled;
  const onRecordViewRef = useRef(onRecordView);
  onRecordViewRef.current = onRecordView;
  const onRecordDwellRef = useRef(onRecordDwell);
  onRecordDwellRef.current = onRecordDwell;

  // Auto-dismiss ephemeral practice score pop-up without blocking playback
  useEffect(() => {
    if (!floatingMilestone) return;
    const t = window.setTimeout(() => {
      setFloatingMilestone(null);
    }, 2600);
    return () => window.clearTimeout(t);
  }, [floatingMilestone]);

  // Auto-dismiss double-tap heart animation
  useEffect(() => {
    if (!heartBurst) return;
    const t = window.setTimeout(() => {
      setHeartBurst(null);
    }, 850);
    return () => window.clearTimeout(t);
  }, [heartBurst]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const flushActive = () => {
      const current = activeEntryRef.current;
      if (!current) return;
      const elapsed = Date.now() - current.startedAt;
      if (elapsed >= 350) {
        onRecordDwellRef.current(current.post, elapsed);
      }
      activeEntryRef.current = null;
    };

    const maybeShowMilestoneForPost = (post: ReelPost) => {
      if (!shareEnabledRef.current) return;
      const pool = milestonesRef.current;
      if (pool.length === 0) return;

      // Prefer a milestone matching this Reel's procedure or category, else newest unshown
      const match =
        pool.find(
          (m) =>
            !shownMilestonesRef.current.has(m.id) &&
            ((post.vid && m.vid === post.vid) ||
              (post.category && m.category === post.category)),
        ) || pool.find((m) => !shownMilestonesRef.current.has(m.id));

      if (match) {
        shownMilestonesRef.current.add(match.id);
        setFloatingMilestone({
          postId: post.id,
          milestone: match,
          key: Date.now(),
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            const postId = Number(
              (entry.target as HTMLElement).dataset.postId,
            );
            const post = postsRef.current.find((p) => p.id === postId);
            if (!post) continue;

            if (activeEntryRef.current?.post.id !== post.id) {
              flushActive();
              activeEntryRef.current = { post, startedAt: Date.now() };
              if (!viewedInSessionRef.current.has(post.id)) {
                viewedInSessionRef.current.add(post.id);
                onRecordViewRef.current(post.id);
              }
              maybeShowMilestoneForPost(post);
            }
          }
        }
      },
      { root, threshold: [0.65] },
    );

    const cards = root.querySelectorAll('[data-post-id]');
    cards.forEach((el) => observer.observe(el));

    return () => {
      flushActive();
      observer.disconnect();
    };
  }, [posts, feedTab]);

  const handleDoubleTapLike = (
    e: React.MouseEvent<HTMLElement>,
    postId: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHeartBurst({ postId, x, y, key: Date.now() });
    onEnsureLike(postId);
  };

  const jumpToPost = (postId: number) => {
    const target = scrollRef.current?.querySelector(
      `[data-post-id="${postId}"]`,
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasCustomHidden =
    signals.notInterestedPostIds.length > 0 ||
    Object.keys(signals.notInterestedGenres).length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main vertical snap-scroll reels player */}
      <div className="lg:col-span-7 xl:col-span-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div
            role="tablist"
            aria-label="Reels feed mode"
            className="grid grid-cols-2 bg-slate-200/80 rounded-xl p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={feedTab === 'for_you'}
              onClick={() => onChangeFeedTab('for_you')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                feedTab === 'for_you'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              For You
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={feedTab === 'friends'}
              onClick={() => onChangeFeedTab('friends')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] transition-colors ${
                feedTab === 'friends'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Friends
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenNewPost}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold min-h-[40px] transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Post</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-2.5">
          {feedTab === 'for_you'
            ? 'Double-tap to like. Ranked by your clinical study focus and practice conversions.'
            : 'Posts from your connected study friends and your own uploads.'}
        </p>

        {posts.length === 0 ? (
          <div className="h-[420px] rounded-2xl border border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center">
            <div className="font-display font-bold text-base text-slate-900">
              {feedTab === 'friends'
                ? 'No posts from friends yet'
                : 'No posts left in this feed'}
            </div>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs">
              {feedTab === 'friends'
                ? 'Switch to For You to explore clinical tips across the community, or add more study friends.'
                : 'You hid all available posts. Reset your feed preferences to restore them.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {feedTab === 'friends' ? (
                <button
                  type="button"
                  onClick={() => onChangeFeedTab('for_you')}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[40px]"
                >
                  Open For You feed
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResetPreferences}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[40px]"
                >
                  Reset preferences
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="h-[calc(100dvh-250px)] min-h-[440px] max-h-[680px] overflow-y-auto snap-y snap-mandatory rounded-2xl bg-slate-950 no-scrollbar"
          >
            {posts.map((post) => {
              const liked = likedIds.has(`p${post.id}`);
              const linkedVideo = post.vid
                ? videos.find((v) => v.id === post.vid)
                : undefined;
              const reason = reasonsByPostId[post.id];
              const showMilestone =
                shareEnabled &&
                floatingMilestone &&
                floatingMilestone.postId === post.id;

              return (
                <section
                  key={post.id}
                  data-post-id={post.id}
                  onDoubleClick={(e) => handleDoubleTapLike(e, post.id)}
                  className="relative h-full w-full snap-start overflow-hidden text-white flex flex-col justify-end select-none"
                  style={{ background: getProcedureGradient(post.hue || 215) }}
                >
                  {post.url &&
                    !failedMediaIds.has(post.id) &&
                    (post.isImage ? (
                      <img
                        src={post.url}
                        alt={post.caption || 'Community post'}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedMediaIds((prev) =>
                            new Set(prev).add(post.id),
                          )
                        }
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={post.url}
                        controls
                        playsInline
                        onError={() =>
                          setFailedMediaIds((prev) =>
                            new Set(prev).add(post.id),
                          )
                        }
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ))}

                  {(!post.url || failedMediaIds.has(post.id)) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center">
                        {post.kind === 'photo' ? (
                          <ImageIcon className="w-7 h-7 text-white/90" />
                        ) : (
                          <Play className="w-7 h-7 text-white/90 ml-0.5 fill-current" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Double-tap heart pop-up */}
                  {heartBurst && heartBurst.postId === post.id && (
                    <div
                      key={heartBurst.key}
                      style={{ left: heartBurst.x, top: heartBurst.y }}
                      className="pointer-events-none absolute z-30 animate-heart-pop"
                    >
                      <Heart className="w-16 h-16 fill-rose-500 text-rose-500 drop-shadow-xl" />
                    </div>
                  )}

                  {/* Ephemeral non-blocking Practice Score Pop-up (fades out automatically) */}
                  {showMilestone && floatingMilestone && (
                    <div
                      key={floatingMilestone.key}
                      className="pointer-events-none absolute top-13 left-3 right-16 z-20 animate-float-fade"
                    >
                      <div className="inline-flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-amber-400/50 text-white rounded-full px-3 py-1.5 shadow-lg max-w-full">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-xs font-extrabold text-amber-300 shrink-0">
                          <Award className="w-3.5 h-3.5" />+
                          {floatingMilestone.milestone.points} pts
                        </span>
                        <span className="text-xs text-white/95 truncate">
                          {floatingMilestone.milestone.userName.split(' ')[0]}{' '}
                          practiced {floatingMilestone.milestone.procedureTitle}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Top quiet recommendation context */}
                  {reason && (
                    <div className="absolute top-3 left-3 right-16 z-10 pointer-events-none">
                      <span className="inline-block text-[11px] font-medium text-white/90 bg-black/45 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                        {reason}
                      </span>
                    </div>
                  )}

                  {/* Bottom Scrim & Metadata */}
                  <div className="relative z-10 p-4 pr-20 pt-16 bg-gradient-to-t from-black/85 via-black/45 to-transparent">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenProfile(post.by)}
                        className="font-display font-bold text-sm hover:underline"
                      >
                        {post.by}
                      </button>
                      {post.verified && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/80 mt-0.5">
                      {post.role} · {post.ago}
                      {post.category ? ` · ${post.category}` : ''}
                    </div>
                    {post.caption && (
                      <p className="text-sm text-white mt-2 leading-snug">
                        {post.caption}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      {post.genre && (
                        <span className="text-xs text-teal-300 font-medium">
                          {post.genre}
                        </span>
                      )}
                      {linkedVideo && (
                        <button
                          type="button"
                          onClick={() =>
                            onTryProcedure(linkedVideo.id, post.id)
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-teal-600/90 hover:bg-teal-500 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <span>Practice: {linkedVideo.title}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-white/70 mt-1.5">
                      Community post, not reviewed. Not clinical guidance.
                    </div>
                  </div>

                  {/* Right Action Column */}
                  <div className="absolute right-3 bottom-4 z-10 flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(post.by)}
                      aria-label="Open author profile"
                      className="w-11 h-11 rounded-full bg-teal-600 border-2 border-white font-display font-bold text-xs flex items-center justify-center shadow-sm"
                    >
                      {getInitials(post.by)}
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleLike(post.id)}
                      aria-pressed={liked}
                      aria-label="Like"
                      className="flex flex-col items-center gap-0.5 text-[11px] font-semibold min-w-[44px]"
                    >
                      <Heart
                        className={`w-6 h-6 drop-shadow ${
                          liked ? 'fill-rose-400 text-rose-400' : 'text-white'
                        }`}
                      />
                      <span className="tabular-nums">
                        {formatCount(post.likes + (liked ? 1 : 0))}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenComments(post.id)}
                      aria-label="Comments"
                      className="flex flex-col items-center gap-0.5 text-[11px] font-semibold min-w-[44px]"
                    >
                      <MessageSquare className="w-6 h-6 drop-shadow" />
                      <span className="tabular-nums">
                        {post.comments.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenShare(post.id)}
                      aria-label="Share with a friend"
                      className="flex flex-col items-center gap-0.5 text-[11px] font-semibold min-w-[44px]"
                    >
                      <Share2 className="w-6 h-6 drop-shadow" />
                      <span>Share</span>
                    </button>

                    <div className="flex flex-col items-center gap-0.5 text-[11px] font-semibold opacity-90">
                      <Eye className="w-5 h-5" />
                      <span className="tabular-nums">
                        {formatCount(post.views)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNotInterested(post)}
                      aria-label="Not interested"
                      title="Not interested"
                      className="flex flex-col items-center gap-0.5 text-[10px] font-semibold min-w-[44px] opacity-85 hover:opacity-100"
                    >
                      <EyeOff className="w-4 h-4" />
                      <span>Hide</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenReport(post.id)}
                      aria-label="Report"
                      className="flex flex-col items-center gap-0.5 text-[10px] font-semibold min-w-[44px] opacity-85 hover:opacity-100"
                    >
                      <Flag className="w-4 h-4" />
                      <span>Report</span>
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Context Column */}
      <aside className="hidden lg:block lg:col-span-5 xl:col-span-6 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-bold text-base text-slate-900">
              How your feed adapts
            </h3>
            {hasCustomHidden && (
              <button
                type="button"
                onClick={onResetPreferences}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset hidden</span>
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Diadikasia ranks Reels using educational relevance rather than pure
            watch time—balancing verified instructors, procedures you save or
            practice, and new community uploads. Practice scores appear briefly
            as non-blocking pop-ups while videos keep playing.
          </p>
          <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5">
            <div className="text-slate-500">
              <span className="font-semibold text-slate-700">
                Top study signals:
              </span>{' '}
              {topInterests.join(' · ')}
            </div>
            <div className="text-slate-500 tabular-nums">
              <span className="font-semibold text-slate-700">
                Practice conversions:
              </span>{' '}
              {signals.practiceConversions.length} ·{' '}
              <span className="font-semibold text-slate-700">
                Practice pop-ups:
              </span>{' '}
              {shareEnabled ? 'On' : 'Off'}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-900">
              Queue order ({posts.length})
            </h3>
            <span className="text-xs text-slate-400">Click to jump</span>
          </div>
          <div className="divide-y divide-slate-100">
            {posts.map((p, idx) => {
              const linked = p.vid
                ? videos.find((v) => v.id === p.vid)
                : undefined;
              return (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => jumpToPost(p.id)}
                    className="min-w-0 text-left group"
                  >
                    <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-teal-700">
                      <span className="font-mono tabular-nums text-xs text-slate-400 mr-1.5">
                        {idx + 1}.
                      </span>
                      {p.caption || p.genre}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.by} · {reasonsByPostId[p.id] || p.ago}
                    </div>
                  </button>
                  {linked && (
                    <button
                      type="button"
                      onClick={() => onTryProcedure(linked.id, p.id)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 shrink-0"
                    >
                      Practice
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
};
