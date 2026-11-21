import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Film,
  Home as HomeIcon,
  Plus,
  Search,
  User,
  Users,
} from 'lucide-react';
import { BottomSheets } from './components/BottomSheets';
import { BrandMark, BrandWordmark } from './components/BrandLogo';
import { ContributeModal } from './components/ContributeModal';
import { FriendsView } from './components/FriendsView';
import { InstructorApplyModal } from './components/InstructorApplyModal';
import { ProcedureCard } from './components/ProcedureCard';
import { ProcedureDetailModal } from './components/ProcedureDetailModal';
import { ProfileView } from './components/ProfileView';
import { ReelsView } from './components/ReelsView';
import { ReviewQueueModal } from './components/ReviewQueueModal';
import { SplashAuth, type AuthNotice } from './components/SplashAuth';
import {
  CATEGORIES,
  DISCOVER_PEOPLE,
  INITIAL_ACCOUNTS,
  INITIAL_APPLICATIONS,
  INITIAL_CHATS,
  INITIAL_FRIENDS,
  INITIAL_NOTIFICATIONS,
  INITIAL_POSTS,
  INITIAL_PRACTICE_MILESTONES,
  INITIAL_REEL_SIGNALS,
  INITIAL_REPORTS,
  INITIAL_SUBMISSIONS_QUEUE,
  INITIAL_UNREAD,
  INITIAL_VIDEOS,
  INITIAL_VIDEO_COMMENTS,
  REGIONS,
} from './data/seed';
import type {
  AuthMode,
  ChatMessage,
  CommentItem,
  ContributeForm,
  DetailTab,
  Discipline,
  Friend,
  InstructorApplication,
  InviteForm,
  MainTab,
  NewPostForm,
  NotificationItem,
  PracticeMilestone,
  PracticeSession,
  ProcedureVideo,
  ReelPost,
  ReelSignals,
  ReelsFeedTab,
  RegionFilter,
  ReportedPost,
  ScreenMode,
  SheetState,
  StaffPermissions,
  SubmissionItem,
  SubmissionStatus,
  UserProfile,
} from './types';
import {
  createDefaultContributeForm,
  createDefaultInvite,
  createDefaultPostForm,
  createPracticeSession,
} from './utils/format';
import {
  initNativeShell,
  registerAndroidBackHandler,
  triggerHaptic,
} from './utils/native';
import { rankReels } from './utils/recommender';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  fetchDirectoryProfiles,
  fetchMyProfile,
  isEmailVerified,
  processAuthCallbackFromUrl,
  signOutSupabase,
  updateMySharePopupsPreference,
} from './services/auth';

const NAV_ITEMS: Array<{
  id: MainTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'explore', label: 'Explore', Icon: Search },
  { id: 'reels', label: 'Reels', Icon: Film },
  { id: 'friends', label: 'Friends', Icon: Users },
  { id: 'me', label: 'Profile', Icon: User },
];

const STORAGE_KEYS = {
  user: 'diadikasia_user_v2',
  accounts: 'diadikasia_accounts_v2',
  applications: 'diadikasia_apps_v2',
  reports: 'diadikasia_reports_v2',
  posts: 'diadikasia_posts_v2',
  submissions: 'diadikasia_submissions_v2',
  signals: 'diadikasia_reel_signals_v1',
  milestones: 'diadikasia_milestones_v1',
  sharePopups: 'diadikasia_share_popups_v1',
  videos: 'diadikasia_videos_v2',
  savedIds: 'diadikasia_saved_v1',
  likedKeys: 'diadikasia_liked_v1',
  completedSteps: 'diadikasia_steps_v1',
  extraViews: 'diadikasia_views_v1',
  videoComments: 'diadikasia_vcomments_v1',
  friends: 'diadikasia_friends_v1',
  sentRequests: 'diadikasia_sent_reqs_v1',
  chats: 'diadikasia_chats_v1',
  unreadCounts: 'diadikasia_unread_v1',
  notifications: 'diadikasia_notifs_v1',
};

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

export default function App() {
  const [accounts, setAccounts] = useState<UserProfile[]>(() =>
    readStored(STORAGE_KEYS.accounts, INITIAL_ACCOUNTS),
  );
  const [applications, setApplications] = useState<InstructorApplication[]>(() =>
    readStored(STORAGE_KEYS.applications, INITIAL_APPLICATIONS),
  );
  const [reports, setReports] = useState<ReportedPost[]>(() =>
    readStored(STORAGE_KEYS.reports, INITIAL_REPORTS),
  );

  const [screen, setScreen] = useState<ScreenMode>('splash');
  const [authMode, setAuthMode] = useState<AuthMode>('in');
  const [authNotice, setAuthNotice] = useState<AuthNotice | undefined>(
    undefined,
  );
  const [user, setUser] = useState<UserProfile>({
    email: '',
    name: '',
    role: 'learner',
  });

  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [discipline, setDiscipline] = useState<Discipline>('nursing');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [videos, setVideos] = useState<ProcedureVideo[]>(() =>
    readStored(STORAGE_KEYS.videos, INITIAL_VIDEOS),
  );
  const [openVideoId, setOpenVideoId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('watch');
  const [practiceSession, setPracticeSession] =
    useState<PracticeSession | null>(null);

  const [completedStepsMap, setCompletedStepsMap] = useState<
    Record<number, boolean[]>
  >(() => readStored(STORAGE_KEYS.completedSteps, {}));
  const [savedIds, setSavedIds] = useState<Set<number>>(
    () => new Set(readStored<number[]>(STORAGE_KEYS.savedIds, [])),
  );
  const [likedKeys, setLikedKeys] = useState<Set<string>>(
    () => new Set(readStored<string[]>(STORAGE_KEYS.likedKeys, [])),
  );
  const [extraViews, setExtraViews] = useState<Record<number, number>>(() =>
    readStored(STORAGE_KEYS.extraViews, {}),
  );
  const [videoComments, setVideoComments] = useState<
    Record<number, CommentItem[]>
  >(() => readStored(STORAGE_KEYS.videoComments, INITIAL_VIDEO_COMMENTS));

  const [posts, setPosts] = useState<ReelPost[]>(() =>
    readStored(STORAGE_KEYS.posts, INITIAL_POSTS),
  );
  const [reelsFeedTab, setReelsFeedTab] = useState<ReelsFeedTab>('for_you');
  const [reelSignals, setReelSignals] = useState<ReelSignals>(() =>
    readStored(STORAGE_KEYS.signals, INITIAL_REEL_SIGNALS),
  );
  const [shareEnabled, setShareEnabled] = useState<boolean>(() =>
    readStored(STORAGE_KEYS.sharePopups, true),
  );
  const [milestones, setMilestones] = useState<PracticeMilestone[]>(() =>
    readStored(STORAGE_KEYS.milestones, INITIAL_PRACTICE_MILESTONES),
  );

  const [friends, setFriends] = useState<Friend[]>(() =>
    readStored(STORAGE_KEYS.friends, INITIAL_FRIENDS),
  );
  const [sentRequests, setSentRequests] = useState<string[]>(() =>
    readStored(STORAGE_KEYS.sentRequests, []),
  );
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() =>
    readStored(STORAGE_KEYS.chats, INITIAL_CHATS),
  );
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(() =>
    readStored(STORAGE_KEYS.unreadCounts, INITIAL_UNREAD),
  );
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    readStored(STORAGE_KEYS.notifications, INITIAL_NOTIFICATIONS),
  );

  const [submissionsQueue, setSubmissionsQueue] = useState<SubmissionItem[]>(() =>
    readStored(STORAGE_KEYS.submissions, INITIAL_SUBMISSIONS_QUEUE),
  );
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeSubmitted, setContributeSubmitted] = useState(false);
  const [contributeForm, setContributeForm] = useState<ContributeForm>(
    createDefaultContributeForm,
  );
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [postForm, setPostForm] = useState<NewPostForm>(createDefaultPostForm);
  const [inviteForm, setInviteForm] = useState<InviteForm>(() =>
    createDefaultInvite(INITIAL_VIDEOS[0].id),
  );

  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);
  const nextIdRef = useRef<number>(Date.now());
  const appliedAuthUserIdRef = useRef<string | null>(null);
  const inFlightAuthUserIdRef = useRef<string | null>(null);
  const recoveryModeRef = useRef<boolean>(false);

  // Persist RBAC, procedures, study progress, and community state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
      localStorage.setItem(
        STORAGE_KEYS.applications,
        JSON.stringify(applications),
      );
      localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports));
      localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
      localStorage.setItem(
        STORAGE_KEYS.submissions,
        JSON.stringify(submissionsQueue),
      );
      localStorage.setItem(STORAGE_KEYS.signals, JSON.stringify(reelSignals));
      localStorage.setItem(STORAGE_KEYS.milestones, JSON.stringify(milestones));
      localStorage.setItem(
        STORAGE_KEYS.sharePopups,
        JSON.stringify(shareEnabled),
      );
      localStorage.setItem(STORAGE_KEYS.videos, JSON.stringify(videos));
      localStorage.setItem(
        STORAGE_KEYS.savedIds,
        JSON.stringify(Array.from(savedIds)),
      );
      localStorage.setItem(
        STORAGE_KEYS.likedKeys,
        JSON.stringify(Array.from(likedKeys)),
      );
      localStorage.setItem(
        STORAGE_KEYS.completedSteps,
        JSON.stringify(completedStepsMap),
      );
      localStorage.setItem(STORAGE_KEYS.extraViews, JSON.stringify(extraViews));
      localStorage.setItem(
        STORAGE_KEYS.videoComments,
        JSON.stringify(videoComments),
      );
      localStorage.setItem(STORAGE_KEYS.friends, JSON.stringify(friends));
      localStorage.setItem(
        STORAGE_KEYS.sentRequests,
        JSON.stringify(sentRequests),
      );
      localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats));
      localStorage.setItem(
        STORAGE_KEYS.unreadCounts,
        JSON.stringify(unreadCounts),
      );
      localStorage.setItem(
        STORAGE_KEYS.notifications,
        JSON.stringify(notifications),
      );
    } catch {
      // ignore storage errors
    }
  }, [
    accounts,
    applications,
    reports,
    posts,
    submissionsQueue,
    reelSignals,
    milestones,
    shareEnabled,
    videos,
    savedIds,
    likedKeys,
    completedStepsMap,
    extraViews,
    videoComments,
    friends,
    sentRequests,
    chats,
    unreadCounts,
    notifications,
  ]);

  // Keep active user synced with accounts updates (e.g. role promotions/revocations)
  useEffect(() => {
    if (!user.email) return;
    const synced = accounts.find((a) =>
      user.id
        ? a.id === user.id
        : a.email.toLowerCase() === user.email.toLowerCase(),
    );
    if (synced && JSON.stringify(synced) !== JSON.stringify(user)) {
      setUser(synced);
      try {
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(synced));
      } catch {
        // ignore
      }
    }
  }, [accounts, user]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2600);
  }, []);

  const backStateRef = useRef({
    screen,
    sheet,
    reviewQueueOpen,
    contributeOpen,
    applyModalOpen,
    openVideoId,
    activeChat,
    activeTab,
  });
  backStateRef.current = {
    screen,
    sheet,
    reviewQueueOpen,
    contributeOpen,
    applyModalOpen,
    openVideoId,
    activeChat,
    activeTab,
  };

  useEffect(() => {
    void initNativeShell(screen === 'app');
  }, [screen]);

  useEffect(() => {
    return registerAndroidBackHandler(() => {
      const s = backStateRef.current;
      if (s.screen !== 'app') return false;
      if (s.sheet) {
        setSheet(null);
        return true;
      }
      if (s.reviewQueueOpen) {
        setReviewQueueOpen(false);
        return true;
      }
      if (s.contributeOpen) {
        setContributeOpen(false);
        return true;
      }
      if (s.applyModalOpen) {
        setApplyModalOpen(false);
        return true;
      }
      if (s.openVideoId !== null) {
        setOpenVideoId(null);
        return true;
      }
      if (s.activeChat) {
        setActiveChat(null);
        return true;
      }
      if (s.activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    });
  }, []);

  // Sync active Supabase Auth session, email confirmation callbacks & profiles on startup
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      appliedAuthUserIdRef.current = null;
      inFlightAuthUserIdRef.current = null;
      recoveryModeRef.current = false;
      try {
        localStorage.removeItem(STORAGE_KEYS.user);
      } catch {
        // ignore
      }
      setUser({ email: '', name: '', role: 'learner' });
      setScreen((prev) => (prev === 'app' ? 'auth' : prev));
      return;
    }

    let active = true;
    let unsubscribeAuth: (() => void) | null = null;

    const mergeDirectory = (
      prev: UserProfile[],
      directory: UserProfile[],
    ): UserProfile[] => {
      const keyFor = (u: UserProfile) =>
        u.email
          ? `e:${u.email.toLowerCase()}`
          : u.id
          ? `id:${u.id}`
          : `n:${u.name.toLowerCase()}`;
      const map = new Map<string, UserProfile>();
      for (const item of prev) map.set(keyFor(item), item);
      for (const remote of directory) map.set(keyFor(remote), remote);
      return Array.from(map.values());
    };

    const commitAuthenticatedProfile = async (resolvedProfile: UserProfile) => {
      if (resolvedProfile.id) {
        appliedAuthUserIdRef.current = resolvedProfile.id;
      }
      const directory = await fetchDirectoryProfiles(
        resolvedProfile.role === 'admin',
      );
      if (!active) return;

      if (directory.length > 0) {
        setAccounts((prev) => mergeDirectory(prev, directory));
      }

      setUser(resolvedProfile);
      if (typeof resolvedProfile.sharePracticePopups === 'boolean') {
        setShareEnabled(resolvedProfile.sharePracticePopups);
      }
      try {
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(resolvedProfile));
      } catch {
        // ignore
      }
      setAuthNotice(undefined);
      setScreen('app');
    };

    const applyAuthenticatedProfile = async (sessionUser: {
      id: string;
      email?: string;
      email_confirmed_at?: string | null;
      user_metadata?: Record<string, unknown>;
    }) => {
      if (!isEmailVerified(sessionUser)) {
        appliedAuthUserIdRef.current = null;
        inFlightAuthUserIdRef.current = null;
        void signOutSupabase();
        clearSessionState(
          {
            info: 'Please confirm your email using the link sent to your inbox before continuing.',
          },
          true,
        );
        return;
      }

      inFlightAuthUserIdRef.current = sessionUser.id;
      try {
        const profile = await fetchMyProfile(sessionUser.id);
        if (!active) return;

        const resolvedProfile: UserProfile = profile || {
          id: sessionUser.id,
          email: sessionUser.email || '',
          name:
            (typeof sessionUser.user_metadata?.name === 'string' &&
              sessionUser.user_metadata.name) ||
            (sessionUser.email ? sessionUser.email.split('@')[0] : 'Learner'),
          role: 'learner',
        };

        await commitAuthenticatedProfile(resolvedProfile);
      } finally {
        if (inFlightAuthUserIdRef.current === sessionUser.id) {
          inFlightAuthUserIdRef.current = null;
        }
      }
    };

    const clearSessionState = (notice?: AuthNotice, forceAuthScreen = false) => {
      appliedAuthUserIdRef.current = null;
      inFlightAuthUserIdRef.current = null;
      try {
        localStorage.removeItem(STORAGE_KEYS.user);
      } catch {
        // ignore
      }
      setUser({ email: '', name: '', role: 'learner' });
      if (notice) {
        setAuthNotice(notice);
      }
      setScreen((prev) =>
        forceAuthScreen ? 'auth' : prev === 'app' ? 'auth' : prev,
      );
    };

    const initAuth = async () => {
      const callback = await processAuthCallbackFromUrl();
      if (!active) return;

      if (callback.handled) {
        if (callback.error) {
          clearSessionState({ error: callback.error }, true);
        } else if (callback.recovery) {
          recoveryModeRef.current = true;
          setAuthNotice({
            recoverySession: true,
            info: 'Reset link verified. Choose a new password to continue.',
          });
          setScreen('auth');
        } else if (callback.verified && callback.user) {
          appliedAuthUserIdRef.current = callback.user.id || null;
          await commitAuthenticatedProfile(callback.user);
          if (active) {
            showToast('Email confirmed. Welcome to Diadikasia.');
          }
        }
      }

      const { data: listener } = client.auth.onAuthStateChange(
        (event, session) => {
          if (!active) return;

          if (event === 'PASSWORD_RECOVERY') {
            recoveryModeRef.current = true;
            setAuthNotice({
              recoverySession: true,
              info: 'Reset link verified. Choose a new password to continue.',
            });
            setScreen('auth');
            return;
          }

          if (event === 'SIGNED_OUT') {
            recoveryModeRef.current = false;
            clearSessionState(undefined, false);
            setScreen((prev) => (prev === 'splash' ? prev : 'auth'));
            return;
          }

          if (
            event === 'INITIAL_SESSION' ||
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED'
          ) {
            if (!session?.user) {
              if (event === 'INITIAL_SESSION') {
                clearSessionState(undefined, false);
              }
              return;
            }

            if (!isEmailVerified(session.user)) {
              void signOutSupabase();
              clearSessionState(
                {
                  info: 'Please confirm your email using the link sent to your inbox before continuing.',
                },
                true,
              );
              return;
            }

            if (recoveryModeRef.current) {
              return;
            }

            if (
              event !== 'USER_UPDATED' &&
              (appliedAuthUserIdRef.current === session.user.id ||
                inFlightAuthUserIdRef.current === session.user.id)
            ) {
              setScreen('app');
              return;
            }

            void applyAuthenticatedProfile(session.user);
          }
        },
      );

      unsubscribeAuth = () => listener.subscription.unsubscribe();
      if (!active) {
        unsubscribeAuth();
        unsubscribeAuth = null;
      }
    };

    void initAuth().catch(() => {
      if (!active) return;
      clearSessionState(undefined, false);
    });

    return () => {
      active = false;
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, [showToast]);

  useEffect(() => {
    if (screen !== 'splash') return;
    const t = window.setTimeout(() => {
      setScreen((prev) => (prev === 'splash' ? 'auth' : prev));
    }, 2400);
    return () => window.clearTimeout(t);
  }, [screen]);

  const handleAuthenticate = (profile: UserProfile, isNewAccount: boolean) => {
    recoveryModeRef.current = false;
    setAuthNotice(undefined);
    if (profile.id) {
      appliedAuthUserIdRef.current = profile.id;
    }

    if (isNewAccount || isSupabaseConfigured) {
      setAccounts((prev) => {
        const idx = prev.findIndex(
          (a) => a.email && a.email.toLowerCase() === profile.email.toLowerCase(),
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = profile;
          return next;
        }
        return [...prev, profile];
      });
    }
    setUser(profile);
    if (typeof profile.sharePracticePopups === 'boolean') {
      setShareEnabled(profile.sharePracticePopups);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(profile));
    } catch {
      // ignore
    }
    setScreen('app');

    if (isSupabaseConfigured) {
      void fetchDirectoryProfiles(profile.role === 'admin').then((directory) => {
        if (directory.length === 0) return;
        setAccounts((prev) => {
          const keyFor = (u: UserProfile) =>
            u.email
              ? `e:${u.email.toLowerCase()}`
              : u.id
              ? `id:${u.id}`
              : `n:${u.name.toLowerCase()}`;
          const map = new Map<string, UserProfile>();
          for (const item of prev) map.set(keyFor(item), item);
          for (const remote of directory) map.set(keyFor(remote), remote);
          return Array.from(map.values());
        });
      });
    }
  };

  const handleSignOut = () => {
    appliedAuthUserIdRef.current = null;
    inFlightAuthUserIdRef.current = null;
    recoveryModeRef.current = false;
    setAuthNotice(undefined);
    void signOutSupabase();
    try {
      localStorage.removeItem(STORAGE_KEYS.user);
    } catch {
      // ignore
    }
    setUser({ email: '', name: '', role: 'learner' });
    setScreen('auth');
    setAuthMode('in');
    setActiveTab('home');
    setOpenVideoId(null);
    setContributeOpen(false);
    setReviewQueueOpen(false);
    setApplyModalOpen(false);
    setActiveChat(null);
    setSheet(null);
    setSearchQuery('');
  };

  const canContribute = user.role === 'instructor' || user.role === 'admin';
  const canReviewVideos =
    user.role === 'admin' ||
    (user.role === 'sub_admin' && Boolean(user.permissions?.canReviewVideos));

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return videos.filter((v) => {
      if (v.discipline !== discipline) return false;
      if (regionFilter !== 'All' && v.region !== regionFilter) return false;
      if (categoryFilter !== 'All' && v.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return `${v.title} ${v.instructor} ${v.organization}`
        .toLowerCase()
        .includes(q);
    });
  }, [videos, discipline, regionFilter, categoryFilter, searchQuery]);

  const savedVideos = useMemo(
    () => videos.filter((v) => savedIds.has(v.id)),
    [videos, savedIds],
  );

  const pendingNotifCount = useMemo(
    () =>
      notifications.filter(
        (n) => n.status === 'pending' && n.type !== 'remind',
      ).length,
    [notifications],
  );

  const boostAffinity = useCallback(
    (
      disc?: Discipline | 'general',
      category?: string,
      amount: number = 1,
    ) => {
      if (!disc && !category) return;
      setReelSignals((prev) => ({
        ...prev,
        disciplineAffinity:
          disc && disc !== 'general'
            ? {
                ...prev.disciplineAffinity,
                [disc]: (prev.disciplineAffinity[disc] || 0) + amount,
              }
            : prev.disciplineAffinity,
        categoryAffinity: category
          ? {
              ...prev.categoryAffinity,
              [category]: (prev.categoryAffinity[category] || 0) + amount,
            }
          : prev.categoryAffinity,
      }));
    },
    [],
  );

  const rankedReelsResult = useMemo(
    () =>
      rankReels({
        posts,
        feedTab: reelsFeedTab,
        activeDiscipline: discipline,
        activeRegion: regionFilter,
        friends,
        currentUserName: user.name,
        signals: reelSignals,
        reports,
      }),
    [
      posts,
      reelsFeedTab,
      discipline,
      regionFilter,
      friends,
      user.name,
      reelSignals,
      reports,
    ],
  );

  const openProcedure = (videoId: number, initialTab: DetailTab = 'watch') => {
    const target = videos.find((v) => v.id === videoId);
    if (!target) return;
    setOpenVideoId(videoId);
    setDetailTab(initialTab);
    setPracticeSession(createPracticeSession(target));
    setExtraViews((prev) => ({
      ...prev,
      [videoId]: (prev[videoId] || 0) + 1,
    }));
    boostAffinity(target.discipline, target.category, initialTab === 'practice' ? 2 : 1);
  };

  const toggleSaveVideo = (videoId: number) => {
    const target = videos.find((v) => v.id === videoId);
    const willSave = !savedIds.has(videoId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
    if (willSave && target) {
      boostAffinity(target.discipline, target.category, 2);
    }
    triggerHaptic('light');
  };

  const toggleLikeKey = (key: string) => {
    const willLike = !likedKeys.has(key);
    setLikedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (willLike && key.startsWith('p')) {
      const postId = Number(key.slice(1));
      const post = posts.find((p) => p.id === postId);
      if (post) boostAffinity(post.discipline, post.category, 2);
    }
    triggerHaptic('light');
  };

  const ensureLikePost = (postId: number) => {
    const key = `p${postId}`;
    if (likedKeys.has(key)) return;
    setLikedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const post = posts.find((p) => p.id === postId);
    if (post) boostAffinity(post.discipline, post.category, 2);
  };

  const toggleStepDone = (videoId: number, stepIndex: number) => {
    setCompletedStepsMap((prev) => {
      const existing = [...(prev[videoId] || [])];
      existing[stepIndex] = !existing[stepIndex];
      return { ...prev, [videoId]: existing };
    });
  };

  const postPracticeToReels = (
    session: PracticeSession,
    isFinalDebrief = false,
  ) => {
    const targetVideo = videos.find((v) => v.id === session.vid);
    if (targetVideo) {
      boostAffinity(targetVideo.discipline, targetVideo.category, 2);
    }
    if (!shareEnabled) return;
    if (!isFinalDebrief && session.posted) return;

    const totalItems = 2 + session.nextQuestions.length;
    const firstTryCorrect =
      (session.firstTry.order ? 1 : 0) +
      session.firstTry.nextQ.filter(Boolean).length +
      (session.firstTry.missing ? 1 : 0);

    const points = isFinalDebrief
      ? Math.max(20, firstTryCorrect * 12 + 10)
      : session.tries === 1 && !session.revealed
      ? 25
      : 15;

    const scoreText = isFinalDebrief
      ? `${firstTryCorrect}/${totalItems} first try`
      : session.tries === 1 && !session.revealed
      ? 'First try order'
      : 'Sequence completed';

    const userName = user.name || 'Learner';
    const newMilestone: PracticeMilestone = {
      id: nextIdRef.current++,
      userName,
      procedureTitle: targetVideo?.title || 'Clinical procedure',
      vid: session.vid,
      category: targetVideo?.category || 'Clinical skills',
      points,
      scoreText,
      createdAt: Date.now(),
    };

    session.posted = true;
    setMilestones((prev) => {
      const filtered = isFinalDebrief
        ? prev.filter(
            (m) =>
              !(
                m.vid === session.vid &&
                m.userName === userName &&
                Date.now() - m.createdAt < 600000
              ),
          )
        : prev;
      return [newMilestone, ...filtered].slice(0, 20);
    });
  };

  const handlePracticeAction = (
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
  ) => {
    if (!practiceSession) return;
    const p: PracticeSession = {
      ...practiceSession,
      selectedOrder: [...practiceSession.selectedOrder],
      missedSteps: [...practiceSession.missedSteps],
      firstTry: {
        ...practiceSession.firstTry,
        nextQ: [...practiceSession.firstTry.nextQ],
      },
    };

    if (action.type === 'toggle-order') {
      if (p.orderOk || p.revealed) return;
      const idx = p.selectedOrder.indexOf(action.stepIdx);
      if (idx >= 0) p.selectedOrder.splice(idx, 1);
      else p.selectedOrder.push(action.stepIdx);
      p.feedbackMsg = '';
    } else if (action.type === 'reset-order') {
      p.selectedOrder = [];
      p.feedbackMsg = '';
    } else if (action.type === 'check-order') {
      if (p.selectedOrder.length < p.shuffled.length) {
        p.feedbackMsg = 'Tap every step first.';
        p.feedbackGood = false;
        setPracticeSession(p);
        return;
      }
      const isOk = p.selectedOrder.every((x, i) => x === i);
      p.tries += 1;
      if (p.firstTry.order === null) p.firstTry.order = isOk;
      if (isOk) {
        p.orderOk = true;
        p.feedbackMsg = '✓ Correct order.';
        p.feedbackGood = true;
        postPracticeToReels(p);
        triggerHaptic('success');
      } else {
        const wrongCount = p.selectedOrder.filter((x, i) => x !== i).length;
        p.selectedOrder.forEach((x, i) => {
          if (x !== i) p.missedSteps.push(i);
        });
        p.feedbackMsg = `✗ Not quite. ${wrongCount} step(s) are in the wrong place.`;
        p.feedbackGood = false;
        triggerHaptic('error');
      }
    } else if (action.type === 'reveal-order') {
      p.revealed = true;
      if (p.firstTry.order === null) p.firstTry.order = false;
      p.selectedOrder = p.shuffled.map((_, i) => i);
      p.shuffled.forEach((_, i) => p.missedSteps.push(i));
      p.feedbackMsg =
        'Here is the correct order. Review it, then continue.';
      p.feedbackGood = true;
      postPracticeToReels(p);
    } else if (action.type === 'pick-next') {
      if (p.questionPick !== null) return;
      p.questionPick = action.optionPos;
      const q = p.nextQuestions[p.questionIdx];
      const ok = q.options[action.optionPos] === q.rightIdx;
      p.firstTry.nextQ[p.questionIdx] = ok;
      if (!ok) p.missedSteps.push(q.rightIdx);
      triggerHaptic(ok ? 'success' : 'error');
    } else if (action.type === 'pick-missing') {
      if (p.missingPick !== null) return;
      p.missingPick = action.optionPos;
      const ok = p.missingOptions[action.optionPos] === p.missingIdx;
      p.firstTry.missing = ok;
      if (!ok) p.missedSteps.push(p.missingIdx);
      triggerHaptic(ok ? 'success' : 'error');
    } else if (action.type === 'continue') {
      if (p.part === 1) {
        p.part = 2;
        p.questionIdx = 0;
        p.questionPick = null;
        p.feedbackMsg = '';
      } else if (p.part === 2) {
        if (p.questionIdx < p.nextQuestions.length - 1) {
          p.questionIdx += 1;
          p.questionPick = null;
        } else {
          p.part = 3;
        }
      } else {
        p.part = 4;
        postPracticeToReels(p, true);
      }
    } else if (action.type === 'restart') {
      const target = videos.find((v) => v.id === p.vid);
      if (target) setPracticeSession(createPracticeSession(target));
      return;
    } else if (action.type === 'reflection') {
      p.reflection = action.value;
    }

    setPracticeSession(p);
  };

  const handleOpenContribute = () => {
    if (!canContribute) {
      setActiveTab('me');
      setApplyModalOpen(true);
      return;
    }
    const defaults = createDefaultContributeForm();
    defaults.by = user.qualifications
      ? `${user.name}, ${user.qualifications.split('·')[0].trim()}`
      : user.name;
    setContributeForm(defaults);
    setContributeSubmitted(false);
    setContributeOpen(true);
  };

  const handlePickContributeFile = (file: File) => {
    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch {
      url = '';
    }
    setContributeForm((prev) => ({
      ...prev,
      url,
      name: file.name,
      genState: 1,
    }));
    window.setTimeout(() => {
      setContributeForm((prev) => ({ ...prev, genState: 2 }));
    }, 1500);
  };

  const handleSubmitContribute = () => {
    const f = contributeForm;
    const errors: string[] = [];
    if (!f.name) errors.push('Add a video file.');
    if (!f.category) errors.push('Choose a category.');
    if (!f.title.trim()) errors.push('Add a procedure title.');
    if (!f.by.trim()) errors.push('Add your name and credentials.');
    if (!f.org.trim()) errors.push('Add your school, hospital or organization.');
    if (!f.ownsRights) errors.push('Confirm you own the rights to this video.');
    if (!f.patientConsent) {
      errors.push(
        'Confirm no patient is identifiable, or that you hold written consent.',
      );
    }

    if (errors.length > 0) {
      setContributeForm((prev) => ({ ...prev, errors }));
      return;
    }

    const id = nextIdRef.current++;
    const newSubmission: SubmissionItem = {
      id,
      submittedByEmail: user.email,
      discipline: f.discipline,
      category: f.category,
      title: f.title.trim(),
      instructor: f.by.trim(),
      organization: f.org.trim(),
      region: f.region,
      duration: 'New',
      url: f.url,
      steps: f.steps.map((s) => s.trim()).filter(Boolean),
      checks: [false, false, false, false, false],
      note: '',
      err: '',
      status: 'pending',
    };

    setSubmissionsQueue((prev) => [...prev, newSubmission]);
    setContributeSubmitted(true);
  };

  const handleReviewDecision = (
    submissionId: number,
    decision: Exclude<SubmissionStatus, 'pending'>,
  ) => {
    if (!canReviewVideos) return;
    const item = submissionsQueue.find((s) => s.id === submissionId);
    if (!item) return;

    if (decision === 'ok' && !item.checks.every(Boolean)) {
      setSubmissionsQueue((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                err: 'Complete every item on the checklist before approving.',
              }
            : s,
        ),
      );
      return;
    }

    if (decision !== 'ok' && !item.note.trim()) {
      setSubmissionsQueue((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, err: 'Add a note so the contributor knows why.' }
            : s,
        ),
      );
      return;
    }

    setSubmissionsQueue((prev) =>
      prev.map((s) =>
        s.id === submissionId ? { ...s, status: decision, err: '' } : s,
      ),
    );

    if (decision === 'ok') {
      setVideos((prev) => [
        ...prev,
        {
          id: Math.max(0, ...prev.map((v) => v.id)) + 1,
          discipline: item.discipline,
          category: item.category,
          title: item.title,
          instructor: item.instructor,
          organization: item.organization,
          region: item.region,
          duration: item.duration,
          steps: item.steps,
          hue: (item.id * 47) % 360,
          views: 0,
          likes: 0,
          daysAgo: 0,
          videoUrl: item.url || undefined,
        },
      ]);
      showToast('Approved. It now appears in Home.');
    } else if (decision === 'chg') {
      showToast('Sent back with a note.');
    } else {
      showToast('Rejected. The contributor is notified.');
    }
  };

  // Instructor Application & Admin RBAC handlers
  const handleSubmitInstructorApplication = (data: {
    fullName: string;
    qualifications: string;
    youtubeHandle: string;
    note: string;
  }) => {
    const newApp: InstructorApplication = {
      id: nextIdRef.current++,
      email: user.email,
      fullName: data.fullName,
      qualifications: data.qualifications,
      youtubeHandle: data.youtubeHandle,
      note: data.note,
      submittedAt: 'Just now',
      status: 'pending',
    };

    setApplications((prev) => [
      newApp,
      ...prev.filter((a) => a.email.toLowerCase() !== user.email.toLowerCase()),
    ]);
    setApplyModalOpen(false);
    showToast('Instructor application submitted for admin verification.');
  };

  const handleApproveApplication = (appId: number) => {
    if (user.role !== 'admin') return;
    const app = applications.find((a) => a.id === appId);
    if (!app) return;

    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: 'approved' } : a)),
    );

    setAccounts((prev) => {
      const exists = prev.some(
        (acc) => acc.email.toLowerCase() === app.email.toLowerCase(),
      );
      if (exists) {
        return prev.map((acc) =>
          acc.email.toLowerCase() === app.email.toLowerCase()
            ? {
                ...acc,
                name: app.fullName,
                role: 'instructor',
                qualifications: app.qualifications,
                youtubeHandle: app.youtubeHandle || undefined,
                approvedAt: 'Nov 2026',
              }
            : acc,
        );
      }
      return [
        ...prev,
        {
          email: app.email,
          name: app.fullName,
          role: 'instructor',
          qualifications: app.qualifications,
          youtubeHandle: app.youtubeHandle || undefined,
          approvedAt: 'Nov 2026',
        },
      ];
    });

    showToast(`${app.fullName} approved as a verified clinical instructor.`);
  };

  const handleDeclineApplication = (appId: number, note: string) => {
    if (user.role !== 'admin') return;
    setApplications((prev) =>
      prev.map((a) =>
        a.id === appId
          ? { ...a, status: 'declined', decisionNote: note || undefined }
          : a,
      ),
    );
    showToast('Application declined.');
  };

  const handleRevokeInstructor = (email: string) => {
    if (user.role !== 'admin') return;
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.email.toLowerCase() === email.toLowerCase()
          ? { ...acc, role: 'learner' }
          : acc,
      ),
    );
    showToast('Instructor upload permission revoked.');
  };

  const handleAddSubAdmin = (data: {
    name: string;
    email: string;
    permissions: StaffPermissions;
  }): string | null => {
    if (user.role !== 'admin') return 'Unauthorized.';
    const existing = accounts.find(
      (a) => a.email.toLowerCase() === data.email.toLowerCase(),
    );
    if (existing?.role === 'admin') {
      return 'Cannot modify Supreme Admin account.';
    }

    if (existing) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.email.toLowerCase() === data.email.toLowerCase()
            ? {
                ...a,
                name: data.name,
                role: 'sub_admin',
                permissions: data.permissions,
              }
            : a,
        ),
      );
    } else {
      setAccounts((prev) => [
        ...prev,
        {
          email: data.email,
          name: data.name,
          role: 'sub_admin',
          permissions: data.permissions,
        },
      ]);
    }
    showToast(`${data.name} added as sub-admin staff.`);
    return null;
  };

  const handleUpdateSubAdminPermissions = (
    email: string,
    permissions: StaffPermissions,
  ) => {
    if (user.role !== 'admin') return;
    setAccounts((prev) =>
      prev.map((a) =>
        a.email.toLowerCase() === email.toLowerCase()
          ? { ...a, permissions }
          : a,
      ),
    );
    showToast('Staff access updated.');
  };

  const handleRemoveSubAdmin = (email: string) => {
    if (user.role !== 'admin') return;
    setAccounts((prev) =>
      prev.map((a) =>
        a.email.toLowerCase() === email.toLowerCase()
          ? { ...a, role: 'learner', permissions: undefined }
          : a,
      ),
    );
    showToast('Sub-admin access removed.');
  };

  const handleSubmitReport = (postId: number, reason: string) => {
    const newReport: ReportedPost = {
      id: nextIdRef.current++,
      postId,
      reason,
      reportedBy: user.name || 'Learner',
      reportedAt: 'Just now',
      status: 'open',
    };
    setReports((prev) => [newReport, ...prev]);
    setSheet(null);
    showToast('Thanks. An admin or moderation staff member will review this post.');
  };

  const handleModerateReport = (
    reportId: number,
    action: 'removed' | 'dismissed',
  ) => {
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;

    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: action } : r)),
    );

    if (action === 'removed') {
      setPosts((prev) => prev.filter((p) => p.id !== target.postId));
      showToast('Post taken down from Reels.');
    } else {
      showToast('Report dismissed.');
    }
  };

  const handlePickPostFile = (file: File) => {
    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch {
      url = '';
    }
    setPostForm((prev) => ({
      ...prev,
      url,
      name: file.name,
      isImg: file.type.startsWith('image'),
    }));
  };

  const handlePublishPost = () => {
    if (!postForm.url && !postForm.name) {
      setPostForm((prev) => ({
        ...prev,
        err: 'Choose or record a video or photo first.',
      }));
      return;
    }
    if (!postForm.caption.trim()) {
      setPostForm((prev) => ({ ...prev, err: 'Add a caption.' }));
      return;
    }
    if (!postForm.confirmed) {
      setPostForm((prev) => ({
        ...prev,
        err: 'Confirm no patient can be identified and that you can share this.',
      }));
      return;
    }

    const roleLabel =
      user.role === 'instructor'
        ? 'Clinical instructor'
        : user.role === 'admin'
        ? 'Supreme Admin'
        : user.role === 'sub_admin'
        ? 'Staff'
        : 'Learner';

    const linkedVideo =
      postForm.linkedVid !== ''
        ? videos.find((v) => v.id === Number(postForm.linkedVid))
        : undefined;

    const newPost: ReelPost = {
      id: nextIdRef.current++,
      kind: postForm.kind === 'photo' ? 'photo' : 'video',
      by: user.name || 'Learner',
      role: roleLabel,
      org: '',
      reg: '',
      bio: '',
      verified: user.role === 'instructor',
      genre: postForm.genre,
      discipline: linkedVideo ? linkedVideo.discipline : postForm.discipline,
      category: linkedVideo ? linkedVideo.category : undefined,
      vid: linkedVideo ? linkedVideo.id : undefined,
      caption: postForm.caption.trim(),
      hue: 200,
      ago: 'Just now',
      views: 0,
      likes: 0,
      practiceClicks: 0,
      comments: [],
      url: postForm.url,
      isImage: postForm.isImg,
    };
    setPosts((prev) => [newPost, ...prev]);
    setSheet(null);
    showToast('Posted to Reels.');
  };

  const handleRecordReelView = useCallback((postId: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, views: p.views + 1 } : p)),
    );
  }, []);

  const handleRecordReelDwell = useCallback(
    (post: ReelPost, dwellMs: number) => {
      const isFastSkip = dwellMs < 2000;
      setReelSignals((prev) => ({
        ...prev,
        dwellMsByPost: {
          ...prev.dwellMsByPost,
          [post.id]: (prev.dwellMsByPost[post.id] || 0) + dwellMs,
        },
        fastSkipsByPost: isFastSkip
          ? {
              ...prev.fastSkipsByPost,
              [post.id]: (prev.fastSkipsByPost[post.id] || 0) + 1,
            }
          : prev.fastSkipsByPost,
      }));
      if (dwellMs >= 4000) {
        boostAffinity(post.discipline, post.category, 1);
      }
    },
    [boostAffinity],
  );

  const handleNotInterestedReel = (post: ReelPost) => {
    setReelSignals((prev) => ({
      ...prev,
      notInterestedPostIds: prev.notInterestedPostIds.includes(post.id)
        ? prev.notInterestedPostIds
        : [...prev.notInterestedPostIds, post.id],
      notInterestedGenres: post.genre
        ? {
            ...prev.notInterestedGenres,
            [post.genre]: (prev.notInterestedGenres[post.genre] || 0) + 1,
          }
        : prev.notInterestedGenres,
    }));
    showToast('Got it. We’ll show fewer posts like this.');
  };

  const handleTryProcedureFromReel = (vid: number, fromPostId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === fromPostId
          ? { ...p, practiceClicks: (p.practiceClicks || 0) + 1 }
          : p,
      ),
    );
    setReelSignals((prev) => ({
      ...prev,
      practiceConversions: prev.practiceConversions.includes(fromPostId)
        ? prev.practiceConversions
        : [...prev.practiceConversions, fromPostId],
    }));
    openProcedure(vid, 'practice');
  };

  const handleResetReelPreferences = () => {
    setReelSignals(INITIAL_REEL_SIGNALS);
    showToast('Feed preferences reset.');
  };

  const handleAddComment = (
    target: 'post' | 'video',
    id: number,
    text: string,
  ) => {
    const newComment: CommentItem = {
      name: user.name || 'Learner',
      text,
      ago: 'now',
    };
    if (target === 'post') {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, comments: [...p.comments, newComment] } : p,
        ),
      );
    } else {
      setVideoComments((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), newComment],
      }));
    }
  };

  const handleSendMessage = (friendName: string, text: string) => {
    const friend = friends.find((f) => f.name === friendName);
    setChats((prev) => ({
      ...prev,
      [friendName]: [...(prev[friendName] || []), { me: true, type: 'text', text }],
    }));

    if (friend?.online) {
      window.setTimeout(() => {
        setChats((prev) => ({
          ...prev,
          [friendName]: [
            ...(prev[friendName] || []),
            { me: false, type: 'text', text: 'Got it, thanks.' },
          ],
        }));
      }, 1500);
    }
  };

  const handleSendInvite = () => {
    if (!inviteForm.when) {
      setInviteForm((prev) => ({
        ...prev,
        err: 'Choose a date and time.',
      }));
      return;
    }
    if (!activeChat) return;
    const friend = friends.find((f) => f.name === activeChat);
    const formattedWhen = new Date(inviteForm.when).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const inviteMsg: ChatMessage = {
      me: true,
      type: 'invite',
      vid: Number(inviteForm.vid),
      when: formattedWhen,
      note: inviteForm.note,
      status: 'pending',
    };

    setChats((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), inviteMsg],
    }));
    setSheet(null);
    showToast(
      friend?.online ? 'Invite sent.' : 'Invite sent as a notification.',
    );

    if (friend?.online) {
      const targetFriendName = activeChat;
      window.setTimeout(() => {
        setChats((prev) => {
          const list = [...(prev[targetFriendName] || [])];
          const updated = list.map((m) =>
            m === inviteMsg ? { ...m, status: 'accepted' as const } : m,
          );
          return {
            ...prev,
            [targetFriendName]: [
              ...updated,
              { me: false, type: 'text', text: 'Accepted. I’ll be there.' },
            ],
          };
        });
      }, 2000);
    }
  };

  const handleSendReminder = (friendName: string, messageIndex: number) => {
    const friend = friends.find((f) => f.name === friendName);
    const targetMsg = (chats[friendName] || [])[messageIndex];
    if (!targetMsg || targetMsg.type !== 'invite') return;

    setChats((prev) => ({
      ...prev,
      [friendName]: [
        ...(prev[friendName] || []),
        { me: true, type: 'remind', vid: targetMsg.vid },
      ],
    }));
    showToast(
      friend?.online ? 'Reminder sent.' : 'Reminder sent as a notification.',
    );
  };

  const handleRespondNotification = (id: number, accept: boolean) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        if (!accept) return { ...n, status: 'declined' };
        return { ...n, status: n.type === 'req' ? 'done' : 'accepted' };
      }),
    );

    if (accept && target.type === 'req') {
      setFriends((prev) =>
        prev.some((f) => f.name === target.from)
          ? prev
          : [
              ...prev,
              {
                name: target.from,
                online: true,
                role: 'Clinical instructor',
              },
            ],
      );
    } else if (accept && target.type === 'invite') {
      setChats((prev) => ({
        ...prev,
        [target.from]: [
          ...(prev[target.from] || []),
          { me: true, type: 'text', text: 'Accepted. See you then.' },
        ],
      }));
    }
  };

  const handleShareToFriend = (friendName: string, postId: number) => {
    setChats((prev) => ({
      ...prev,
      [friendName]: [
        ...(prev[friendName] || []),
        { me: true, type: 'post', pid: postId },
      ],
    }));
    setSheet(null);
    showToast(`Sent to ${friendName.split(' ')[0]}.`);
  };

  const handleCopyInviteLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore clipboard errors in restricted frames
    }
    showToast('Invite link copied. Share it with someone you study with.');
  };

  if (screen !== 'app') {
    return (
      <>
        <SplashAuth
          screen={screen}
          authMode={authMode}
          initialNotice={authNotice}
          onContinueFromSplash={() => setScreen('auth')}
          onChangeAuthMode={setAuthMode}
          onAuthenticate={handleAuthenticate}
          onToast={showToast}
        />
        <div
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm shadow-lg transition-opacity duration-200 pointer-events-none ${
            toastVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {toastMsg}
        </div>
      </>
    );
  }

  const openVideo =
    openVideoId !== null
      ? videos.find((v) => v.id === openVideoId) || null
      : null;

  const showLibraryFilters = activeTab === 'home' || activeTab === 'explore';

  const renderWorkspaceToolbar = () => {
    if (!showLibraryFilters) return null;
    return (
      <div className="mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Procedure type"
            className="grid grid-cols-2 sm:inline-flex bg-slate-200/80 rounded-xl p-1 gap-1"
          >
            {(['nursing', 'surgical'] as Discipline[]).map((k) => {
              const active = discipline === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDiscipline(k);
                    setCategoryFilter('All');
                  }}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
                    active
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {k === 'nursing'
                    ? 'Nursing procedures'
                    : 'Surgical procedures'}
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Region"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0"
          >
            <span className="text-xs font-medium text-slate-500 mr-1 shrink-0">
              Region
            </span>
            {(['All', ...REGIONS] as RegionFilter[]).map((r) => {
              const active = regionFilter === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRegionFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[36px] border ${
                    active
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'home' && (
          <div
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
            aria-label="Categories"
          >
            {['All', ...CATEGORIES[discipline]].map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors min-h-[38px] ${
                    active
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {cat === 'All' ? 'All categories' : cat}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderProcedureGrid = () => {
    if (filteredVideos.length === 0) {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg">
          <div className="font-display font-bold text-base text-slate-900">
            No videos here yet
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Nothing is published for this region and category. Verified
            instructors can add the first one.
          </p>
          {canContribute ? (
            <button
              type="button"
              onClick={handleOpenContribute}
              className="mt-4 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[44px] transition-colors"
            >
              Contribute a video
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setActiveTab('me');
                setApplyModalOpen(true);
              }}
              className="mt-4 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[44px] transition-colors"
            >
              Apply as clinical instructor
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVideos.map((v) => (
          <ProcedureCard
            key={v.id}
            video={v}
            extraViews={extraViews[v.id] || 0}
            completedCount={(completedStepsMap[v.id] || []).filter(Boolean).length}
            onOpen={(id) => openProcedure(id, 'watch')}
            onOpenInstructor={(instructorName) =>
              setSheet({ kind: 'profile', by: instructorName })
            }
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-slate-900 text-white border-b border-slate-800 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              setOpenVideoId(null);
              window.scrollTo(0, 0);
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
              <BrandMark width={20} />
            </span>
            <span className="font-display font-extrabold text-base tracking-tight text-white">
              Diadikasia
            </span>
          </button>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_ITEMS.map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab(id);
                    setOpenVideoId(null);
                    window.scrollTo(0, 0);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`py-1.5 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                    active
                      ? 'text-teal-300 border-teal-400 font-semibold'
                      : 'text-slate-300 border-transparent hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {canContribute && (
              <button
                type="button"
                onClick={handleOpenContribute}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-200 hover:bg-teal-500/30 text-xs font-semibold whitespace-nowrap shrink-0 min-h-[36px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Contribute</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheet({ kind: 'notifications' })}
              aria-label="Notifications"
              className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {pendingNotifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {pendingNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 pb-24 md:pb-12">
        {renderWorkspaceToolbar()}

        {activeTab === 'home' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {discipline === 'nursing' ? 'Nursing' : 'Surgical'} procedures
              </h1>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 tabular-nums">
                {filteredVideos.length} videos
              </span>
            </div>
            {renderProcedureGrid()}
            <p className="text-xs text-slate-400 pt-2">
              Sample content for demonstration only.
            </p>
          </section>
        )}

        {activeTab === 'explore' && (
          <section className="space-y-4">
            <div className="max-w-xl">
              <label
                htmlFor="explore-search"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Search procedures, instructors or schools
              </label>
              <input
                id="explore-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. catheter, suturing"
                className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Searching {discipline} videos,{' '}
                {regionFilter === 'All'
                  ? 'all regions'
                  : `${regionFilter} instructors`}
                . Change these above.
              </p>
            </div>
            {renderProcedureGrid()}
          </section>
        )}

        {activeTab === 'reels' && (
          <ReelsView
            posts={rankedReelsResult.rankedPosts}
            reasonsByPostId={rankedReelsResult.reasonsByPostId}
            topInterests={rankedReelsResult.topInterests}
            signals={reelSignals}
            milestones={milestones}
            shareEnabled={shareEnabled}
            feedTab={reelsFeedTab}
            onChangeFeedTab={setReelsFeedTab}
            videos={videos}
            likedIds={likedKeys}
            onToggleLike={(postId) => toggleLikeKey(`p${postId}`)}
            onEnsureLike={ensureLikePost}
            onOpenComments={(postId) =>
              setSheet({ kind: 'comments', target: 'post', id: postId })
            }
            onOpenShare={(postId) => setSheet({ kind: 'share', postId })}
            onOpenReport={(postId) => setSheet({ kind: 'report', postId })}
            onNotInterested={handleNotInterestedReel}
            onOpenProfile={(author) =>
              setSheet({ kind: 'profile', by: author })
            }
            onOpenNewPost={() => {
              setPostForm(createDefaultPostForm());
              setSheet({ kind: 'newpost' });
            }}
            onTryProcedure={handleTryProcedureFromReel}
            onRecordView={handleRecordReelView}
            onRecordDwell={handleRecordReelDwell}
            onResetPreferences={handleResetReelPreferences}
          />
        )}

        {activeTab === 'friends' && (
          <FriendsView
            friends={friends}
            discoverPeople={DISCOVER_PEOPLE}
            sentRequests={sentRequests}
            chats={chats}
            unreadCounts={unreadCounts}
            videos={videos}
            posts={posts}
            activeChat={activeChat}
            onSelectChat={(name) => {
              setActiveChat(name);
              if (name) {
                setUnreadCounts((prev) => ({ ...prev, [name]: 0 }));
              }
            }}
            onAddFriend={(name) => {
              setSentRequests((prev) =>
                prev.includes(name) ? prev : [...prev, name],
              );
              showToast('Friend request sent.');
            }}
            onCopyInviteLink={handleCopyInviteLink}
            onSendMessage={handleSendMessage}
            onOpenStudyInvite={() => {
              setInviteForm(createDefaultInvite(videos[0].id));
              setSheet({ kind: 'invite' });
            }}
            onSendReminder={handleSendReminder}
            onOpenProfile={(personName) =>
              setSheet({ kind: 'profile', by: personName })
            }
          />
        )}

        {activeTab === 'me' && (
          <ProfileView
            user={user}
            accounts={accounts}
            applications={applications}
            submissions={submissionsQueue}
            reports={reports}
            posts={posts}
            videos={videos}
            savedVideos={savedVideos}
            extraViews={extraViews}
            completedStepsMap={completedStepsMap}
            shareEnabled={shareEnabled}
            onToggleShare={(enabled) => {
              setShareEnabled(enabled);
              if (user.id) {
                void updateMySharePopupsPreference(user.id, enabled);
              }
            }}
            onOpenApplyInstructor={() => setApplyModalOpen(true)}
            onApproveApplication={handleApproveApplication}
            onDeclineApplication={handleDeclineApplication}
            onRevokeInstructor={handleRevokeInstructor}
            onAddSubAdmin={handleAddSubAdmin}
            onUpdateSubAdminPermissions={handleUpdateSubAdminPermissions}
            onRemoveSubAdmin={handleRemoveSubAdmin}
            onModerateReport={handleModerateReport}
            onOpenContribute={handleOpenContribute}
            onOpenReviewQueue={() => setReviewQueueOpen(true)}
            onOpenVideo={(id) => openProcedure(id, 'watch')}
            onOpenInstructorProfile={(instructorName) =>
              setSheet({ kind: 'profile', by: instructorName })
            }
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb Bar */}
      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom,0px)]"
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setOpenVideoId(null);
                window.scrollTo(0, 0);
              }}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[54px] text-[11px] font-semibold transition-colors ${
                active ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals & Sheets */}
      {openVideo && practiceSession && (
        <ProcedureDetailModal
          video={openVideo}
          tab={detailTab}
          onChangeTab={setDetailTab}
          onClose={() => setOpenVideoId(null)}
          isSaved={savedIds.has(openVideo.id)}
          onToggleSave={toggleSaveVideo}
          isLiked={likedKeys.has(`v${openVideo.id}`)}
          onToggleLike={(id) => toggleLikeKey(`v${id}`)}
          extraViews={extraViews[openVideo.id] || 0}
          commentCount={(videoComments[openVideo.id] || []).length}
          onOpenComments={(id) =>
            setSheet({ kind: 'comments', target: 'video', id })
          }
          completedSteps={completedStepsMap[openVideo.id] || []}
          onToggleStep={toggleStepDone}
          practice={practiceSession}
          onPracticeAction={handlePracticeAction}
          onOpenInstructorProfile={(instructorName) =>
            setSheet({ kind: 'profile', by: instructorName })
          }
          shareEnabled={shareEnabled}
        />
      )}

      {applyModalOpen && (
        <InstructorApplyModal
          defaultFullName={user.name}
          onSubmit={handleSubmitInstructorApplication}
          onClose={() => setApplyModalOpen(false)}
        />
      )}

      {contributeOpen && canContribute && (
        <ContributeModal
          form={contributeForm}
          submittedOk={contributeSubmitted}
          onChange={setContributeForm}
          onPickFile={handlePickContributeFile}
          onSubmit={handleSubmitContribute}
          onClose={() => setContributeOpen(false)}
          onSeeSubmissions={() => {
            setContributeOpen(false);
            setActiveTab('me');
          }}
        />
      )}

      {reviewQueueOpen && canReviewVideos && (
        <ReviewQueueModal
          queue={submissionsQueue}
          onToggleCheck={(subId, checkIndex) => {
            setSubmissionsQueue((prev) =>
              prev.map((s) => {
                if (s.id !== subId) return s;
                const nextChecks = [...s.checks];
                nextChecks[checkIndex] = !nextChecks[checkIndex];
                return { ...s, checks: nextChecks };
              }),
            );
          }}
          onChangeNote={(subId, note) => {
            setSubmissionsQueue((prev) =>
              prev.map((s) => (s.id === subId ? { ...s, note } : s)),
            );
          }}
          onDecide={handleReviewDecision}
          onClose={() => setReviewQueueOpen(false)}
        />
      )}

      <BottomSheets
        sheet={sheet}
        accounts={accounts}
        posts={posts}
        videos={videos}
        videoComments={videoComments}
        friends={friends}
        notifications={notifications}
        activeChatFriend={activeChat}
        currentUser={user}
        postForm={postForm}
        inviteForm={inviteForm}
        onChangePostForm={setPostForm}
        onPickPostFile={handlePickPostFile}
        onPublishPost={handlePublishPost}
        onAddComment={handleAddComment}
        onRespondNotification={handleRespondNotification}
        onChangeInviteForm={setInviteForm}
        onSendInvite={handleSendInvite}
        onShareToFriend={handleShareToFriend}
        onSubmitReport={handleSubmitReport}
        onOpenVideo={(id) => openProcedure(id, 'watch')}
        onClose={() => setSheet(null)}
      />

      {/* Toast */}
      <div
        role="status"
        className={`fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-8 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm shadow-lg transition-opacity duration-200 pointer-events-none ${
          toastVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {toastMsg}
      </div>
    </div>
  );
}
