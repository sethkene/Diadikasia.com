import type {
  ContributeForm,
  InviteForm,
  NewPostForm,
  PracticeSession,
  ProcedureVideo,
} from '../types';

export function formatCount(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(n);
}

export function formatDaysAgo(days: number): string {
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return '1 month ago';
}

export function getInitials(name: string): string {
  const base = name.split(',')[0].trim();
  const initials = base
    .split(/\s+/)
    .filter((w) => w && !/^(Dr\.|Prof\.)$/i.test(w))
    .map((w) => w[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
  return initials || 'U';
}

export function getProcedureGradient(hue: number): string {
  return `linear-gradient(135deg, hsl(${hue} 52% 22%), hsl(${(hue + 28) % 360} 58% 36%))`;
}

export function seededShuffle(arr: number[], seedInput: number): number[] {
  const copy = [...arr];
  let s = seedInput * 9301 + 49297;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createPracticeSession(video: ProcedureVideo): PracticeSession {
  const n = video.steps.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 3) {
    return {
      vid: video.id,
      tooFew: true,
      shuffled: idx,
      nextQuestions: [],
      missingIdx: 0,
      missingOptions: [],
      part: 1,
      selectedOrder: [],
      tries: 0,
      orderOk: false,
      revealed: false,
      questionIdx: 0,
      questionPick: null,
      missingPick: null,
      missedSteps: [],
      firstTry: { order: null, nextQ: [], missing: null },
      reflection: '',
      feedbackMsg: '',
      feedbackGood: false,
    };
  }

  let shuffled = seededShuffle(idx, video.id);
  if (shuffled.every((x, i) => x === i)) {
    shuffled = [...shuffled].reverse();
  }

  const promptPositions = [...new Set([1, n - 2])].filter((p) => p >= 0 && p < n - 1);
  const nextQuestions = promptPositions.map((p, k) => {
    const distractors = seededShuffle(
      idx.filter((i) => i !== p + 1 && i !== p),
      video.id + k + 1,
    ).slice(0, 2);
    return {
      promptIdx: p,
      rightIdx: p + 1,
      options: seededShuffle([p + 1, ...distractors], video.id + k + 7),
    };
  });

  const missingIdx = Math.floor(n / 2);
  const missingDistractors = seededShuffle(
    idx.filter((i) => i !== missingIdx),
    video.id + 3,
  ).slice(0, 2);

  return {
    vid: video.id,
    shuffled,
    nextQuestions,
    missingIdx,
    missingOptions: seededShuffle([missingIdx, ...missingDistractors], video.id + 5),
    part: 1,
    selectedOrder: [],
    tries: 0,
    orderOk: false,
    revealed: false,
    questionIdx: 0,
    questionPick: null,
    missingPick: null,
    missedSteps: [],
    firstTry: { order: null, nextQ: [], missing: null },
    reflection: '',
    feedbackMsg: '',
    feedbackGood: false,
  };
}

export function createDefaultContributeForm(): ContributeForm {
  return {
    steps: [
      'Draft step 1',
      'Draft step 2',
      'Draft step 3',
      'Draft step 4',
      'Draft step 5',
    ],
    url: '',
    name: '',
    genState: 0,
    discipline: 'nursing',
    category: '',
    region: 'African',
    title: '',
    by: '',
    org: '',
    ownsRights: false,
    patientConsent: false,
    errors: [],
  };
}

export function createDefaultPostForm(): NewPostForm {
  return {
    kind: 'video',
    caption: '',
    genre: 'Tip',
    discipline: 'general',
    linkedVid: '',
    confirmed: false,
    url: '',
    name: '',
    isImg: false,
    err: '',
  };
}

export function createDefaultInvite(defaultVid: number): InviteForm {
  const d = new Date(Date.now() + 864e5);
  const pad = (num: number) => String(num).padStart(2, '0');
  return {
    vid: defaultVid,
    when: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`,
    note: '',
    err: '',
  };
}
