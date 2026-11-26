import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  Eye,
  Heart,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { DetailTab, PracticeSession, ProcedureVideo } from '../types';
import {
  formatCount,
  formatDaysAgo,
  getInitials,
  getProcedureGradient,
} from '../utils/format';

interface ProcedureDetailModalProps {
  video: ProcedureVideo;
  tab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (id: number) => void;
  isLiked: boolean;
  onToggleLike: (id: number) => void;
  extraViews: number;
  commentCount: number;
  onOpenComments: (id: number) => void;
  completedSteps: boolean[];
  onToggleStep: (videoId: number, stepIndex: number) => void;
  practice: PracticeSession;
  onPracticeAction: (
    action:
      | { type: 'toggle-order'; stepIdx: number }
      | { type: 'reset-order' }
      | { type: 'check-order' }
      | { type: 'reveal-order' }
      | { type: 'pick-next'; optionPos: number }
      | { type: 'pick-missing'; optionPos: number }
      | { type: 'continue' }
      | { type: 'restart' }
      | { type: 'reflection'; value: string },
  ) => void;
  onOpenInstructorProfile: (instructorName: string) => void;
  shareEnabled: boolean;
}

export const ProcedureDetailModal: React.FC<ProcedureDetailModalProps> = ({
  video,
  tab,
  onChangeTab,
  onClose,
  isSaved,
  onToggleSave,
  isLiked,
  onToggleLike,
  extraViews,
  commentCount,
  onOpenComments,
  completedSteps,
  onToggleStep,
  practice,
  onPracticeAction,
  onOpenInstructorProfile,
  shareEnabled,
}) => {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [failedVideoUrl, setFailedVideoUrl] = useState<string | null>(null);
  const [scoreBurst, setScoreBurst] = useState<{
    id: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    setIsPlayingPreview(false);
    setPreviewProgress(0);
    setFailedVideoUrl(null);
  }, [video.id]);

  const triggerBurst = (label: string) => {
    setScoreBurst({ id: Date.now(), label });
  };

  useEffect(() => {
    if (!scoreBurst) return;
    const t = window.setTimeout(() => setScoreBurst(null), 2400);
    return () => window.clearTimeout(t);
  }, [scoreBurst]);

  useEffect(() => {
    if (practice.orderOk) {
      triggerBurst(practice.tries <= 1 ? '+25 pts · First try' : '+15 pts · Order set');
    }
  }, [practice.orderOk, practice.tries]);

  useEffect(() => {
    if (practice.questionPick !== null) {
      const currQ = practice.nextQuestions[practice.questionIdx];
      if (currQ && currQ.options[practice.questionPick] === currQ.rightIdx) {
        triggerBurst('+15 pts · Correct');
      }
    }
  }, [practice.questionPick, practice.questionIdx, practice.nextQuestions]);

  useEffect(() => {
    if (practice.missingPick !== null) {
      if (practice.missingOptions[practice.missingPick] === practice.missingIdx) {
        triggerBurst('+20 pts · Missing step found');
      }
    }
  }, [practice.missingPick, practice.missingOptions, practice.missingIdx]);

  useEffect(() => {
    if (!isPlayingPreview) return;
    const timer = window.setInterval(() => {
      setPreviewProgress((prev) => {
        if (prev >= 100) {
          setIsPlayingPreview(false);
          return 100;
        }
        return prev + 2;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPlayingPreview]);

  const doneCount = completedSteps.filter(Boolean).length;
  const donePct = Math.round((doneCount / video.steps.length) * 100);
  const activePreviewStep = Math.min(
    video.steps.length - 1,
    Math.floor((previewProgress / 100) * video.steps.length),
  );

  const renderSimulationStage = () => {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center text-center text-slate-400 text-[11px] mb-3"
        style={{
          height: '96px',
          background: 'radial-gradient(ellipse at center, #334155 0%, #0f172a 100%)',
          borderRadius: '12px',
          padding: '12px',
        }}
      >
        <div className="w-[30px] h-[30px] border-2 border-teal-400 bg-teal-400/20 rounded-md mb-1.5 animate-sp" />
        <div>
          3D practice scene (coming soon)
          <br />
          <span className="text-slate-300 font-medium">{video.title}</span>
        </div>
      </div>
    );
  };

  const renderPracticeContent = () => {
    if (practice.tooFew) {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-bold text-slate-900">
            Practice needs at least three steps
          </h3>
          <p className="text-sm text-slate-600 mt-1.5">
            This video’s step guide is too short to build practice from.
          </p>
        </div>
      );
    }

    if (practice.part === 4) {
      const totalItems = 2 + practice.nextQuestions.length;
      const firstTryCorrect =
        (practice.firstTry.order ? 1 : 0) +
        practice.firstTry.nextQ.filter(Boolean).length +
        (practice.firstTry.missing ? 1 : 0);
      const uniqueMissed = [...new Set(practice.missedSteps)].sort(
        (a, b) => a - b,
      );

      return (
        <div className="space-y-4">
          {renderSimulationStage()}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <div className="text-3xl font-display font-extrabold text-teal-600 tabular-nums">
              {firstTryCorrect} of {totalItems}
            </div>
            <div className="font-bold text-slate-900 mt-1">
              correct on the first try
            </div>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
              This checks what you know about the steps. It does not show
              hands-on skill.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h4 className="font-bold text-slate-900">Steps to review</h4>
              {uniqueMissed.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {uniqueMissed.map((idx) => (
                    <div
                      key={idx}
                      className="text-sm text-slate-700 flex items-start gap-2"
                    >
                      <span className="font-mono tabular-nums text-xs font-semibold text-amber-700 mt-0.5">
                        {idx + 1}.
                      </span>
                      <span>{video.steps[idx]}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onChangeTab('watch')}
                    className="mt-3 w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-900 transition-colors min-h-[44px]"
                  >
                    Rewatch the video
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-600 mt-2">
                  You got every step right the first time.
                </p>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-900">Perform</h4>
                <p className="text-sm text-slate-600 mt-1.5">
                  Next, practice on a manikin or in your skills lab, and ask
                  your instructor to sign you off.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h4 className="font-bold text-slate-900">Reflect</h4>
            <label
              htmlFor="practice-reflection"
              className="block text-xs font-semibold text-slate-700 mt-2 mb-1.5"
            >
              What will you do differently when you practice this?
            </label>
            <input
              id="practice-reflection"
              type="text"
              value={practice.reflection}
              onChange={(e) =>
                onPracticeAction({ type: 'reflection', value: e.target.value })
              }
              placeholder="Write a quick personal reminder for your skills lab session"
              className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="button"
            onClick={() => onPracticeAction({ type: 'restart' })}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors min-h-[46px]"
          >
            Practice again
          </button>
        </div>
      );
    }

    const q = practice.nextQuestions[practice.questionIdx];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Practice
            </span>
            <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">
              {video.title}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-medium text-slate-500 tabular-nums">
              Part {practice.part} of 3
            </div>
            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-teal-500 transition-all duration-200"
                style={{ width: `${Math.round((practice.part / 3) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-5 space-y-3 relative">
            {scoreBurst && (
              <div
                key={scoreBurst.id}
                aria-live="polite"
                className="pointer-events-none absolute right-3 top-3 z-20 px-3 py-1.5 rounded-full bg-amber-400 text-slate-950 font-mono tabular-nums text-xs font-extrabold shadow-lg animate-float-fade"
              >
                {scoreBurst.label}
              </div>
            )}
            {renderSimulationStage()}
            <button
              type="button"
              onClick={() => onChangeTab('watch')}
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 py-1.5"
            >
              Back to the video
            </button>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5">
            {practice.part === 1 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Put the steps in order
                </div>
                <p className="font-semibold text-slate-900 mt-1">
                  Tap the steps in the order you would do them.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {shareEnabled
                    ? 'Score pop-ups appear briefly in Reels without pausing playback. Turn off in Profile.'
                    : 'Practice pop-ups in Reels are turned off.'}
                </p>

                <div className="mt-3 space-y-2">
                  {practice.shuffled.map((stepIdx) => {
                    const orderPosition =
                      practice.selectedOrder.indexOf(stepIdx);
                    const isSelected = orderPosition >= 0;
                    return (
                      <button
                        key={stepIdx}
                        type="button"
                        onClick={() =>
                          onPracticeAction({ type: 'toggle-order', stepIdx })
                        }
                        className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border text-sm font-medium transition-colors min-h-[44px] ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/70 text-slate-900'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-mono tabular-nums font-bold shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 text-slate-500'
                          }`}
                        >
                          {isSelected ? orderPosition + 1 : ''}
                        </span>
                        <span className="leading-snug">
                          {video.steps[stepIdx]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {practice.feedbackMsg && (
                  <p
                    className={`mt-3 text-sm font-semibold ${
                      practice.feedbackGood
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {practice.feedbackMsg}
                  </p>
                )}

                {practice.orderOk || practice.revealed ? (
                  <button
                    type="button"
                    onClick={() => onPracticeAction({ type: 'continue' })}
                    className="w-full mt-4 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors min-h-[46px]"
                  >
                    Continue
                  </button>
                ) : (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => onPracticeAction({ type: 'check-order' })}
                      className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors min-h-[46px]"
                    >
                      Check order
                    </button>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          onPracticeAction({ type: 'reset-order' })
                        }
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 py-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </button>
                      {practice.tries > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onPracticeAction({ type: 'reveal-order' })
                          }
                          className="text-sm font-semibold text-teal-600 hover:text-teal-700 py-2"
                        >
                          Show me the order
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {practice.part === 2 && q && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 tabular-nums">
                  What comes next? ({practice.questionIdx + 1} of{' '}
                  {practice.nextQuestions.length})
                </div>
                <p className="font-semibold text-slate-900 mt-1.5">
                  After “{video.steps[q.promptIdx]}”, what is the next step?
                </p>

                <div className="mt-3 space-y-2">
                  {q.options.map((optStepIdx, pos) => {
                    const answered = practice.questionPick !== null;
                    const isRight = optStepIdx === q.rightIdx;
                    const isPicked = practice.questionPick === pos;
                    let cls =
                      'border-slate-200 bg-white hover:border-slate-300 text-slate-800';
                    if (answered) {
                      if (isRight) {
                        cls =
                          'border-emerald-600 bg-emerald-50 text-emerald-900';
                      } else if (isPicked) {
                        cls = 'border-red-600 bg-red-50 text-red-900';
                      }
                    }
                    return (
                      <button
                        key={pos}
                        type="button"
                        disabled={answered}
                        onClick={() =>
                          onPracticeAction({
                            type: 'pick-next',
                            optionPos: pos,
                          })
                        }
                        className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border text-sm font-medium transition-colors min-h-[44px] ${cls}`}
                      >
                        <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {'ABC'[pos]}
                        </span>
                        <span>{video.steps[optStepIdx]}</span>
                      </button>
                    );
                  })}
                </div>

                {practice.questionPick !== null && (
                  <div className="mt-4">
                    <p
                      className={`text-sm font-semibold ${
                        q.options[practice.questionPick] === q.rightIdx
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {q.options[practice.questionPick] === q.rightIdx
                        ? '✓ Correct.'
                        : '✗ Not quite.'}{' '}
                      In the guide, step {q.rightIdx + 1} is “
                      {video.steps[q.rightIdx]}”.
                    </p>
                    <button
                      type="button"
                      onClick={() => onPracticeAction({ type: 'continue' })}
                      className="w-full mt-3 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors min-h-[46px]"
                    >
                      Continue
                    </button>
                  </div>
                )}
              </div>
            )}

            {practice.part === 3 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Find the missing step
                </div>
                <p className="font-semibold text-slate-900 mt-1">
                  One step has been removed. Which one is it?
                </p>

                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  {video.steps.map((s, i) =>
                    i === practice.missingIdx ? (
                      <div
                        key={i}
                        className="text-xs font-bold text-teal-700 flex items-start gap-2 py-1"
                      >
                        <span className="font-mono tabular-nums w-5 shrink-0">
                          {i + 1}.
                        </span>
                        <span>? (missing step)</span>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="text-xs text-slate-700 flex items-start gap-2 py-1"
                      >
                        <span className="font-mono tabular-nums text-slate-400 w-5 shrink-0">
                          {i + 1}.
                        </span>
                        <span>{s}</span>
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {practice.missingOptions.map((optStepIdx, pos) => {
                    const answered = practice.missingPick !== null;
                    const isRight = optStepIdx === practice.missingIdx;
                    const isPicked = practice.missingPick === pos;
                    let cls =
                      'border-slate-200 bg-white hover:border-slate-300 text-slate-800';
                    if (answered) {
                      if (isRight) {
                        cls =
                          'border-emerald-600 bg-emerald-50 text-emerald-900';
                      } else if (isPicked) {
                        cls = 'border-red-600 bg-red-50 text-red-900';
                      }
                    }
                    return (
                      <button
                        key={pos}
                        type="button"
                        disabled={answered}
                        onClick={() =>
                          onPracticeAction({
                            type: 'pick-missing',
                            optionPos: pos,
                          })
                        }
                        className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border text-sm font-medium transition-colors min-h-[44px] ${cls}`}
                      >
                        <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {'ABC'[pos]}
                        </span>
                        <span>{video.steps[optStepIdx]}</span>
                      </button>
                    );
                  })}
                </div>

                {practice.missingPick !== null && (
                  <div className="mt-4">
                    <p
                      className={`text-sm font-semibold ${
                        practice.missingOptions[practice.missingPick] ===
                        practice.missingIdx
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {practice.missingOptions[practice.missingPick] ===
                      practice.missingIdx
                        ? '✓ Correct.'
                        : '✗ Not quite.'}{' '}
                      The missing step was “{video.steps[practice.missingIdx]}”.
                    </p>
                    <button
                      type="button"
                      onClick={() => onPracticeAction({ type: 'continue' })}
                      className="w-full mt-3 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors min-h-[46px]"
                    >
                      See results
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 min-h-[44px] px-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <span className="font-display font-bold text-sm text-slate-900 truncate">
            {tab === 'practice' ? 'Practice' : 'Procedure'}
          </span>

          <button
            type="button"
            onClick={() => onToggleSave(video.id)}
            aria-pressed={isSaved}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold min-h-[44px] px-2 -mr-2 transition-colors ${
              isSaved
                ? 'text-teal-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bookmark
              className={`w-4 h-4 ${isSaved ? 'fill-teal-600 text-teal-600' : ''}`}
            />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switch */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="max-w-md mx-auto grid grid-cols-2 bg-slate-200/80 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => onChangeTab('watch')}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${
              tab === 'watch'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Watch
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('practice')}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${
              tab === 'practice'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Practice
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 pb-16">
        {tab === 'practice' ? (
          renderPracticeContent()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Video + Summary */}
            <div className="lg:col-span-7 space-y-4">
              <div
                className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 text-white shadow-xs"
                style={
                  video.videoUrl && failedVideoUrl !== video.videoUrl
                    ? undefined
                    : { background: getProcedureGradient(video.hue) }
                }
              >
                {video.videoUrl && failedVideoUrl !== video.videoUrl ? (
                  <video
                    src={video.videoUrl}
                    controls
                    playsInline
                    onError={() => setFailedVideoUrl(video.videoUrl || null)}
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (previewProgress >= 100) setPreviewProgress(0);
                          setIsPlayingPreview((prev) => !prev);
                        }}
                        aria-label={isPlayingPreview ? 'Pause' : 'Play'}
                        className="w-14 h-14 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                      >
                        {isPlayingPreview ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6 ml-0.5 fill-current" />
                        )}
                      </button>
                      <div className="mt-4 max-w-md">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-teal-300">
                          Step {activePreviewStep + 1} of {video.steps.length}
                        </div>
                        <div className="text-sm font-medium text-white mt-1">
                          {video.steps[activePreviewStep]}
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-white/25 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-400 transition-all duration-200"
                          style={{ width: `${previewProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums bg-black/60 px-2 py-0.5 rounded">
                        {video.duration}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-teal-950 to-teal-700 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">
                    Already know this procedure?
                  </div>
                  <div className="text-xs text-teal-100 mt-0.5">
                    Go straight to practice. You can come back to the video any
                    time.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeTab('practice')}
                  className="bg-white text-teal-900 hover:bg-teal-50 font-bold text-xs px-4 py-2.5 rounded-xl shrink-0 min-h-[40px] transition-colors"
                >
                  Go to Practice
                </button>
              </div>

              <div>
                <h1 className="font-display font-bold text-xl sm:text-2xl text-slate-900">
                  {video.title}
                </h1>

                <div className="mt-2 flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Reviewed
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-medium text-teal-700">
                    {video.region} instructors
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>{video.category}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Uploaded {formatDaysAgo(video.daysAgo)}</span>
                </div>

                <div className="mt-3 flex items-center flex-wrap gap-4 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Eye className="w-4 h-4 text-slate-400" />
                    {formatCount(video.views + extraViews)} views
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleLike(video.id)}
                    aria-pressed={isLiked}
                    className={`inline-flex items-center gap-1.5 font-semibold min-h-[40px] transition-colors ${
                      isLiked
                        ? 'text-rose-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`}
                    />
                    <span className="tabular-nums">
                      {formatCount(video.likes + (isLiked ? 1 : 0))}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenComments(video.id)}
                    className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 min-h-[40px]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="tabular-nums">{commentCount} comments</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenInstructorProfile(video.instructor)}
                className="w-full bg-white border border-slate-200 hover:border-teal-400 rounded-2xl p-4 flex items-center justify-between gap-3.5 text-left transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-teal-600 text-white font-display font-bold flex items-center justify-center shrink-0">
                    {getInitials(video.instructor)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {video.instructor}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {video.organization}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-teal-600 shrink-0">
                  View profile
                </span>
              </button>
            </div>

            {/* Right / Step-by-step guide */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-bold text-base text-slate-900">
                    Step-by-step guide
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {doneCount} of {video.steps.length} done
                  </span>
                </div>

                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2.5">
                  <div
                    className="h-full bg-teal-500 transition-all duration-200"
                    style={{ width: `${donePct}%` }}
                  />
                </div>

                <p className="text-xs text-slate-500 mt-2.5">
                  Steps are generated from the video, then confirmed by the
                  instructor and a reviewer before publishing.
                </p>

                <div className="mt-3 divide-y divide-slate-100">
                  {video.steps.map((step, i) => {
                    const isDone = Boolean(completedSteps[i]);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onToggleStep(video.id, i)}
                        className="w-full flex items-start gap-3 py-3 text-left min-h-[44px] group"
                      >
                        <span
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-mono tabular-nums font-bold shrink-0 mt-0.5 transition-colors ${
                            isDone
                              ? 'bg-teal-500 border-teal-500 text-white'
                              : 'border-slate-300 text-slate-500 group-hover:border-teal-400'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </span>
                        <span
                          className={`text-sm leading-snug ${
                            isDone
                              ? 'line-through text-slate-400'
                              : 'text-slate-800'
                          }`}
                        >
                          {step}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onChangeTab('practice')}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors min-h-[48px]"
              >
                Practice this procedure
              </button>

              <p className="text-xs text-slate-500 text-center">
                Educational use only. Follow your institution’s policy and
                supervision.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
