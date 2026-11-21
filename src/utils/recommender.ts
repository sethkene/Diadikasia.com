import type {
  Discipline,
  Friend,
  ReelPost,
  ReelSignals,
  ReelsFeedTab,
  RegionFilter,
  ReportedPost,
} from '../types';

export interface RankedReelsResult {
  rankedPosts: ReelPost[];
  reasonsByPostId: Record<number, string>;
  topInterests: string[];
}

interface ScoredCandidate {
  post: ReelPost;
  score: number;
  reason: string;
}

export function rankReels({
  posts,
  feedTab,
  activeDiscipline,
  activeRegion,
  friends,
  currentUserName,
  signals,
  reports,
}: {
  posts: ReelPost[];
  feedTab: ReelsFeedTab;
  activeDiscipline: Discipline;
  activeRegion: RegionFilter;
  friends: Friend[];
  currentUserName: string;
  signals: ReelSignals;
  reports: ReportedPost[];
}): RankedReelsResult {
  const hiddenIds = new Set(signals.notInterestedPostIds);
  const openReportedPostIds = new Set(
    reports.filter((r) => r.status === 'open').map((r) => r.postId),
  );
  const friendNames = new Set(
    friends.map((f) => f.name.toLowerCase()),
  );

  // Stage 1: Candidate retrieval by feed tab + negative filter
  // Exclude blocking 'practice' cards (practice milestones now appear as non-blocking pop-ups)
  const candidates = posts.filter((post) => {
    if (post.kind === 'practice') return false;
    if (hiddenIds.has(post.id)) return false;

    if (feedTab === 'friends') {
      const byName = post.by.toLowerCase();
      const isMe =
        currentUserName &&
        byName === currentUserName.toLowerCase();
      const isFriend = friendNames.has(byName);
      return isMe || isFriend;
    }

    return true;
  });

  // For Friends feed, preserve chronological / newest-first order with friend context
  if (feedTab === 'friends') {
    const reasonsByPostId: Record<number, string> = {};
    for (const p of candidates) {
      reasonsByPostId[p.id] =
        currentUserName && p.by.toLowerCase() === currentUserName.toLowerCase()
          ? 'Your post'
          : 'From your study network';
    }
    return {
      rankedPosts: candidates,
      reasonsByPostId,
      topInterests: getTopInterests(signals, activeDiscipline),
    };
  }

  // Stage 2: Score each candidate using clinical learning + engagement + safety signals
  const scored: ScoredCandidate[] = candidates.map((post) => {
    let score = 0;
    const reasonParts: Array<{ weight: number; label: string }> = [];

    // 1. Fresh / Cold-start exploration boost so new posts get tested
    if (post.ago === 'Just now' || post.views < 60) {
      score += 24;
      reasonParts.push({ weight: 24, label: 'New upload in discovery pool' });
    }

    // 2. Verified Clinical Instructor trust multiplier
    if (post.verified) {
      score += 18;
      reasonParts.push({ weight: 18, label: 'Verified clinical instructor' });
    }

    // 3. Active study context + personal category/discipline affinity
    if (post.discipline && post.discipline !== 'general') {
      const affinity = signals.disciplineAffinity[post.discipline] || 0;
      const contextBonus = post.discipline === activeDiscipline ? 16 : 4;
      const totalDisc = contextBonus + Math.min(20, affinity * 2);
      score += totalDisc;

      if (post.category) {
        const catAff = signals.categoryAffinity[post.category] || 0;
        const catScore = Math.min(28, catAff * 5);
        score += catScore;
        reasonParts.push({
          weight: totalDisc + catScore,
          label: `Matches ${
            post.discipline === 'nursing' ? 'Nursing' : 'Surgical'
          } · ${post.category}`,
        });
      } else if (post.discipline === activeDiscipline) {
        reasonParts.push({
          weight: totalDisc,
          label: `Matches ${
            post.discipline === 'nursing' ? 'Nursing' : 'Surgical'
          } focus`,
        });
      }
    }

    // 4. Regional teaching context match
    if (activeRegion !== 'All' && post.reg === activeRegion) {
      score += 9;
    }

    // 5. Educational conversion & engagement signals
    const practiceClicks =
      (post.practiceClicks || 0) +
      (signals.practiceConversions.includes(post.id) ? 3 : 0);
    const engagementScore =
      Math.log10(Math.max(10, post.likes + 1)) * 5 +
      post.comments.length * 2.5 +
      Math.min(26, practiceClicks * 0.45);
    score += engagementScore;

    if (post.vid && (post.practiceClicks || 0) >= 25) {
      reasonParts.push({
        weight: 19,
        label: 'High practice conversion',
      });
    }

    // 6. User dwell vs fast-skip signals
    const dwellMs = signals.dwellMsByPost[post.id] || 0;
    const skips = signals.fastSkipsByPost[post.id] || 0;
    if (dwellMs >= 4000) {
      score += 6;
    }
    if (skips > 0) {
      score -= Math.min(30, skips * 14);
    }

    // 7. Genre negative feedback
    if (post.genre && signals.notInterestedGenres[post.genre]) {
      score -= signals.notInterestedGenres[post.genre] * 18;
    }

    // 8. Safety throttle for posts with open moderation reports
    if (openReportedPostIds.has(post.id)) {
      score -= 60;
      reasonParts.unshift({
        weight: 99,
        label: 'Limited visibility pending moderation review',
      });
    }

    reasonParts.sort((a, b) => b.weight - a.weight);
    const topReason =
      reasonParts[0]?.label ||
      (friendNames.has(post.by.toLowerCase())
        ? 'From your study network'
        : 'Recommended for clinical study');

    return { post, score, reason: topReason };
  });

  scored.sort((a, b) => b.score - a.score);

  // Stage 3: Diversity Re-Ranker (prevent consecutive posts from same author/category)
  const remaining = [...scored];
  const reRanked: ScoredCandidate[] = [];

  while (remaining.length > 0) {
    const prev = reRanked[reRanked.length - 1];
    let chosenIdx = 0;

    if (prev && remaining.length > 1) {
      const diverseIdx = remaining.findIndex(
        (cand) =>
          cand.post.by !== prev.post.by &&
          (!cand.post.category || cand.post.category !== prev.post.category),
      );
      if (diverseIdx !== -1 && diverseIdx <= 2) {
        chosenIdx = diverseIdx;
      }
    }

    const [picked] = remaining.splice(chosenIdx, 1);
    reRanked.push(picked);
  }

  const reasonsByPostId: Record<number, string> = {};
  for (const item of reRanked) {
    reasonsByPostId[item.post.id] = item.reason;
  }

  return {
    rankedPosts: reRanked.map((r) => r.post),
    reasonsByPostId,
    topInterests: getTopInterests(signals, activeDiscipline),
  };
}

function getTopInterests(
  signals: ReelSignals,
  activeDiscipline: Discipline,
): string[] {
  const entries = Object.entries(signals.categoryAffinity)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  if (entries.length > 0) return entries;
  return [
    activeDiscipline === 'nursing'
      ? 'Nursing procedures'
      : 'Surgical procedures',
  ];
}
