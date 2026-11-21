export type ScreenMode = 'splash' | 'auth' | 'app';
export type AuthMode = 'in' | 'up';
export type MainTab = 'home' | 'explore' | 'reels' | 'friends' | 'me';
export type Discipline = 'nursing' | 'surgical';
export type Region = 'African' | 'European' | 'Asian';
export type RegionFilter = 'All' | Region;
export type DetailTab = 'watch' | 'practice';
export type ReelsFeedTab = 'for_you' | 'friends';

export type UserRole = 'learner' | 'instructor' | 'sub_admin' | 'admin';

export interface StaffPermissions {
  canReviewVideos: boolean;
  canModeratePosts: boolean;
}

export interface UserProfile {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  qualifications?: string;
  youtubeHandle?: string;
  approvedAt?: string;
  permissions?: StaffPermissions;
  sharePracticePopups?: boolean;
}

export interface InstructorApplication {
  id: number;
  email: string;
  fullName: string;
  qualifications: string;
  youtubeHandle: string;
  note: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'declined';
  decisionNote?: string;
}

export interface ReportedPost {
  id: number;
  postId: number;
  reason: string;
  reportedBy: string;
  reportedAt: string;
  status: 'open' | 'removed' | 'dismissed';
}

export interface ProcedureVideo {
  id: number;
  discipline: Discipline;
  category: string;
  title: string;
  instructor: string;
  organization: string;
  region: Region;
  duration: string;
  steps: string[];
  hue: number;
  views: number;
  likes: number;
  daysAgo: number;
  videoUrl?: string;
}

export interface CommentItem {
  name: string;
  text: string;
  ago: string;
}

export interface ReelPost {
  id: number;
  kind: 'video' | 'photo' | 'practice';
  by: string;
  role: string;
  org: string;
  reg: string;
  bio: string;
  verified: boolean;
  genre: string;
  discipline?: Discipline | 'general';
  category?: string;
  caption?: string;
  hue: number;
  ago: string;
  views: number;
  likes: number;
  practiceClicks?: number;
  comments: CommentItem[];
  url?: string;
  isImage?: boolean;
  vid?: number;
  tries?: number;
  revealed?: boolean;
}

export interface ReelSignals {
  dwellMsByPost: Record<number, number>;
  fastSkipsByPost: Record<number, number>;
  notInterestedPostIds: number[];
  notInterestedGenres: Record<string, number>;
  categoryAffinity: Record<string, number>;
  disciplineAffinity: Record<Discipline, number>;
  practiceConversions: number[];
}

export interface PracticeMilestone {
  id: number;
  userName: string;
  procedureTitle: string;
  vid: number;
  category: string;
  points: number;
  scoreText: string;
  createdAt: number;
}

export interface Friend {
  name: string;
  online: boolean;
  lastSeen?: string;
  role: string;
}

export interface PersonCandidate {
  name: string;
  role: string;
}

export type ChatMessage =
  | { me: boolean; type: 'text'; text: string }
  | { me: boolean; type: 'remind'; vid: number }
  | { me: boolean; type: 'post'; pid: number }
  | {
      me: boolean;
      type: 'invite';
      vid: number;
      when: string;
      note: string;
      status: 'pending' | 'accepted';
    };

export interface NotificationItem {
  id: number;
  type: 'invite' | 'req' | 'remind';
  from: string;
  vid?: number;
  when?: string;
  status: 'pending' | 'accepted' | 'declined' | 'done' | 'seen';
}

export type SubmissionStatus = 'pending' | 'ok' | 'chg' | 'rej';

export interface SubmissionItem {
  id: number;
  submittedByEmail?: string;
  discipline: Discipline;
  category: string;
  title: string;
  instructor: string;
  organization: string;
  region: Region;
  duration: string;
  url: string;
  steps: string[];
  checks: boolean[];
  note: string;
  err: string;
  status: SubmissionStatus;
}

export interface NextQuestion {
  promptIdx: number;
  rightIdx: number;
  options: number[];
}

export interface PracticeSession {
  vid: number;
  tooFew?: boolean;
  shuffled: number[];
  nextQuestions: NextQuestion[];
  missingIdx: number;
  missingOptions: number[];
  part: 1 | 2 | 3 | 4;
  selectedOrder: number[];
  tries: number;
  orderOk: boolean;
  revealed: boolean;
  questionIdx: number;
  questionPick: number | null;
  missingPick: number | null;
  missedSteps: number[];
  firstTry: {
    order: boolean | null;
    nextQ: boolean[];
    missing: boolean | null;
  };
  reflection: string;
  feedbackMsg: string;
  feedbackGood: boolean;
  posted?: boolean;
}

export interface ContributeForm {
  steps: string[];
  url: string;
  name: string;
  genState: 0 | 1 | 2;
  discipline: Discipline;
  category: string;
  region: Region;
  title: string;
  by: string;
  org: string;
  ownsRights: boolean;
  patientConsent: boolean;
  errors: string[];
}

export interface NewPostForm {
  kind: 'video' | 'photo' | 'rec';
  caption: string;
  genre: string;
  discipline: Discipline | 'general';
  linkedVid: number | '';
  confirmed: boolean;
  url: string;
  name: string;
  isImg: boolean;
  err: string;
}

export interface InviteForm {
  vid: number;
  when: string;
  note: string;
  err: string;
}

export type SheetState =
  | { kind: 'comments'; target: 'post' | 'video'; id: number }
  | { kind: 'profile'; by: string }
  | { kind: 'newpost' }
  | { kind: 'notifications' }
  | { kind: 'invite' }
  | { kind: 'share'; postId: number }
  | { kind: 'report'; postId: number };
