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
import { ProfileView, type AdminSection } from './components/ProfileView';
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
  FeedbackCategory,
  FeedbackItem,
  FeedbackStatus,
  Friend,
  FriendRequestItem,
  InstructorApplication,
  InviteForm,
  MainTab,
  NewPostForm,
  NotificationItem,
  PersonCandidate,
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
  fetchAuthoritativeMyProfile,
  fetchDirectoryProfiles,
  isEmailVerified,
  processAuthCallbackFromUrl,
  signOutSupabase,
  subscribeToMyProfileChanges,
  updateMySharePopupsPreference,
} from './services/auth';
import {
  appointOrUpdateSubAdminRpc,
  fetchInstructorApplications,
  fetchPostReports,
  fetchVideoSubmissions,
  moderateReportedPostRpc,
  removeSubAdminRpc,
  reviewInstructorApplicationRpc,
  reviewVideoSubmissionRpc,
  revokeInstructorRpc,
  submitInstructorApplicationToSupabase,
  submitPostReportToSupabase,
  submitVideoForReviewToSupabase,
} from './services/rbac';
import {
  addReelCommentInSupabase,
  createPracticeMilestoneInSupabase,
  createReelInSupabase,
  deleteReelCommentInSupabase,
  deleteReelInSupabase,
  fetchMyReelLikes,
  fetchMyReelSignals,
  fetchPracticeMilestonesFromSupabase,
  fetchVisibleReelsPage,
  incrementReelPracticeClickRpc,
  incrementReelViewRpc,
  setReelLikeInSupabase,
  subscribeToReelsUpdates,
  updateReelInSupabase,
  upsertMyReelSignals,
  validateReelMediaFile,
} from './services/reels';
import {
  addProcedureCommentInSupabase,
  fetchMyProcedureLikes,
  fetchMyProcedureProgress,
  fetchMySavedProcedureIds,
  fetchProcedureComments,
  fetchPublishedProcedures,
  incrementProcedureViewRpc,
  queryPublishedProcedures,
  setProcedureLikeInSupabase,
  setSavedProcedureInSupabase,
  upsertProcedureProgressInSupabase,
} from './services/procedures';
import {
  cancelFriendRequestInSupabase,
  fetchDiscoverPeopleFromSupabase,
  fetchFriendshipsFromSupabase,
  isAdministrativeRole,
  respondToFriendRequestInSupabase,
  sendFriendRequestInSupabase,
  subscribeToFriendshipsUpdates,
} from './services/friends';
import {
  acceptStudyInviteInSupabase,
  fetchAllChatsFromSupabase,
  fetchConversationMessagesFromSupabase,
  mapChatRowToMessage,
  markConversationAsReadInSupabase,
  sendChatMessageInSupabase,
  subscribeToChatMessages,
} from './services/chat';
import {
  fetchNotificationsFromSupabase,
  updateNotificationStatusInSupabase,
  markAllNotificationsAsReadInSupabase,
  subscribeToNotifications,
  mapNotificationRow,
} from './services/notifications';
import {
  fetchAllFeedbackForAdminFromSupabase,
  fetchMyFeedbackFromSupabase,
  submitFeedbackToSupabase,
  subscribeToFeedbackUpdates,
  updateFeedbackByAdminInSupabase,
} from './services/feedback';

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
    isSupabaseConfigured ? [] : readStored(STORAGE_KEYS.accounts, INITIAL_ACCOUNTS),
  );
  const [applications, setApplications] = useState<InstructorApplication[]>(() =>
    isSupabaseConfigured
      ? []
      : readStored(STORAGE_KEYS.applications, INITIAL_APPLICATIONS),
  );
  const [reports, setReports] = useState<ReportedPost[]>(() =>
    isSupabaseConfigured ? [] : readStored(STORAGE_KEYS.reports, INITIAL_REPORTS),
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
    isSupabaseConfigured ? [] : readStored(STORAGE_KEYS.videos, INITIAL_VIDEOS),
  );
  const [libraryVideos, setLibraryVideos] = useState<ProcedureVideo[]>([]);
  const [proceduresLoading, setProceduresLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [libraryFilterLoading, setLibraryFilterLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [proceduresError, setProceduresError] = useState<string | null>(null);
  const [proceduresReloadSeq, setProceduresReloadSeq] = useState<number>(0);

  const [openVideoId, setOpenVideoId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('watch');
  const [practiceSession, setPracticeSession] =
    useState<PracticeSession | null>(null);

  const [completedStepsMap, setCompletedStepsMap] = useState<
    Record<number, boolean[]>
  >(() =>
    isSupabaseConfigured ? {} : readStored(STORAGE_KEYS.completedSteps, {}),
  );
  const [savedIds, setSavedIds] = useState<Set<number>>(() =>
    isSupabaseConfigured
      ? new Set()
      : new Set(readStored<number[]>(STORAGE_KEYS.savedIds, [])),
  );
  const [likedKeys, setLikedKeys] = useState<Set<string>>(() =>
    isSupabaseConfigured
      ? new Set()
      : new Set(readStored<string[]>(STORAGE_KEYS.likedKeys, [])),
  );
  const [extraViews, setExtraViews] = useState<Record<number, number>>(() =>
    isSupabaseConfigured ? {} : readStored(STORAGE_KEYS.extraViews, {}),
  );
  const [videoComments, setVideoComments] = useState<
    Record<number, CommentItem[]>
  >(() =>
    isSupabaseConfigured
      ? {}
      : readStored(STORAGE_KEYS.videoComments, INITIAL_VIDEO_COMMENTS),
  );

  const [posts, setPosts] = useState<ReelPost[]>(() =>
    isSupabaseConfigured ? [] : readStored(STORAGE_KEYS.posts, INITIAL_POSTS),
  );
  const [reelsLoading, setReelsLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [reelsLoadingMore, setReelsLoadingMore] = useState<boolean>(false);
  const [reelsHasMore, setReelsHasMore] = useState<boolean>(false);
  const [reelsError, setReelsError] = useState<string | null>(null);
  const [postSubmitting, setPostSubmitting] = useState<boolean>(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [reelsFeedTab, setReelsFeedTab] = useState<ReelsFeedTab>('for_you');
  const [reelSignals, setReelSignals] = useState<ReelSignals>(() =>
    isSupabaseConfigured
      ? INITIAL_REEL_SIGNALS
      : readStored(STORAGE_KEYS.signals, INITIAL_REEL_SIGNALS),
  );
  const [shareEnabled, setShareEnabled] = useState<boolean>(() =>
    readStored(STORAGE_KEYS.sharePopups, true),
  );
  const [milestones, setMilestones] = useState<PracticeMilestone[]>(() =>
    isSupabaseConfigured
      ? []
      : readStored(STORAGE_KEYS.milestones, INITIAL_PRACTICE_MILESTONES),
  );

  const [friends, setFriends] = useState<Friend[]>(() =>
    isSupabaseConfigured ? [] : readStored(STORAGE_KEYS.friends, INITIAL_FRIENDS),
  );
  const [discoverPeople, setDiscoverPeople] = useState<PersonCandidate[]>(() =>
    isSupabaseConfigured ? [] : DISCOVER_PEOPLE,
  );
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>(
    [],
  );
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>(
    [],
  );
  const [friendsLoading, setFriendsLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [busyFriendIds, setBusyFriendIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [sentRequests, setSentRequests] = useState<string[]>(() =>
    isSupabaseConfigured ? [] : readStored(STORAGE_KEYS.sentRequests, []),
  );
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() =>
    isSupabaseConfigured ? {} : readStored(STORAGE_KEYS.chats, INITIAL_CHATS),
  );
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(() =>
    isSupabaseConfigured
      ? {}
      : readStored(STORAGE_KEYS.unreadCounts, INITIAL_UNREAD),
  );
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState<boolean>(false);
  const [busyChatMsgIds, setBusyChatMsgIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    isSupabaseConfigured
      ? []
      : readStored(STORAGE_KEYS.notifications, INITIAL_NOTIFICATIONS),
  );
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [myFeedbackLoading, setMyFeedbackLoading] = useState<boolean>(false);
  const [myFeedbackError, setMyFeedbackError] = useState<string | null>(null);
  const [adminFeedback, setAdminFeedback] = useState<FeedbackItem[]>([]);
  const [adminFeedbackLoading, setAdminFeedbackLoading] =
    useState<boolean>(false);
  const [adminFeedbackError, setAdminFeedbackError] = useState<string | null>(
    null,
  );
  const [highlightedFeedbackId, setHighlightedFeedbackId] = useState<
    number | null
  >(null);
  const [requestedAdminTab, setRequestedAdminTab] =
    useState<AdminSection | null>(null);

  const [submissionsQueue, setSubmissionsQueue] = useState<SubmissionItem[]>(() =>
    isSupabaseConfigured
      ? []
      : readStored(STORAGE_KEYS.submissions, INITIAL_SUBMISSIONS_QUEUE),
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
    createDefaultInvite(isSupabaseConfigured ? 1 : INITIAL_VIDEOS[0].id),
  );

  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);
  const nextIdRef = useRef<number>(Date.now());
  const appliedAuthUserIdRef = useRef<string | null>(null);
  const inFlightAuthUserIdRef = useRef<string | null>(null);
  const recoveryModeRef = useRef<boolean>(false);
  const contributeFileRef = useRef<File | null>(null);
  const postFileRef = useRef<File | null>(null);
  const lastProfileRefreshRef = useRef<number>(0);
  const lastDiscoverRefreshRef = useRef<number>(0);
  const discoverRefreshInFlightRef = useRef<boolean>(false);
  const serverLikedProcIdsRef = useRef<Set<number>>(new Set());
  const serverLikedReelIdsRef = useRef<Set<number>>(new Set());
  const signalsLoadedRef = useRef<boolean>(false);
  const signalsSaveTimerRef = useRef<number | null>(null);
  const filterRequestIdRef = useRef<number>(0);
  const userRef = useRef<UserProfile>(user);
  userRef.current = user;
  const accountsRef = useRef<UserProfile[]>(accounts);
  accountsRef.current = accounts;
  const activeChatRef = useRef<string | null>(activeChat);
  activeChatRef.current = activeChat;
  const activeTabRef = useRef<MainTab>(activeTab);
  activeTabRef.current = activeTab;
  const friendsRef = useRef<Friend[]>(friends);
  friendsRef.current = friends;
  const chatsRef = useRef<Record<string, ChatMessage[]>>(chats);
  chatsRef.current = chats;
  const seenChatMsgIdsRef = useRef<Set<number>>(new Set());

  // Persist local procedures, study progress, and community state (demo mode only for backend-integrated tables)
  useEffect(() => {
    try {
      if (!isSupabaseConfigured) {
        localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
        localStorage.setItem(
          STORAGE_KEYS.applications,
          JSON.stringify(applications),
        );
        localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports));
        localStorage.setItem(
          STORAGE_KEYS.submissions,
          JSON.stringify(submissionsQueue),
        );
        localStorage.setItem(STORAGE_KEYS.videos, JSON.stringify(videos));
        localStorage.setItem(
          STORAGE_KEYS.savedIds,
          JSON.stringify(Array.from(savedIds)),
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
        localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
        localStorage.setItem(STORAGE_KEYS.signals, JSON.stringify(reelSignals));
        localStorage.setItem(
          STORAGE_KEYS.milestones,
          JSON.stringify(milestones),
        );
        localStorage.setItem(
          STORAGE_KEYS.sharePopups,
          JSON.stringify(shareEnabled),
        );
        localStorage.setItem(
          STORAGE_KEYS.likedKeys,
          JSON.stringify(Array.from(likedKeys)),
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
      }
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

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2600);
  }, []);

  const applyLikedBaseline = useCallback(
    (list: ProcedureVideo[], likedIdSet: Set<number>): ProcedureVideo[] =>
      list.map((v) => ({
        ...v,
        likes: Math.max(0, v.likes - (likedIdSet.has(v.id) ? 1 : 0)),
      })),
    [],
  );

  const applyReelLikedBaseline = useCallback(
    (list: ReelPost[], likedIdSet: Set<number>): ReelPost[] =>
      list.map((p) => ({
        ...p,
        likes: Math.max(0, p.likes - (likedIdSet.has(p.id) ? 1 : 0)),
      })),
    [],
  );

  const syncChatIdsIntoRef = useCallback(
    (chatMap: Record<string, ChatMessage[]>) => {
      for (const list of Object.values(chatMap)) {
        for (const msg of list) {
          if (typeof msg.id === 'number') {
            seenChatMsgIdsRef.current.add(msg.id);
          }
        }
      }
    },
    [],
  );

  const refreshChatsState = useCallback(
    async (
      activeUserId: string,
      currentFriends: Friend[],
      showSpinner = false,
    ) => {
      if (!isSupabaseConfigured || !activeUserId) return;
      if (showSpinner) setChatsLoading(true);
      try {
        const res = await fetchAllChatsFromSupabase(
          activeUserId,
          currentFriends,
        );
        if (res.error) {
          setChatsError(res.error);
          if (showSpinner) {
            setChats({});
            setUnreadCounts({});
          }
        } else {
          setChatsError(null);
          syncChatIdsIntoRef(res.chats);
          setChats(res.chats);
          setUnreadCounts(res.unreadCounts);
        }
      } finally {
        if (showSpinner) setChatsLoading(false);
      }
    },
    [syncChatIdsIntoRef],
  );

  const refreshFriendshipsState = useCallback(
    async (activeUserId: string, showSpinner = false) => {
      if (!isSupabaseConfigured || !activeUserId) return;
      const role = userRef.current.role;
      if (showSpinner) setFriendsLoading(true);
      try {
        const res = await fetchFriendshipsFromSupabase(activeUserId, role);
        if (res.error) {
          setFriendsError(res.error);
          if (showSpinner) {
            setFriends([]);
            setIncomingRequests([]);
            setOutgoingRequests([]);
          }
        } else {
          setFriendsError(null);
          setFriends(res.friends);
          setIncomingRequests(res.incomingRequests);
          setOutgoingRequests(res.outgoingRequests);
          if (
            activeChatRef.current &&
            !res.friends.some((f) => f.name === activeChatRef.current)
          ) {
            setActiveChat(null);
          }
          void refreshChatsState(activeUserId, res.friends, false);
        }
      } finally {
        if (showSpinner) setFriendsLoading(false);
      }
    },
    [refreshChatsState],
  );

  const refreshDiscoverPeopleState = useCallback(
    async (activeUserId: string, showSpinner = false, force = false) => {
      if (!isSupabaseConfigured || !activeUserId) return;
      if (discoverRefreshInFlightRef.current) return;
      const now = Date.now();
      if (!force && now - lastDiscoverRefreshRef.current < 15000) {
        return;
      }

      discoverRefreshInFlightRef.current = true;
      if (showSpinner) setDiscoverLoading(true);
      try {
        const res = await fetchDiscoverPeopleFromSupabase(
          activeUserId,
          userRef.current.role,
        );
        if (res.error) {
          setDiscoverError(res.error);
          if (showSpinner) {
            setDiscoverPeople([]);
          }
        } else {
          lastDiscoverRefreshRef.current = Date.now();
          setDiscoverError(null);
          setDiscoverPeople(res.people);
        }
      } finally {
        discoverRefreshInFlightRef.current = false;
        if (showSpinner) setDiscoverLoading(false);
      }
    },
    [],
  );

  const refreshMyFeedbackState = useCallback(
    async (activeUserId: string, showSpinner = false) => {
      if (!isSupabaseConfigured || !activeUserId) return;
      if (showSpinner) setMyFeedbackLoading(true);
      try {
        const res = await fetchMyFeedbackFromSupabase(activeUserId);
        if (res.error) {
          setMyFeedbackError(res.error);
        } else {
          setMyFeedbackError(null);
          setMyFeedback(res.items);
        }
      } finally {
        if (showSpinner) setMyFeedbackLoading(false);
      }
    },
    [],
  );

  const refreshAdminFeedbackState = useCallback(
    async (directoryAccounts: UserProfile[], showSpinner = false) => {
      if (!isSupabaseConfigured || userRef.current.role !== 'admin') return;
      if (showSpinner) setAdminFeedbackLoading(true);
      try {
        const res = await fetchAllFeedbackForAdminFromSupabase(directoryAccounts);
        if (res.error) {
          setAdminFeedbackError(res.error);
        } else {
          setAdminFeedbackError(null);
          setAdminFeedback(res.items);
        }
      } finally {
        if (showSpinner) setAdminFeedbackLoading(false);
      }
    },
    [],
  );

  const syncRoleScopedData = useCallback(
    async (activeUser: UserProfile) => {
      if (!isSupabaseConfigured || !activeUser.id) return;

      setProceduresLoading(true);
      setReelsLoading(true);
      setFriendsLoading(true);
      setDiscoverLoading(true);
      setChatsLoading(true);

      const isAdminUser = activeUser.role === 'admin';
      const canSeeSubmissions =
        activeUser.role === 'instructor' ||
        isAdminUser ||
        (activeUser.role === 'sub_admin' &&
          Boolean(activeUser.permissions?.canReviewVideos));
      const canSeeModerationReports =
        isAdminUser ||
        (activeUser.role === 'sub_admin' &&
          Boolean(activeUser.permissions?.canModeratePosts));

      if (isAdminUser) {
        setAdminFeedbackLoading(true);
      } else {
        setMyFeedbackLoading(true);
      }

      try {
        const [
          directory,
          appsRes,
          subsRes,
          reportsRes,
          procsRes,
          savedRes,
          progressRes,
          likesRes,
          commentsRes,
          reelsRes,
          reelLikesRes,
          signalsRes,
          friendshipsRes,
          discoverRes,
          notifsRes,
          myFeedbackRes,
        ] = await Promise.all([
          fetchDirectoryProfiles(isAdminUser),
          fetchInstructorApplications(),
          canSeeSubmissions
            ? fetchVideoSubmissions()
            : Promise.resolve({
                submissions: [] as SubmissionItem[],
                error: undefined as string | undefined,
              }),
          canSeeModerationReports
            ? fetchPostReports()
            : Promise.resolve({
                reports: [] as ReportedPost[],
                error: undefined as string | undefined,
              }),
          fetchPublishedProcedures(),
          fetchMySavedProcedureIds(activeUser.id),
          fetchMyProcedureProgress(activeUser.id),
          fetchMyProcedureLikes(activeUser.id),
          fetchProcedureComments(),
          fetchVisibleReelsPage({ offset: 0, limit: 20 }),
          fetchMyReelLikes(activeUser.id),
          fetchMyReelSignals(activeUser.id),
          fetchFriendshipsFromSupabase(activeUser.id, activeUser.role),
          fetchDiscoverPeopleFromSupabase(activeUser.id, activeUser.role),
          fetchNotificationsFromSupabase(activeUser.id),
          isAdminUser
            ? Promise.resolve({
                items: [] as FeedbackItem[],
                error: undefined as string | undefined,
              })
            : fetchMyFeedbackFromSupabase(activeUser.id),
        ]);

        const [milestonesRes, chatsRes, adminFeedbackRes] = await Promise.all([
          fetchPracticeMilestonesFromSupabase(directory, procsRes.procedures),
          !friendshipsRes.error
            ? fetchAllChatsFromSupabase(activeUser.id, friendshipsRes.friends)
            : Promise.resolve({
                chats: {} as Record<string, ChatMessage[]>,
                unreadCounts: {} as Record<string, number>,
                error: undefined as string | undefined,
              }),
          isAdminUser
            ? fetchAllFeedbackForAdminFromSupabase(directory)
            : Promise.resolve({
                items: [] as FeedbackItem[],
                error: undefined as string | undefined,
              }),
        ]);

        setAccounts(directory);
        if (!appsRes.error) {
          setApplications(appsRes.applications);
        }
        if (!subsRes.error) {
          setSubmissionsQueue((prev) => {
            const draftById = new Map(prev.map((item) => [item.id, item]));
            return subsRes.submissions.map((remote) => {
              const localDraft = draftById.get(remote.id);
              if (localDraft && remote.status === 'pending') {
                return {
                  ...remote,
                  checks: localDraft.checks,
                  note: localDraft.note || remote.note,
                };
              }
              return remote;
            });
          });
        }
        if (!reportsRes.error) {
          setReports(reportsRes.reports);
        }

        let nextLikedSet = serverLikedProcIdsRef.current;
        if (!likesRes.error) {
          nextLikedSet = new Set(likesRes.likedIds);
          serverLikedProcIdsRef.current = nextLikedSet;
        }

        let nextReelLikedSet = serverLikedReelIdsRef.current;
        if (!reelLikesRes.error) {
          nextReelLikedSet = new Set(reelLikesRes.likedIds);
          serverLikedReelIdsRef.current = nextReelLikedSet;
        }

        if (!likesRes.error || !reelLikesRes.error) {
          setLikedKeys(() => {
            const next = new Set<string>();
            for (const id of nextLikedSet) {
              next.add(`v${id}`);
            }
            for (const id of nextReelLikedSet) {
              next.add(`p${id}`);
            }
            return next;
          });
        }

        if (!savedRes.error) {
          setSavedIds(new Set(savedRes.savedIds));
        }

        if (!progressRes.error) {
          setCompletedStepsMap(progressRes.progressMap);
        }

        if (!commentsRes.error) {
          setVideoComments(commentsRes.commentsByProcedure);
        }

        if (procsRes.error) {
          setProceduresError(procsRes.error);
          setVideos([]);
          setLibraryVideos([]);
        } else {
          setProceduresError(null);
          setVideos(applyLikedBaseline(procsRes.procedures, nextLikedSet));
          setExtraViews({});
          setProceduresReloadSeq((n) => n + 1);
        }

        if (reelsRes.error) {
          setReelsError(reelsRes.error);
          setPosts([]);
          setReelsHasMore(false);
        } else {
          setReelsError(null);
          setReelsHasMore(reelsRes.hasMore);
          setPosts(applyReelLikedBaseline(reelsRes.reels, nextReelLikedSet));
        }

        if (!signalsRes.error) {
          setReelSignals(signalsRes.signals);
        }
        signalsLoadedRef.current = true;

        if (!milestonesRes.error) {
          setMilestones(milestonesRes.milestones);
        }

        if (friendshipsRes.error) {
          setFriendsError(friendshipsRes.error);
          setFriends([]);
          setIncomingRequests([]);
          setOutgoingRequests([]);
        } else {
          setFriendsError(null);
          setFriends(friendshipsRes.friends);
          setIncomingRequests(friendshipsRes.incomingRequests);
          setOutgoingRequests(friendshipsRes.outgoingRequests);
          if (
            activeChatRef.current &&
            !friendshipsRes.friends.some((f) => f.name === activeChatRef.current)
          ) {
            setActiveChat(null);
          }
        }

        if (chatsRes.error) {
          setChatsError(chatsRes.error);
          setChats({});
          setUnreadCounts({});
        } else {
          setChatsError(null);
          syncChatIdsIntoRef(chatsRes.chats);
          setChats(chatsRes.chats);
          setUnreadCounts(chatsRes.unreadCounts);
        }

        if (discoverRes.error) {
          setDiscoverError(discoverRes.error);
          setDiscoverPeople([]);
        } else {
          lastDiscoverRefreshRef.current = Date.now();
          setDiscoverError(null);
          setDiscoverPeople(discoverRes.people);
        }

        if (!notifsRes.error) {
          setNotifications(notifsRes.notifications);
        } else {
          setNotifications([]);
        }

        if (isAdminUser) {
          setMyFeedback([]);
          setMyFeedbackError(null);
          if (adminFeedbackRes.error) {
            setAdminFeedbackError(adminFeedbackRes.error);
          } else {
            setAdminFeedbackError(null);
            setAdminFeedback(adminFeedbackRes.items);
          }
        } else {
          setAdminFeedback([]);
          setAdminFeedbackError(null);
          if (myFeedbackRes.error) {
            setMyFeedbackError(myFeedbackRes.error);
          } else {
            setMyFeedbackError(null);
            setMyFeedback(myFeedbackRes.items);
          }
        }
      } finally {
        setProceduresLoading(false);
        setReelsLoading(false);
        setFriendsLoading(false);
        setDiscoverLoading(false);
        setChatsLoading(false);
        setMyFeedbackLoading(false);
        setAdminFeedbackLoading(false);
      }
    },
    [applyLikedBaseline, applyReelLikedBaseline, syncChatIdsIntoRef],
  );

  const refreshAuthoritativeProfile = useCallback(
    async (force = false) => {
      if (!isSupabaseConfigured) return;
      const currentUser = userRef.current;
      if (!currentUser.id) return;

      const now = Date.now();
      if (!force && now - lastProfileRefreshRef.current < 4000) {
        return;
      }
      lastProfileRefreshRef.current = now;

      const { profile } = await fetchAuthoritativeMyProfile(currentUser.id);
      if (!profile) return;

      const changed = JSON.stringify(profile) !== JSON.stringify(userRef.current);
      if (changed) {
        setUser(profile);
        if (typeof profile.sharePracticePopups === 'boolean') {
          setShareEnabled(profile.sharePracticePopups);
        }
        await syncRoleScopedData(profile);
      }
    },
    [syncRoleScopedData],
  );

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

    const clearSessionState = (notice?: AuthNotice, forceAuthScreen = false) => {
      appliedAuthUserIdRef.current = null;
      inFlightAuthUserIdRef.current = null;
      try {
        localStorage.removeItem(STORAGE_KEYS.user);
      } catch {
        // ignore
      }
      setUser({ email: '', name: '', role: 'learner' });
      setAccounts([]);
      setApplications([]);
      setSubmissionsQueue([]);
      setReports([]);
      setVideos([]);
      setLibraryVideos([]);
      setProceduresError(null);
      setPosts([]);
      setReelsError(null);
      setReelsHasMore(false);
      setReelsLoadingMore(false);
      setMilestones([]);
      setReelSignals(INITIAL_REEL_SIGNALS);
      signalsLoadedRef.current = false;
      if (signalsSaveTimerRef.current) {
        window.clearTimeout(signalsSaveTimerRef.current);
        signalsSaveTimerRef.current = null;
      }
      postFileRef.current = null;
      setEditingPostId(null);
      setPostSubmitting(false);
      setSavedIds(new Set());
      setCompletedStepsMap({});
      setExtraViews({});
      setVideoComments({});
      serverLikedProcIdsRef.current = new Set();
      serverLikedReelIdsRef.current = new Set();
      setLikedKeys(new Set());
      setFriends([]);
      setDiscoverPeople([]);
      lastDiscoverRefreshRef.current = 0;
      discoverRefreshInFlightRef.current = false;
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setFriendsError(null);
      setDiscoverError(null);
      setBusyFriendIds(new Set());
      setSentRequests([]);
      setChats({});
      setUnreadCounts({});
      setActiveChat(null);
      setChatsError(null);
      setChatSending(false);
      setBusyChatMsgIds(new Set());
      seenChatMsgIdsRef.current.clear();
      setNotifications([]);
      setMyFeedback([]);
      setMyFeedbackError(null);
      setAdminFeedback([]);
      setAdminFeedbackError(null);
      setHighlightedFeedbackId(null);
      setRequestedAdminTab(null);
      if (notice) {
        setAuthNotice(notice);
      }
      setScreen((prev) =>
        forceAuthScreen ? 'auth' : prev === 'app' ? 'auth' : prev,
      );
    };

    const commitAuthenticatedProfile = async (resolvedProfile: UserProfile) => {
      if (resolvedProfile.id) {
        appliedAuthUserIdRef.current = resolvedProfile.id;
      }
      lastProfileRefreshRef.current = Date.now();
      if (!active) return;

      setUser(resolvedProfile);
      if (typeof resolvedProfile.sharePracticePopups === 'boolean') {
        setShareEnabled(resolvedProfile.sharePracticePopups);
      }
      setAuthNotice(undefined);
      setScreen('app');
      await syncRoleScopedData(resolvedProfile);
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
        const { profile, error: profileError } =
          await fetchAuthoritativeMyProfile(sessionUser.id);
        if (!active) return;

        if (!profile) {
          // Do not downgrade an already-authenticated user on transient network failure
          if (
            appliedAuthUserIdRef.current === sessionUser.id &&
            userRef.current.id === sessionUser.id
          ) {
            return;
          }
          void signOutSupabase();
          clearSessionState(
            {
              error:
                profileError ||
                'Unable to load your profile from the database. Please sign in again.',
            },
            true,
          );
          return;
        }

        await commitAuthenticatedProfile(profile);
      } finally {
        if (inFlightAuthUserIdRef.current === sessionUser.id) {
          inFlightAuthUserIdRef.current = null;
        }
      }
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

            if (inFlightAuthUserIdRef.current === session.user.id) {
              setScreen('app');
              return;
            }

            if (
              event === 'INITIAL_SESSION' &&
              appliedAuthUserIdRef.current === session.user.id
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
  }, [showToast, syncRoleScopedData]);

  // Refresh authoritative role & profile on Realtime update, focus, or opening Profile/Admin
  useEffect(() => {
    if (screen !== 'app' || !isSupabaseConfigured || !user.id) return;

    const unsubscribeRealtime = subscribeToMyProfileChanges(
      user.id,
      (updatedProfile) => {
        const changed =
          JSON.stringify(updatedProfile) !== JSON.stringify(userRef.current);
        if (!changed) return;
        setUser(updatedProfile);
        if (typeof updatedProfile.sharePracticePopups === 'boolean') {
          setShareEnabled(updatedProfile.sharePracticePopups);
        }
        void syncRoleScopedData(updatedProfile);
      },
    );

    const handleWindowFocus = () => {
      void refreshAuthoritativeProfile(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshAuthoritativeProfile(false);
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeRealtime();
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    screen,
    user.id,
    refreshAuthoritativeProfile,
    syncRoleScopedData,
  ]);

  useEffect(() => {
    if (screen === 'app' && activeTab === 'me' && isSupabaseConfigured && user.id) {
      void refreshAuthoritativeProfile(true);
    }
  }, [screen, activeTab, user.id, refreshAuthoritativeProfile]);

  // Subscribe to Realtime Reels, comments, and moderation reports
  useEffect(() => {
    if (screen !== 'app' || !isSupabaseConfigured || !user.id) return;

    const canModerateNow =
      user.role === 'admin' ||
      (user.role === 'sub_admin' && Boolean(user.permissions?.canModeratePosts));

    return subscribeToReelsUpdates(user.id, canModerateNow, {
      onReelUpsert: (incoming) => {
        const baselineAdjustment = serverLikedReelIdsRef.current.has(incoming.id)
          ? 1
          : 0;
        const normalized: ReelPost = {
          ...incoming,
          likes: Math.max(0, incoming.likes - baselineAdjustment),
        };
        setPosts((prev) => {
          const exists = prev.some((p) => p.id === normalized.id);
          if (!exists) {
            return [normalized, ...prev];
          }
          return prev.map((p) =>
            p.id === normalized.id
              ? { ...normalized, comments: p.comments }
              : p,
          );
        });
      },
      onReelRemove: (reelId) => {
        setPosts((prev) => prev.filter((p) => p.id !== reelId));
      },
      onCommentInsert: (reelId, comment) => {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== reelId) return p;
            if (
              comment.id !== undefined &&
              p.comments.some((c) => c.id === comment.id)
            ) {
              return p;
            }
            return { ...p, comments: [...p.comments, comment] };
          }),
        );
      },
      onCommentDelete: (commentId) => {
        setPosts((prev) =>
          prev.map((p) =>
            p.comments.some((c) => c.id === commentId)
              ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
              : p,
          ),
        );
      },
      onReportsChanged: () => {
        if (!canModerateNow) return;
        void fetchPostReports().then(({ reports: nextReports, error }) => {
          if (!error) setReports(nextReports);
        });
      },
    });
  }, [screen, user.id, user.role, user.permissions?.canModeratePosts]);

  // Subscribe to Realtime incoming friend requests and friendship status updates
  useEffect(() => {
    if (screen !== 'app' || !isSupabaseConfigured || !user.id) return;
    const currentUserId = user.id;

    return subscribeToFriendshipsUpdates(currentUserId, () => {
      void refreshFriendshipsState(currentUserId, false);
    });
  }, [screen, user.id, refreshFriendshipsState]);

  // Refresh Discover People & Friendships from DB when opening/revisiting Friends tab
  useEffect(() => {
    if (
      screen !== 'app' ||
      activeTab !== 'friends' ||
      !isSupabaseConfigured ||
      !user.id
    ) {
      return;
    }
    void refreshFriendshipsState(user.id, false);
    void refreshDiscoverPeopleState(user.id, false, false);
  }, [
    screen,
    activeTab,
    user.id,
    refreshFriendshipsState,
    refreshDiscoverPeopleState,
  ]);

  // Subscribe to Realtime chat messages & read-status updates
  useEffect(() => {
    if (screen !== 'app' || !isSupabaseConfigured || !user.id) return;
    const currentUserId = user.id;

    return subscribeToChatMessages(currentUserId, {
      onInsert: (row) => {
        const otherUserId =
          row.sender_id === currentUserId ? row.recipient_id : row.sender_id;
        const friend = friendsRef.current.find((f) => f.id === otherUserId);
        if (!friend) {
          void refreshFriendshipsState(currentUserId, false);
          return;
        }

        const mapped = mapChatRowToMessage(row, currentUserId);
        if (!mapped) return;

        const alreadySeen = seenChatMsgIdsRef.current.has(row.id);
        seenChatMsgIdsRef.current.add(row.id);

        setChats((prev) => {
          const list = prev[friend.name] || [];
          if (list.some((m) => m.id === mapped.id)) return prev;
          return {
            ...prev,
            [friend.name]: [...list, mapped],
          };
        });

        if (row.recipient_id === currentUserId && !row.read_at) {
          const isOpenThread =
            activeTabRef.current === 'friends' &&
            activeChatRef.current === friend.name;
          if (isOpenThread) {
            void markConversationAsReadInSupabase(
              currentUserId,
              otherUserId,
            ).then(({ updatedIds, readAt }) => {
              if (updatedIds.length > 0 && readAt) {
                const updatedSet = new Set(updatedIds);
                setChats((prev) => {
                  const list = prev[friend.name];
                  if (!list) return prev;
                  return {
                    ...prev,
                    [friend.name]: list.map((m) =>
                      m.id && updatedSet.has(m.id) ? { ...m, readAt } : m,
                    ),
                  };
                });
              }
            });
          } else if (!alreadySeen) {
            setUnreadCounts((prev) => ({
              ...prev,
              [friend.name]: (prev[friend.name] || 0) + 1,
            }));
          }
        }
      },
      onUpdate: (row) => {
        const otherUserId =
          row.sender_id === currentUserId ? row.recipient_id : row.sender_id;
        const friend = friendsRef.current.find((f) => f.id === otherUserId);
        if (!friend) return;

        setChats((prev) => {
          const list = prev[friend.name];
          if (!list) return prev;
          let changed = false;
          const nextList = list.map((m) => {
            if (m.id !== row.id) return m;
            changed = true;
            const updated: ChatMessage = {
              ...m,
              readAt: row.read_at,
            };
            if (updated.type === 'invite' && row.invite_status) {
              return { ...updated, status: row.invite_status };
            }
            return updated;
          });
          if (!changed) return prev;
          return {
            ...prev,
            [friend.name]: nextList,
          };
        });

        if (row.recipient_id === currentUserId) {
          const currentList = chatsRef.current[friend.name] || [];
          const nextUnread = currentList.filter((m) => {
            if (m.me) return false;
            if (m.id === row.id) return !row.read_at;
            return !m.readAt;
          }).length;
          setUnreadCounts((uPrev) => ({
            ...uPrev,
            [friend.name]: nextUnread,
          }));
        }
      },
    });
  }, [screen, user.id, refreshFriendshipsState]);

  // Mark all notifications as read when opening notifications sheet
  useEffect(() => {
    if (sheet?.kind === 'notifications' && isSupabaseConfigured && user.id) {
      void markAllNotificationsAsReadInSupabase(user.id).then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
        );
      });
    }
  }, [sheet?.kind, user.id]);

  // Subscribe to Realtime notifications updates
  useEffect(() => {
    if (screen !== 'app' || !isSupabaseConfigured || !user.id) return;
    const currentUserId = user.id;

    return subscribeToNotifications(currentUserId, {
      onInsert: (row) => {
        const mapped = mapNotificationRow(row);
        setNotifications((prev) => {
          if (prev.some((n) => n.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      },
      onUpdate: (row) => {
        const mapped = mapNotificationRow(row);
        setNotifications((prev) =>
          prev.map((n) => (n.id === mapped.id ? mapped : n)),
        );
      },
      onDelete: (notificationId) => {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      },
    });
  }, [screen, user.id]);

  // Subscribe to Realtime Feedback updates (status/reply for user, new/updated for Supreme Admin)
  useEffect(() => {
    if (screen !== 'app' || !isSupabaseConfigured || !user.id) return;
    const currentUserId = user.id;
    const isAdminUser = user.role === 'admin';

    return subscribeToFeedbackUpdates(currentUserId, isAdminUser, () => {
      if (isAdminUser) {
        void refreshAdminFeedbackState(accountsRef.current, false);
      } else {
        void refreshMyFeedbackState(currentUserId, false);
      }
    });
  }, [
    screen,
    user.id,
    user.role,
    refreshAdminFeedbackState,
    refreshMyFeedbackState,
  ]);

  // Persist recommender reel signals to Supabase (debounced)
  useEffect(() => {
    if (
      !isSupabaseConfigured ||
      screen !== 'app' ||
      !user.id ||
      !signalsLoadedRef.current
    ) {
      return;
    }

    if (signalsSaveTimerRef.current) {
      window.clearTimeout(signalsSaveTimerRef.current);
    }
    signalsSaveTimerRef.current = window.setTimeout(() => {
      void upsertMyReelSignals(user.id!, reelSignals);
    }, 700);

    return () => {
      if (signalsSaveTimerRef.current) {
        window.clearTimeout(signalsSaveTimerRef.current);
        signalsSaveTimerRef.current = null;
      }
    };
  }, [reelSignals, screen, user.id]);

  // Query Supabase published procedure library when filters or search change
  useEffect(() => {
    if (!isSupabaseConfigured || screen !== 'app' || !user.id) return;

    let active = true;
    const reqId = ++filterRequestIdRef.current;
    const debounceMs = searchQuery.trim() ? 180 : 0;

    setLibraryFilterLoading(true);
    const timer = window.setTimeout(async () => {
      const { procedures, error } = await queryPublishedProcedures({
        discipline,
        region: regionFilter,
        category: categoryFilter,
        searchQuery,
      });
      if (!active || reqId !== filterRequestIdRef.current) return;

      if (error) {
        setProceduresError(error);
        setLibraryVideos([]);
      } else {
        setProceduresError(null);
        setLibraryVideos(
          applyLikedBaseline(procedures, serverLikedProcIdsRef.current),
        );
      }
      setLibraryFilterLoading(false);
    }, debounceMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    screen,
    user.id,
    discipline,
    regionFilter,
    categoryFilter,
    searchQuery,
    proceduresReloadSeq,
    applyLikedBaseline,
  ]);

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
    lastProfileRefreshRef.current = Date.now();

    if (!isSupabaseConfigured && isNewAccount) {
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
    setScreen('app');

    if (isSupabaseConfigured) {
      void syncRoleScopedData(profile);
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
    if (isSupabaseConfigured) {
      setAccounts([]);
      setApplications([]);
      setSubmissionsQueue([]);
      setReports([]);
      setVideos([]);
      setLibraryVideos([]);
      setProceduresError(null);
      setPosts([]);
      setReelsError(null);
      setReelsHasMore(false);
      setReelsLoadingMore(false);
      setMilestones([]);
      setReelSignals(INITIAL_REEL_SIGNALS);
      signalsLoadedRef.current = false;
      if (signalsSaveTimerRef.current) {
        window.clearTimeout(signalsSaveTimerRef.current);
        signalsSaveTimerRef.current = null;
      }
      postFileRef.current = null;
      setEditingPostId(null);
      setPostSubmitting(false);
      setSavedIds(new Set());
      setCompletedStepsMap({});
      setExtraViews({});
      setVideoComments({});
      serverLikedProcIdsRef.current = new Set();
      serverLikedReelIdsRef.current = new Set();
      setLikedKeys(new Set());
      setFriends([]);
      setDiscoverPeople([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setFriendsError(null);
      setDiscoverError(null);
      setBusyFriendIds(new Set());
      setSentRequests([]);
      setChats({});
      setUnreadCounts({});
      setNotifications([]);
      setMyFeedback([]);
      setMyFeedbackError(null);
      setAdminFeedback([]);
      setAdminFeedbackError(null);
      setHighlightedFeedbackId(null);
      setRequestedAdminTab(null);
    }
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

  const isAdmin = user.role === 'admin';
  const canContribute = user.role === 'instructor' || isAdmin;
  const canReviewVideos =
    isAdmin ||
    (user.role === 'sub_admin' && Boolean(user.permissions?.canReviewVideos));
  const canModeratePosts =
    isAdmin ||
    (user.role === 'sub_admin' && Boolean(user.permissions?.canModeratePosts));

  const localFilteredVideos = useMemo(() => {
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

  const displayedVideos = isSupabaseConfigured
    ? libraryVideos
    : localFilteredVideos;

  const savedVideos = useMemo(
    () => videos.filter((v) => savedIds.has(v.id)),
    [videos, savedIds],
  );

  const pendingNotifCount = useMemo(
    () =>
      incomingRequests.length +
      notifications.filter((n) => !n.readAt).length,
    [incomingRequests.length, notifications],
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
    const target =
      videos.find((v) => v.id === videoId) ||
      libraryVideos.find((v) => v.id === videoId);
    if (!target) return;
    setOpenVideoId(videoId);
    setDetailTab(initialTab);
    setPracticeSession(createPracticeSession(target));
    setExtraViews((prev) => ({
      ...prev,
      [videoId]: (prev[videoId] || 0) + 1,
    }));
    if (isSupabaseConfigured) {
      void incrementProcedureViewRpc(videoId);
    }
    boostAffinity(target.discipline, target.category, initialTab === 'practice' ? 2 : 1);
  };

  const toggleSaveVideo = (videoId: number) => {
    const target =
      videos.find((v) => v.id === videoId) ||
      libraryVideos.find((v) => v.id === videoId);
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

    if (isSupabaseConfigured && user.id) {
      void setSavedProcedureInSupabase(user.id, videoId, willSave).then(
        ({ error }) => {
          if (!error) return;
          setSavedIds((prev) => {
            const rollback = new Set(prev);
            if (willSave) rollback.delete(videoId);
            else rollback.add(videoId);
            return rollback;
          });
          showToast(error);
        },
      );
    }
  };

  const toggleLikeKey = (key: string) => {
    if (isSupabaseConfigured && !user.id) {
      showToast('Please sign in to like posts.');
      return;
    }

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

    if (isSupabaseConfigured && user.id && key.startsWith('v')) {
      const videoId = Number(key.slice(1));
      if (!Number.isNaN(videoId)) {
        void setProcedureLikeInSupabase(user.id, videoId, willLike).then(
          ({ error }) => {
            if (!error) return;
            setLikedKeys((prev) => {
              const rollback = new Set(prev);
              if (willLike) rollback.delete(key);
              else rollback.add(key);
              return rollback;
            });
            showToast(error);
          },
        );
      }
    } else if (isSupabaseConfigured && user.id && key.startsWith('p')) {
      const reelId = Number(key.slice(1));
      if (!Number.isNaN(reelId)) {
        const hadBaseline = serverLikedReelIdsRef.current.has(reelId);
        if (willLike) serverLikedReelIdsRef.current.add(reelId);
        else serverLikedReelIdsRef.current.delete(reelId);

        void setReelLikeInSupabase(user.id, reelId, willLike).then(
          ({ error }) => {
            if (!error) return;
            if (hadBaseline) serverLikedReelIdsRef.current.add(reelId);
            else serverLikedReelIdsRef.current.delete(reelId);
            setLikedKeys((prev) => {
              const rollback = new Set(prev);
              if (willLike) rollback.delete(key);
              else rollback.add(key);
              return rollback;
            });
            showToast(error);
          },
        );
      }
    }
  };

  const ensureLikePost = (postId: number) => {
    if (isSupabaseConfigured && !user.id) return;
    const key = `p${postId}`;
    if (likedKeys.has(key)) return;
    setLikedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const post = posts.find((p) => p.id === postId);
    if (post) boostAffinity(post.discipline, post.category, 2);

    if (isSupabaseConfigured && user.id) {
      serverLikedReelIdsRef.current.add(postId);
      void setReelLikeInSupabase(user.id, postId, true).then(({ error }) => {
        if (!error) return;
        serverLikedReelIdsRef.current.delete(postId);
        setLikedKeys((prev) => {
          const rollback = new Set(prev);
          rollback.delete(key);
          return rollback;
        });
        showToast(error);
      });
    }
  };

  const toggleStepDone = (videoId: number, stepIndex: number) => {
    const target =
      videos.find((v) => v.id === videoId) ||
      libraryVideos.find((v) => v.id === videoId);
    const totalLen = Math.max(
      target?.steps.length || 0,
      (completedStepsMap[videoId] || []).length,
      stepIndex + 1,
    );
    const prevSteps = completedStepsMap[videoId] || [];
    const nextSteps = Array.from({ length: totalLen }, (_, idx) =>
      idx === stepIndex ? !prevSteps[idx] : Boolean(prevSteps[idx]),
    );

    setCompletedStepsMap((prev) => ({
      ...prev,
      [videoId]: nextSteps,
    }));

    if (isSupabaseConfigured && user.id) {
      void upsertProcedureProgressInSupabase(user.id, videoId, nextSteps).then(
        ({ error }) => {
          if (!error) return;
          setCompletedStepsMap((prev) => ({
            ...prev,
            [videoId]: prevSteps,
          }));
          showToast(error);
        },
      );
    }
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
    const tempId = nextIdRef.current++;
    const procedureTitle = targetVideo?.title || 'Clinical procedure';
    const category = targetVideo?.category || 'Clinical skills';
    const newMilestone: PracticeMilestone = {
      id: tempId,
      userName,
      procedureTitle,
      vid: session.vid,
      category,
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

    if (isSupabaseConfigured && user.id) {
      void createPracticeMilestoneInSupabase({
        userId: user.id,
        userName,
        procedureId: session.vid,
        procedureTitle,
        category,
        points,
        scoreText,
        reflection: session.reflection,
      }).then(({ milestone }) => {
        if (!milestone) return;
        setMilestones((prev) =>
          prev.map((m) => (m.id === tempId ? milestone : m)),
        );
      });
    }
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
    contributeFileRef.current = null;
    const defaults = createDefaultContributeForm();
    defaults.by = user.qualifications
      ? `${user.name}, ${user.qualifications.split('·')[0].trim()}`
      : user.name;
    setContributeForm(defaults);
    setContributeSubmitted(false);
    setContributeOpen(true);
  };

  const handlePickContributeFile = (file: File) => {
    contributeFileRef.current = file;
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

  const handleSubmitContribute = async () => {
    if (!canContribute) {
      showToast('Verified instructor or admin access is required to submit videos.');
      return;
    }

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

    if (isSupabaseConfigured && user.id) {
      const { submission, error } = await submitVideoForReviewToSupabase({
        userId: user.id,
        email: user.email,
        form: f,
        file: contributeFileRef.current,
      });
      if (error || !submission) {
        setContributeForm((prev) => ({
          ...prev,
          errors: [error || 'Unable to submit video for review.'],
        }));
        return;
      }
      contributeFileRef.current = null;
      setSubmissionsQueue((prev) => [submission, ...prev]);
      setContributeSubmitted(true);
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

    contributeFileRef.current = null;
    setSubmissionsQueue((prev) => [...prev, newSubmission]);
    setContributeSubmitted(true);
  };

  const handleReviewDecision = async (
    submissionId: number,
    decision: Exclude<SubmissionStatus, 'pending'>,
  ) => {
    if (!canReviewVideos) {
      showToast('You do not have video review permissions.');
      return;
    }
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

    if (isSupabaseConfigured) {
      const { error } = await reviewVideoSubmissionRpc(
        submissionId,
        decision,
        item.checks,
        item.note,
      );
      if (error) {
        setSubmissionsQueue((prev) =>
          prev.map((s) =>
            s.id === submissionId ? { ...s, err: error } : s,
          ),
        );
        showToast(error);
        return;
      }

      await syncRoleScopedData(user);
      if (decision === 'ok') {
        showToast('Approved. It now appears in Home.');
      } else if (decision === 'chg') {
        showToast('Sent back with a note.');
      } else {
        showToast('Rejected. The contributor is notified.');
      }
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
  const handleSubmitInstructorApplication = async (data: {
    fullName: string;
    qualifications: string;
    youtubeHandle: string;
    note: string;
  }) => {
    if (isSupabaseConfigured && user.id) {
      const { application, error } = await submitInstructorApplicationToSupabase(
        user.id,
        user.email,
        data,
      );
      if (error || !application) {
        showToast(error || 'Unable to submit instructor application.');
        return;
      }
      setApplications((prev) => [
        application,
        ...prev.filter((a) => a.id !== application.id),
      ]);
      setApplyModalOpen(false);
      showToast('Instructor application submitted for admin verification.');
      return;
    }

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

  const handleApproveApplication = async (appId: number) => {
    if (!isAdmin) {
      showToast('Only Supreme Admin can approve instructor applications.');
      return;
    }
    const app = applications.find((a) => a.id === appId);
    if (!app) return;

    if (isSupabaseConfigured) {
      const { error } = await reviewInstructorApplicationRpc(appId, true);
      if (error) {
        showToast(error);
        return;
      }
      await syncRoleScopedData(user);
      showToast(`${app.fullName} approved as a verified clinical instructor.`);
      return;
    }

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

  const handleDeclineApplication = async (appId: number, note: string) => {
    if (!isAdmin) {
      showToast('Only Supreme Admin can decline instructor applications.');
      return;
    }

    if (isSupabaseConfigured) {
      const { error } = await reviewInstructorApplicationRpc(appId, false, note);
      if (error) {
        showToast(error);
        return;
      }
      await syncRoleScopedData(user);
      showToast('Application declined.');
      return;
    }

    setApplications((prev) =>
      prev.map((a) =>
        a.id === appId
          ? { ...a, status: 'declined', decisionNote: note || undefined }
          : a,
      ),
    );
    showToast('Application declined.');
  };

  const handleRevokeInstructor = async (account: UserProfile) => {
    if (!isAdmin) {
      showToast('Only Supreme Admin can revoke instructor permissions.');
      return;
    }

    if (isSupabaseConfigured) {
      if (!account.id) {
        showToast('Missing user ID for instructor revocation.');
        return;
      }
      const { error } = await revokeInstructorRpc(account.id);
      if (error) {
        showToast(error);
        return;
      }
      await syncRoleScopedData(user);
      showToast('Instructor upload permission revoked.');
      return;
    }

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.email.toLowerCase() === account.email.toLowerCase()
          ? { ...acc, role: 'learner' }
          : acc,
      ),
    );
    showToast('Instructor upload permission revoked.');
  };

  const handleAddSubAdmin = async (data: {
    name: string;
    email: string;
    permissions: StaffPermissions;
  }): Promise<string | null> => {
    if (!isAdmin) return 'Unauthorized.';
    const existing = accounts.find(
      (a) => a.email.toLowerCase() === data.email.toLowerCase(),
    );
    if (existing?.role === 'admin') {
      return 'Cannot modify Supreme Admin account.';
    }

    if (isSupabaseConfigured) {
      const { error } = await appointOrUpdateSubAdminRpc({
        email: data.email,
        name: data.name,
        canReview: data.permissions.canReviewVideos,
        canModerate: data.permissions.canModeratePosts,
      });
      if (error) {
        return error;
      }
      await syncRoleScopedData(user);
      showToast(`${data.name} added as sub-admin staff.`);
      return null;
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

  const handleUpdateSubAdminPermissions = async (
    account: UserProfile,
    permissions: StaffPermissions,
  ) => {
    if (!isAdmin) {
      showToast('Only Supreme Admin can update staff permissions.');
      return;
    }

    if (isSupabaseConfigured) {
      const { error } = await appointOrUpdateSubAdminRpc({
        email: account.email,
        name: account.name,
        canReview: permissions.canReviewVideos,
        canModerate: permissions.canModeratePosts,
      });
      if (error) {
        showToast(error);
        return;
      }
      await syncRoleScopedData(user);
      showToast('Staff access updated.');
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.email.toLowerCase() === account.email.toLowerCase()
          ? { ...a, permissions }
          : a,
      ),
    );
    showToast('Staff access updated.');
  };

  const handleRemoveSubAdmin = async (account: UserProfile) => {
    if (!isAdmin) {
      showToast('Only Supreme Admin can remove sub-admin staff.');
      return;
    }

    if (isSupabaseConfigured) {
      if (!account.id) {
        showToast('Missing user ID for sub-admin removal.');
        return;
      }
      const { error } = await removeSubAdminRpc(account.id);
      if (error) {
        showToast(error);
        return;
      }
      await syncRoleScopedData(user);
      showToast('Sub-admin access removed.');
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.email.toLowerCase() === account.email.toLowerCase()
          ? { ...a, role: 'learner', permissions: undefined }
          : a,
      ),
    );
    showToast('Sub-admin access removed.');
  };

  const handleSubmitReport = async (postId: number, reason: string) => {
    if (isSupabaseConfigured && user.id) {
      const { report, error } = await submitPostReportToSupabase(
        user.id,
        user.name || 'Learner',
        postId,
        reason,
      );
      if (error || !report) {
        showToast(error || 'Unable to submit post report.');
        return;
      }
      setReports((prev) => [report, ...prev]);
      setSheet(null);
      showToast(
        'Thanks. An admin or moderation staff member will review this post.',
      );
      return;
    }

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

  const handleModerateReport = async (
    reportId: number,
    action: 'removed' | 'dismissed',
  ) => {
    if (!canModeratePosts) {
      showToast('You do not have post moderation permissions.');
      return;
    }

    const target = reports.find((r) => r.id === reportId);
    if (!target) return;

    if (isSupabaseConfigured) {
      const { error } = await moderateReportedPostRpc(reportId, action);
      if (error) {
        showToast(error);
        return;
      }
      if (action === 'removed') {
        setPosts((prev) => prev.filter((p) => p.id !== target.postId));
      }
      await syncRoleScopedData(user);
      showToast(
        action === 'removed' ? 'Post taken down from Reels.' : 'Report dismissed.',
      );
      return;
    }

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

  const handleLoadMoreReels = async () => {
    if (!isSupabaseConfigured || reelsLoadingMore || !reelsHasMore) return;
    setReelsLoadingMore(true);
    try {
      const { reels, hasMore, error } = await fetchVisibleReelsPage({
        offset: posts.length,
        limit: 20,
      });
      if (error) {
        showToast(error);
        return;
      }
      setReelsHasMore(hasMore);
      const normalized = applyReelLikedBaseline(
        reels,
        serverLikedReelIdsRef.current,
      );
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const uniqueIncoming = normalized.filter((p) => !seen.has(p.id));
        return [...prev, ...uniqueIncoming];
      });
    } finally {
      setReelsLoadingMore(false);
    }
  };

  const handlePickPostFile = (file: File) => {
    if (isSupabaseConfigured) {
      const fileErr = validateReelMediaFile(file, postForm.kind);
      if (fileErr) {
        postFileRef.current = null;
        setPostForm((prev) => ({
          ...prev,
          url: '',
          name: '',
          err: fileErr,
        }));
        return;
      }
    }

    postFileRef.current = file;
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
      err: '',
    }));
  };

  const handleOpenEditPost = (post: ReelPost) => {
    setEditingPostId(post.id);
    postFileRef.current = null;
    const safeCaption = post.caption || '';
    setPostForm({
      kind: post.kind === 'photo' ? 'photo' : 'video',
      url: post.url || '',
      name: safeCaption.slice(0, 32) || 'Existing media',
      isImg: Boolean(post.isImage),
      genre: post.genre || 'Tip',
      discipline: post.discipline || 'general',
      linkedVid: typeof post.vid === 'number' ? post.vid : '',
      caption: safeCaption,
      confirmed: true,
      err: '',
    });
    setSheet({ kind: 'newpost' });
  };

  const handleDeletePost = async (post: ReelPost) => {
    if (isSupabaseConfigured) {
      if (!user.id) {
        showToast('Please sign in first.');
        return;
      }
      const { error } = await deleteReelInSupabase(post.id, post.mediaPath);
      if (error) {
        showToast(error);
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      showToast('Reel deleted.');
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    showToast('Reel deleted.');
  };

  const handlePublishPost = async () => {
    if (postSubmitting) return;

    if (editingPostId === null && !postForm.url && !postForm.name) {
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

    const linkedVideo =
      postForm.linkedVid !== ''
        ? videos.find((v) => v.id === Number(postForm.linkedVid))
        : undefined;

    if (isSupabaseConfigured) {
      if (!user.id) {
        setPostForm((prev) => ({
          ...prev,
          err: 'Please sign in before posting to Reels.',
        }));
        return;
      }

      setPostSubmitting(true);
      try {
        if (editingPostId !== null) {
          const { post, error } = await updateReelInSupabase({
            reelId: editingPostId,
            userId: user.id,
            caption: postForm.caption.trim(),
            genre: postForm.genre,
            discipline: linkedVideo
              ? linkedVideo.discipline
              : postForm.discipline,
            linkedProcedureId: linkedVideo ? linkedVideo.id : null,
            category: linkedVideo ? linkedVideo.category : undefined,
          });
          if (error || !post) {
            setPostForm((prev) => ({
              ...prev,
              err: error || 'Unable to update this Reel.',
            }));
            return;
          }
          const baselineAdjustment = serverLikedReelIdsRef.current.has(post.id)
            ? 1
            : 0;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === post.id
                ? {
                    ...post,
                    comments: p.comments,
                    likes: Math.max(0, post.likes - baselineAdjustment),
                  }
                : p,
            ),
          );
          setEditingPostId(null);
          postFileRef.current = null;
          setSheet(null);
          showToast('Reel updated.');
          return;
        }

        const file = postFileRef.current;
        if (!file) {
          setPostForm((prev) => ({
            ...prev,
            err: 'Select or record a media file to upload.',
          }));
          return;
        }

        const { post, error } = await createReelInSupabase({
          user,
          form: postForm,
          file,
          linkedCategory: linkedVideo?.category,
        });
        if (error || !post) {
          setPostForm((prev) => ({
            ...prev,
            err: error || 'Unable to publish Reel.',
          }));
          return;
        }

        setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
        postFileRef.current = null;
        setSheet(null);
        showToast('Posted to Reels.');
      } finally {
        setPostSubmitting(false);
      }
      return;
    }

    if (editingPostId !== null) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editingPostId
            ? {
                ...p,
                caption: postForm.caption.trim(),
                genre: postForm.genre,
                discipline: linkedVideo
                  ? linkedVideo.discipline
                  : postForm.discipline,
                category: linkedVideo ? linkedVideo.category : undefined,
                vid: linkedVideo ? linkedVideo.id : undefined,
              }
            : p,
        ),
      );
      setEditingPostId(null);
      postFileRef.current = null;
      setSheet(null);
      showToast('Reel updated.');
      return;
    }

    const roleLabel =
      user.role === 'instructor'
        ? 'Clinical instructor'
        : user.role === 'admin' || user.role === 'sub_admin'
        ? 'Contributor'
        : 'Learner';

    const newPost: ReelPost = {
      id: nextIdRef.current++,
      kind: postForm.kind === 'photo' ? 'photo' : 'video',
      by: user.name || 'Learner',
      role: roleLabel,
      org: '',
      reg: '',
      bio: '',
      verified: user.role === 'instructor' || user.role === 'admin',
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
    postFileRef.current = null;
    setSheet(null);
    showToast('Posted to Reels.');
  };

  const handleRecordReelView = useCallback((postId: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, views: p.views + 1 } : p)),
    );
    if (isSupabaseConfigured && userRef.current.id) {
      void incrementReelViewRpc(postId);
    }
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
    if (isSupabaseConfigured && user.id) {
      void incrementReelPracticeClickRpc(fromPostId);
    }
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
    if (isSupabaseConfigured && user.id) {
      void upsertMyReelSignals(user.id, INITIAL_REEL_SIGNALS);
    }
    showToast('Feed preferences reset.');
  };

  const handleAddComment = async (
    target: 'post' | 'video',
    id: number,
    text: string,
  ) => {
    const authorName = user.name || 'Learner';
    const newComment: CommentItem = {
      name: authorName,
      text,
      ago: 'now',
    };
    if (target === 'post') {
      if (isSupabaseConfigured) {
        if (!user.id) {
          showToast('Please sign in to post a comment.');
          return;
        }
        const { comment, error } = await addReelCommentInSupabase(
          id,
          user.id,
          authorName,
          text,
        );
        if (error || !comment) {
          showToast(error || 'Unable to post comment.');
          return;
        }
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== id) return p;
            if (
              comment.id !== undefined &&
              p.comments.some((c) => c.id === comment.id)
            ) {
              return p;
            }
            return { ...p, comments: [...p.comments, comment] };
          }),
        );
        return;
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, comments: [...p.comments, newComment] } : p,
        ),
      );
      return;
    }

    if (isSupabaseConfigured && user.id) {
      const { comment, error } = await addProcedureCommentInSupabase(
        id,
        user.id,
        authorName,
        text,
      );
      if (error || !comment) {
        showToast(error || 'Unable to save comment.');
        return;
      }
      setVideoComments((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), comment],
      }));
      return;
    }

    setVideoComments((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), newComment],
    }));
  };

  const handleDeleteComment = async (reelId: number, commentId: number) => {
    if (isSupabaseConfigured) {
      const { error } = await deleteReelCommentInSupabase(commentId);
      if (error) {
        showToast(error);
        return;
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === reelId
            ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
            : p,
        ),
      );
      showToast('Comment deleted.');
      return;
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === reelId
          ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
          : p,
      ),
    );
  };

  const setFriendBusy = (key: string, busy: boolean) => {
    setBusyFriendIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleAddFriend = async (name: string, person?: PersonCandidate) => {
    if (!isSupabaseConfigured) {
      setSentRequests((prev) => (prev.includes(name) ? prev : [...prev, name]));
      showToast('Friend request sent.');
      return;
    }

    if (!user.id || !person?.id) {
      showToast('Sign in and select a valid user to send a request.');
      return;
    }

    if (isAdministrativeRole(user.role)) {
      showToast(
        'Administrative accounts are private and cannot initiate friend requests.',
      );
      return;
    }

    const busyKey = `add:${person.id}`;
    if (busyFriendIds.has(busyKey)) return;
    setFriendBusy(busyKey, true);
    try {
      const { request, error } = await sendFriendRequestInSupabase(
        user.id,
        person.id,
        user.role,
      );
      if (error || !request) {
        showToast(error || 'Unable to send friend request.');
        void refreshFriendshipsState(user.id, false);
        return;
      }
      setOutgoingRequests((prev) =>
        prev.some((r) => r.id === request.id) ? prev : [request, ...prev],
      );
      showToast('Friend request sent.');
    } finally {
      setFriendBusy(busyKey, false);
    }
  };

  const handleAcceptFriendRequest = async (requestId: number) => {
    if (!isSupabaseConfigured || !user.id) return;
    const busyKey = `req:${requestId}`;
    if (busyFriendIds.has(busyKey)) return;
    setFriendBusy(busyKey, true);
    try {
      const { error } = await respondToFriendRequestInSupabase(
        requestId,
        user.id,
        true,
      );
      if (error) {
        showToast(error);
        void refreshFriendshipsState(user.id, false);
        return;
      }
      await refreshFriendshipsState(user.id, false);
      showToast('Friend request accepted.');
    } finally {
      setFriendBusy(busyKey, false);
    }
  };

  const handleDeclineFriendRequest = async (requestId: number) => {
    if (!isSupabaseConfigured || !user.id) return;
    const busyKey = `req:${requestId}`;
    if (busyFriendIds.has(busyKey)) return;
    setFriendBusy(busyKey, true);
    try {
      const { error } = await respondToFriendRequestInSupabase(
        requestId,
        user.id,
        false,
      );
      if (error) {
        showToast(error);
        void refreshFriendshipsState(user.id, false);
        return;
      }
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      showToast('Friend request declined.');
    } finally {
      setFriendBusy(busyKey, false);
    }
  };

  const handleCancelFriendRequest = async (requestId: number) => {
    if (!isSupabaseConfigured || !user.id) return;
    const busyKey = `req:${requestId}`;
    if (busyFriendIds.has(busyKey)) return;
    setFriendBusy(busyKey, true);
    try {
      const { error } = await cancelFriendRequestInSupabase(requestId, user.id);
      if (error) {
        showToast(error);
        void refreshFriendshipsState(user.id, false);
        return;
      }
      setOutgoingRequests((prev) => prev.filter((r) => r.id !== requestId));
      showToast('Friend request cancelled.');
    } finally {
      setFriendBusy(busyKey, false);
    }
  };

  const handleSelectChat = async (friendName: string | null) => {
    setActiveChat(friendName);
    if (!friendName) return;

    setUnreadCounts((prev) => ({ ...prev, [friendName]: 0 }));

    if (!isSupabaseConfigured || !user.id) return;
    const friend = friends.find((f) => f.name === friendName);
    if (!friend?.id) return;

    if (chatsError) {
      const conv = await fetchConversationMessagesFromSupabase(
        user.id,
        friend.id,
      );
      if (!conv.error) {
        setChatsError(null);
        for (const msg of conv.messages) {
          if (typeof msg.id === 'number') {
            seenChatMsgIdsRef.current.add(msg.id);
          }
        }
        setChats((prev) => ({ ...prev, [friendName]: conv.messages }));
      }
    }

    const { updatedIds, readAt } = await markConversationAsReadInSupabase(
      user.id,
      friend.id,
    );
    if (updatedIds.length > 0 && readAt) {
      const updatedSet = new Set(updatedIds);
      setChats((prev) => {
        const list = prev[friendName];
        if (!list) return prev;
        return {
          ...prev,
          [friendName]: list.map((m) =>
            m.id && updatedSet.has(m.id) ? { ...m, readAt } : m,
          ),
        };
      });
    }
  };

  const handleRetryChat = async (friendName: string) => {
    if (!isSupabaseConfigured || !user.id) return;
    const friend = friends.find((f) => f.name === friendName);
    if (!friend?.id) {
      await refreshChatsState(user.id, friends, true);
      return;
    }
    setChatsLoading(true);
    try {
      const res = await fetchConversationMessagesFromSupabase(
        user.id,
        friend.id,
      );
      if (res.error) {
        setChatsError(res.error);
      } else {
        setChatsError(null);
        for (const msg of res.messages) {
          if (typeof msg.id === 'number') {
            seenChatMsgIdsRef.current.add(msg.id);
          }
        }
        setChats((prev) => ({ ...prev, [friendName]: res.messages }));
        setUnreadCounts((prev) => ({ ...prev, [friendName]: res.unreadCount }));
      }
    } finally {
      setChatsLoading(false);
    }
  };

  const handleSendMessage = async (
    friendName: string,
    text: string,
  ): Promise<boolean> => {
    const friend = friends.find((f) => f.name === friendName);

    if (!isSupabaseConfigured) {
      setChats((prev) => ({
        ...prev,
        [friendName]: [
          ...(prev[friendName] || []),
          { me: true, type: 'text', text },
        ],
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
      return true;
    }

    if (!user.id || !friend?.id) {
      showToast('You can only send messages to confirmed friends.');
      return false;
    }

    setChatSending(true);
    try {
      const { message, error } = await sendChatMessageInSupabase({
        senderId: user.id,
        recipientId: friend.id,
        msgType: 'text',
        body: text,
      });
      if (error || !message) {
        showToast(error || 'Unable to send message.');
        return false;
      }

      if (typeof message.id === 'number') {
        seenChatMsgIdsRef.current.add(message.id);
      }
      setChats((prev) => {
        const list = prev[friendName] || [];
        if (message.id && list.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [friendName]: [...list, message],
        };
      });
      return true;
    } finally {
      setChatSending(false);
    }
  };

  const handleSendInvite = async () => {
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

    if (!isSupabaseConfigured) {
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
      return;
    }

    if (!user.id || !friend?.id) {
      setInviteForm((prev) => ({
        ...prev,
        err: 'You can only send study invites to confirmed friends.',
      }));
      return;
    }

    const targetFriendName = activeChat;
    const { message, error } = await sendChatMessageInSupabase({
      senderId: user.id,
      recipientId: friend.id,
      msgType: 'invite',
      procedureId: Number(inviteForm.vid),
      scheduledFor: formattedWhen,
      body: inviteForm.note,
    });

    if (error || !message) {
      setInviteForm((prev) => ({
        ...prev,
        err: error || 'Unable to send study invite.',
      }));
      return;
    }

    if (typeof message.id === 'number') {
      seenChatMsgIdsRef.current.add(message.id);
    }
    setChats((prev) => {
      const list = prev[targetFriendName] || [];
      if (message.id && list.some((m) => m.id === message.id)) return prev;
      return {
        ...prev,
        [targetFriendName]: [...list, message],
      };
    });
    setSheet(null);
    showToast('Study invite sent.');
  };

  const handleAcceptChatInvite = async (
    friendName: string,
    messageId: number,
  ) => {
    if (!isSupabaseConfigured || !user.id) return;
    if (busyChatMsgIds.has(messageId)) return;
    setBusyChatMsgIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
    try {
      const { readAt, error } = await acceptStudyInviteInSupabase(
        messageId,
        user.id,
      );
      if (error) {
        showToast(error);
        return;
      }
      setChats((prev) => {
        const list = prev[friendName];
        if (!list) return prev;
        return {
          ...prev,
          [friendName]: list.map((m) =>
            m.id === messageId && m.type === 'invite'
              ? { ...m, status: 'accepted', readAt: readAt || m.readAt }
              : m,
          ),
        };
      });
      showToast('Study invite accepted.');
    } finally {
      setBusyChatMsgIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  const handleSendReminder = async (
    friendName: string,
    messageIndex: number,
  ) => {
    const friend = friends.find((f) => f.name === friendName);
    const targetMsg = (chats[friendName] || [])[messageIndex];
    if (!targetMsg || targetMsg.type !== 'invite') return;

    if (!isSupabaseConfigured) {
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
      return;
    }

    if (!user.id || !friend?.id) {
      showToast('Unable to send reminder.');
      return;
    }

    const { message, error } = await sendChatMessageInSupabase({
      senderId: user.id,
      recipientId: friend.id,
      msgType: 'remind',
      procedureId: targetMsg.vid,
    });
    if (error || !message) {
      showToast(error || 'Unable to send reminder.');
      return;
    }

    if (typeof message.id === 'number') {
      seenChatMsgIdsRef.current.add(message.id);
    }
    setChats((prev) => {
      const list = prev[friendName] || [];
      if (message.id && list.some((m) => m.id === message.id)) return prev;
      return {
        ...prev,
        [friendName]: [...list, message],
      };
    });
    showToast('Reminder sent.');
  };

  const handleRespondNotification = async (id: number, accept: boolean) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    if (!isSupabaseConfigured) {
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          if (!accept) return { ...n, status: 'declined' };
          return {
            ...n,
            status:
              n.type === 'req'
                ? 'done'
                : n.type === 'remind'
                ? 'done'
                : 'accepted',
          };
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
      return;
    }

    if (!user.id) return;

    let nextStatus: 'accepted' | 'declined' | 'done' | 'seen' = 'accepted';
    if (
      target.type === 'remind' ||
      target.type === 'feedback_new' ||
      target.type === 'feedback_update'
    ) {
      nextStatus = 'done';
    } else if (target.type === 'invite') {
      nextStatus = accept ? 'accepted' : 'declined';
    } else {
      nextStatus = accept ? 'done' : 'declined';
    }

    const { readAt, error } = await updateNotificationStatusInSupabase(
      id,
      user.id,
      nextStatus,
    );
    if (error) {
      showToast(error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              status: nextStatus,
              readAt: readAt !== undefined ? readAt : new Date().toISOString(),
            }
          : n,
      ),
    );

    if (target.type === 'invite') {
      showToast(accept ? 'Study invite accepted.' : 'Study invite declined.');
    } else if (target.type === 'remind') {
      showToast('Reminder marked as done.');
    } else if (
      target.type === 'feedback_new' ||
      target.type === 'feedback_update'
    ) {
      showToast('Feedback notification marked as done.');
    } else {
      showToast('Notification updated.');
    }
  };

  const handleSubmitFeedback = async (params: {
    category: FeedbackCategory;
    subject: string;
    message: string;
    isAnonymous: boolean;
    file?: File | null;
  }): Promise<{ item?: FeedbackItem; error?: string }> => {
    if (!isSupabaseConfigured) {
      const ref = `FDK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const now = new Date().toISOString();
      const item: FeedbackItem = {
        id: nextIdRef.current++,
        referenceNumber: ref,
        userId: params.isAnonymous ? null : user.id || 'local-user',
        submitterName: params.isAnonymous ? undefined : user.name,
        submitterEmail: params.isAnonymous ? undefined : user.email,
        category: params.category,
        subject: params.subject,
        message: params.message,
        isAnonymous: params.isAnonymous,
        attachmentName: params.file?.name,
        status: 'received',
        createdAt: now,
        updatedAt: now,
      };
      if (!params.isAnonymous) {
        setMyFeedback((prev) => [item, ...prev]);
      }
      setAdminFeedback((prev) => [item, ...prev]);
      showToast(`Feedback submitted (${ref}).`);
      return { item };
    }

    if (!user.id) {
      return { error: 'Please sign in before submitting feedback.' };
    }

    const res = await submitFeedbackToSupabase({
      userId: user.id,
      category: params.category,
      subject: params.subject,
      message: params.message,
      isAnonymous: params.isAnonymous,
      file: params.file,
    });
    if (res.error || !res.item) {
      return { error: res.error || 'Unable to submit feedback.' };
    }

    if (!res.item.isAnonymous) {
      setMyFeedback((prev) => [
        res.item!,
        ...prev.filter((f) => f.id !== res.item!.id),
      ]);
    }
    showToast(`Feedback received (${res.item.referenceNumber}).`);
    return { item: res.item };
  };

  const handleAdminUpdateFeedback = async (params: {
    feedbackId: number;
    status: FeedbackStatus;
    adminResponse: string;
    internalNote: string;
  }): Promise<{ error?: string }> => {
    if (!isAdmin) {
      return { error: 'Only Supreme Admin can manage platform feedback.' };
    }

    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      setAdminFeedback((prev) =>
        prev.map((item) => {
          if (item.id !== params.feedbackId) return item;
          const trimmedResp = params.adminResponse.trim();
          const trimmedNote = params.internalNote.trim();
          const nextNotes = trimmedNote
            ? [
                {
                  id: nextIdRef.current++,
                  feedbackId: item.id,
                  authorName: user.name || 'Supreme Admin',
                  note: trimmedNote,
                  statusAtTime: params.status,
                  createdAt: now,
                },
                ...(item.internalNotes || []),
              ]
            : item.internalNotes || [];
          return {
            ...item,
            status: params.status,
            adminResponse: trimmedResp || undefined,
            respondedAt: trimmedResp ? now : item.respondedAt,
            resolvedAt:
              params.status === 'resolved' || params.status === 'closed'
                ? item.resolvedAt || now
                : undefined,
            updatedAt: now,
            internalNotes: nextNotes,
          };
        }),
      );
      showToast('Feedback updated.');
      return {};
    }

    if (!user.id) {
      return { error: 'Please sign in as Supreme Admin.' };
    }

    const res = await updateFeedbackByAdminInSupabase({
      feedbackId: params.feedbackId,
      adminId: user.id,
      adminName: user.name || 'Supreme Admin',
      status: params.status,
      adminResponse: params.adminResponse,
      internalNote: params.internalNote,
    });

    if (res.error) {
      return { error: res.error };
    }

    await refreshAdminFeedbackState(accounts, false);
    showToast('Feedback updated.');
    return {};
  };

  const handleOpenFeedbackNotification = (notif: NotificationItem) => {
    setSheet(null);
    setActiveTab('me');
    setHighlightedFeedbackId(notif.feedbackId ?? null);
    if (notif.type === 'feedback_new' && isAdmin) {
      setRequestedAdminTab('feedback');
    }
    if (
      isSupabaseConfigured &&
      user.id &&
      (notif.status === 'pending' || notif.status === 'seen')
    ) {
      void updateNotificationStatusInSupabase(notif.id, user.id, 'done').then(
        ({ readAt }) => {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notif.id
                ? {
                    ...n,
                    status: 'done',
                    readAt:
                      readAt !== undefined ? readAt : new Date().toISOString(),
                  }
                : n,
            ),
          );
        },
      );
    }
  };

  const handleShareToFriend = async (friendName: string, postId: number) => {
    if (!isSupabaseConfigured) {
      setChats((prev) => ({
        ...prev,
        [friendName]: [
          ...(prev[friendName] || []),
          { me: true, type: 'post', pid: postId },
        ],
      }));
      setSheet(null);
      showToast(`Sent to ${friendName.split(' ')[0]}.`);
      return;
    }

    const friend = friends.find((f) => f.name === friendName);
    if (!user.id || !friend?.id) {
      showToast('You can only share reels with confirmed friends.');
      return;
    }

    const { message, error } = await sendChatMessageInSupabase({
      senderId: user.id,
      recipientId: friend.id,
      msgType: 'post',
      reelId: postId,
    });
    if (error || !message) {
      showToast(error || 'Unable to share reel.');
      return;
    }

    if (typeof message.id === 'number') {
      seenChatMsgIdsRef.current.add(message.id);
    }
    setChats((prev) => {
      const list = prev[friendName] || [];
      if (message.id && list.some((m) => m.id === message.id)) return prev;
      return {
        ...prev,
        [friendName]: [...list, message],
      };
    });
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
      ? videos.find((v) => v.id === openVideoId) ||
        libraryVideos.find((v) => v.id === openVideoId) ||
        null
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
    const isInitialLoad =
      isSupabaseConfigured &&
      (proceduresLoading || libraryFilterLoading) &&
      displayedVideos.length === 0;

    if (isInitialLoad) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-slate-200" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (isSupabaseConfigured && proceduresError) {
      return (
        <div className="bg-white border border-red-200 rounded-2xl p-6 max-w-lg">
          <div className="font-display font-bold text-base text-slate-900">
            Unable to load published procedures
          </div>
          <p className="text-sm text-slate-600 mt-1">{proceduresError}</p>
          <button
            type="button"
            onClick={() => {
              setProceduresError(null);
              void syncRoleScopedData(user);
            }}
            className="mt-4 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[44px] transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (displayedVideos.length === 0) {
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
        {displayedVideos.map((v) => (
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
              const displayLabel = id === 'me' && isAdmin ? 'Admin' : label;
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
                  {displayLabel}
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
                {displayedVideos.length} videos
              </span>
            </div>
            {renderProcedureGrid()}
            {!isSupabaseConfigured && (
              <p className="text-xs text-slate-400 pt-2">
                Sample content for demonstration only.
              </p>
            )}
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
            loading={reelsLoading}
            error={reelsError}
            onRetry={() => void syncRoleScopedData(user)}
            hasMore={reelsHasMore}
            loadingMore={reelsLoadingMore}
            onLoadMore={handleLoadMoreReels}
            currentUserId={user.id}
            canModerate={canModeratePosts}
            onEditPost={handleOpenEditPost}
            onDeletePost={handleDeletePost}
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
              setEditingPostId(null);
              postFileRef.current = null;
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
            discoverPeople={discoverPeople}
            sentRequests={sentRequests}
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            loading={friendsLoading}
            error={friendsError}
            onRetry={() => {
              if (user.id) void refreshFriendshipsState(user.id, true);
            }}
            discoverLoading={discoverLoading}
            discoverError={discoverError}
            onRetryDiscover={() => {
              if (user.id) void refreshDiscoverPeopleState(user.id, true, true);
            }}
            busyIds={busyFriendIds}
            chats={chats}
            unreadCounts={unreadCounts}
            chatLoading={chatsLoading}
            chatError={chatsError}
            onRetryChat={(name) => {
              void handleRetryChat(name);
            }}
            chatSending={chatSending}
            busyChatMsgIds={busyChatMsgIds}
            onAcceptInvite={(name, msgId) => {
              void handleAcceptChatInvite(name, msgId);
            }}
            videos={videos}
            posts={posts}
            activeChat={activeChat}
            onSelectChat={(name) => {
              void handleSelectChat(name);
            }}
            onAddFriend={handleAddFriend}
            onAcceptRequest={handleAcceptFriendRequest}
            onDeclineRequest={handleDeclineFriendRequest}
            onCancelRequest={handleCancelFriendRequest}
            onCopyInviteLink={handleCopyInviteLink}
            onSendMessage={handleSendMessage}
            onOpenStudyInvite={() => {
              setInviteForm(createDefaultInvite(videos[0]?.id ?? 1));
              setSheet({ kind: 'invite' });
            }}
            onSendReminder={handleSendReminder}
            onOpenProfile={(personName) =>
              setSheet({ kind: 'profile', by: personName })
            }
            isAdministrativeAccount={isAdministrativeRole(user.role)}
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
            myFeedback={myFeedback}
            myFeedbackLoading={myFeedbackLoading}
            myFeedbackError={myFeedbackError}
            onRetryMyFeedback={() => {
              if (user.id) void refreshMyFeedbackState(user.id, true);
            }}
            onSubmitFeedback={handleSubmitFeedback}
            adminFeedback={adminFeedback}
            adminFeedbackLoading={adminFeedbackLoading}
            adminFeedbackError={adminFeedbackError}
            onRetryAdminFeedback={() => {
              void refreshAdminFeedbackState(accounts, true);
            }}
            onAdminUpdateFeedback={handleAdminUpdateFeedback}
            highlightedFeedbackId={highlightedFeedbackId}
            onClearFeedbackHighlight={() => setHighlightedFeedbackId(null)}
            requestedAdminTab={requestedAdminTab}
            onClearRequestedAdminTab={() => setRequestedAdminTab(null)}
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
          const displayLabel = id === 'me' && isAdmin ? 'Admin' : label;
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
              <span>{displayLabel}</span>
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
        postSubmitting={postSubmitting}
        editingPostId={editingPostId}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        canModerateComments={canModeratePosts}
        incomingFriendRequests={incomingRequests}
        outgoingFriendRequests={outgoingRequests}
        discoverPeople={discoverPeople}
        onAcceptFriendRequest={handleAcceptFriendRequest}
        onDeclineFriendRequest={handleDeclineFriendRequest}
        busyFriendIds={busyFriendIds}
        onRespondNotification={handleRespondNotification}
        onChangeInviteForm={setInviteForm}
        onSendInvite={handleSendInvite}
        onShareToFriend={handleShareToFriend}
        onSubmitReport={handleSubmitReport}
        onOpenVideo={(id) => openProcedure(id, 'watch')}
        onOpenFeedbackNotification={handleOpenFeedbackNotification}
        onClose={() => {
          setEditingPostId(null);
          postFileRef.current = null;
          setSheet(null);
        }}
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
