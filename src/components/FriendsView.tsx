import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarPlus, Link2, Send, UserPlus } from 'lucide-react';
import type {
  ChatMessage,
  Friend,
  FriendRequestItem,
  PersonCandidate,
  ProcedureVideo,
  ReelPost,
} from '../types';
import { getInitials } from '../utils/format';

function formatMessageTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (isSameDay) return timeStr;
  const dayStr = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
  return `${dayStr}, ${timeStr}`;
}

interface FriendsViewProps {
  friends: Friend[];
  discoverPeople: PersonCandidate[];
  sentRequests: string[];
  incomingRequests?: FriendRequestItem[];
  outgoingRequests?: FriendRequestItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  discoverLoading?: boolean;
  discoverError?: string | null;
  onRetryDiscover?: () => void;
  busyIds?: Set<string>;
  chats: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  chatLoading?: boolean;
  chatError?: string | null;
  onRetryChat?: (friendName: string) => void;
  chatSending?: boolean;
  busyChatMsgIds?: Set<number>;
  onAcceptInvite?: (friendName: string, messageId: number) => void;
  videos: ProcedureVideo[];
  posts: ReelPost[];
  activeChat: string | null;
  onSelectChat: (friendName: string | null) => void;
  onAddFriend: (name: string, person?: PersonCandidate) => void;
  onAcceptRequest?: (requestId: number) => void;
  onDeclineRequest?: (requestId: number) => void;
  onCancelRequest?: (requestId: number) => void;
  onCopyInviteLink: () => void;
  onSendMessage: (
    friendName: string,
    text: string,
  ) => Promise<boolean> | boolean | void;
  onOpenStudyInvite: () => void;
  onSendReminder: (friendName: string, messageIndex: number) => void;
  onOpenProfile: (name: string) => void;
  isAdministrativeAccount?: boolean;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  discoverPeople,
  sentRequests,
  incomingRequests = [],
  outgoingRequests = [],
  loading = false,
  error = null,
  onRetry,
  discoverLoading = false,
  discoverError = null,
  onRetryDiscover,
  busyIds,
  chats,
  unreadCounts,
  chatLoading = false,
  chatError = null,
  onRetryChat,
  chatSending = false,
  busyChatMsgIds,
  onAcceptInvite,
  videos,
  posts,
  activeChat,
  onSelectChat,
  onAddFriend,
  onAcceptRequest,
  onDeclineRequest,
  onCancelRequest,
  onCopyInviteLink,
  onSendMessage,
  onOpenStudyInvite,
  onSendReminder,
  onOpenProfile,
  isAdministrativeAccount = false,
}) => {
  const [friendQuery, setFriendQuery] = useState('');
  const [draftMsg, setDraftMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const q = friendQuery.trim().toLowerCase();
  const searchResults = q
    ? discoverPeople.filter((person) => {
        const matchesQuery = person.name.toLowerCase().includes(q);
        if (!matchesQuery) return false;
        const alreadyFriend = friends.some((f) =>
          f.id && person.id ? f.id === person.id : f.name === person.name,
        );
        return !alreadyFriend;
      })
    : [];

  const selectedFriend = activeChat
    ? friends.find((f) => f.name === activeChat)
    : undefined;
  const activeMessages = activeChat ? chats[activeChat] || [] : [];
  const lastOutgoingIdx = (() => {
    for (let i = activeMessages.length - 1; i >= 0; i -= 1) {
      if (activeMessages[i]?.me) return i;
    }
    return -1;
  })();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeChat, activeMessages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftMsg.trim();
    if (!activeChat || !trimmed || chatSending) return;
    const result = await onSendMessage(activeChat, trimmed);
    if (result !== false) {
      setDraftMsg('');
    }
  };

  const renderMessageMeta = (
    m: ChatMessage,
    isLastOutgoing: boolean,
    lightTone: boolean,
  ) => {
    const timeLabel = formatMessageTime(m.createdAt);
    const seenLabel =
      isLastOutgoing && m.me && m.id !== undefined
        ? m.readAt
          ? 'Seen'
          : 'Sent'
        : '';
    if (!timeLabel && !seenLabel) return null;
    return (
      <div
        className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
          lightTone ? 'text-teal-100' : 'text-slate-400'
        }`}
      >
        {timeLabel && <span>{timeLabel}</span>}
        {seenLabel && <span className="font-semibold">{seenLabel}</span>}
      </div>
    );
  };

  const renderMessage = (
    m: ChatMessage,
    idx: number,
    friend: Friend,
    isLastOutgoing: boolean,
  ) => {
    const msgKey = m.id ?? idx;

    if (m.type === 'text') {
      return (
        <div
          key={msgKey}
          className={`max-w-[78%] w-fit px-3.5 py-2.5 rounded-2xl text-sm ${
            m.me
              ? 'ml-auto bg-teal-600 text-white rounded-br-xs'
              : 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{m.text}</div>
          {renderMessageMeta(m, isLastOutgoing, m.me)}
        </div>
      );
    }
    if (m.type === 'remind') {
      const video = videos.find((v) => v.id === m.vid);
      const timeLabel = formatMessageTime(m.createdAt);
      return (
        <div
          key={msgKey}
          className="text-xs text-slate-500 text-center my-2 px-3"
        >
          <span>
            {m.me ? 'Reminder sent' : `${friend.name.split(' ')[0]} sent a reminder`} for “
            {video?.title || 'procedure'}”.
            {!friend.online && m.me && ' They will get it as a notification.'}
          </span>
          {timeLabel && (
            <span className="ml-1.5 text-[10px] text-slate-400">
              {timeLabel}
            </span>
          )}
        </div>
      );
    }
    if (m.type === 'post') {
      const post = posts.find((p) => p.id === m.pid);
      return (
        <div
          key={msgKey}
          className={`max-w-[85%] w-fit border border-teal-500/60 bg-teal-50 rounded-2xl p-3 ${
            m.me ? 'ml-auto' : ''
          }`}
        >
          <div className="text-xs text-slate-500">Shared a reel</div>
          <div className="font-semibold text-sm text-slate-900 mt-0.5">
            {post?.caption ||
              (post?.kind === 'practice' ? 'Practice result' : 'Reel')}
          </div>
          {post && (
            <div className="text-xs text-slate-500 mt-0.5">by {post.by}</div>
          )}
          {renderMessageMeta(m, isLastOutgoing, false)}
        </div>
      );
    }

    const video = videos.find((v) => v.id === m.vid);
    const inviteBusy = Boolean(m.id && busyChatMsgIds?.has(m.id));
    return (
      <div
        key={msgKey}
        className={`max-w-[86%] w-fit border border-teal-500/60 bg-teal-50 rounded-2xl p-3.5 ${
          m.me ? 'ml-auto' : ''
        }`}
      >
        <div className="text-xs font-medium text-teal-800">Study session</div>
        <div className="font-bold text-sm text-slate-900 mt-0.5">
          {video?.title || 'Procedure study'}
        </div>
        <div className="text-xs text-slate-700 mt-0.5">{m.when}</div>
        {m.note && <div className="text-xs text-slate-600 mt-1">{m.note}</div>}
        <div
          className={`text-xs font-bold mt-2 ${
            m.status === 'accepted' ? 'text-emerald-700' : 'text-slate-600'
          }`}
        >
          {m.status === 'accepted'
            ? 'Accepted'
            : m.me
            ? `Waiting for ${friend.name.split(' ')[0]}`
            : 'Invitation for you'}
        </div>
        {!m.me && m.status === 'pending' && m.id && onAcceptInvite && (
          <div className="mt-2">
            <button
              type="button"
              disabled={inviteBusy}
              onClick={() => onAcceptInvite(friend.name, m.id!)}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[34px]"
            >
              {inviteBusy ? 'Accepting…' : 'Accept invite'}
            </button>
          </div>
        )}
        {m.me && m.status === 'pending' && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => onSendReminder(friend.name, idx)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 py-1"
            >
              Send a reminder
            </button>
            {!friend.online && (
              <div className="text-[11px] text-slate-500">
                They are offline. They will see this as a notification if
                notifications are on.
              </div>
            )}
          </div>
        )}
        {renderMessageMeta(m, isLastOutgoing, false)}
      </div>
    );
  };

  const renderChatPanel = (friend: Friend, isMobileOverlay: boolean) => (
    <div
      className={
        isMobileOverlay
          ? 'fixed inset-0 z-30 bg-slate-50 flex flex-col'
          : 'bg-white border border-slate-200 rounded-2xl flex flex-col h-[560px] overflow-hidden'
      }
    >
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onSelectChat(null)}
          className={`${
            isMobileOverlay ? 'inline-flex' : 'lg:hidden inline-flex'
          } items-center gap-1 text-sm font-semibold text-teal-600 min-h-[40px]`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenProfile(friend.name)}
          className="min-w-0 flex-1 lg:flex-initial text-left group"
        >
          <div className="font-display font-bold text-sm text-slate-900 truncate group-hover:text-teal-700 group-hover:underline">
            {friend.name}
          </div>
          <div
            className={`text-xs ${
              friend.online ? 'text-emerald-600 font-medium' : 'text-slate-500'
            }`}
          >
            {friend.online
              ? 'Online'
              : friend.lastSeen
              ? `Last seen ${friend.lastSeen}`
              : friend.role}
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenStudyInvite}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-2 rounded-xl min-h-[40px] shrink-0 transition-colors"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>Study invite</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/70">
        {chatError && (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 flex items-center justify-between gap-2">
            <span>{chatError}</span>
            {onRetryChat && (
              <button
                type="button"
                onClick={() => onRetryChat(friend.name)}
                className="font-semibold text-teal-700 hover:underline shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {chatLoading && activeMessages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Loading messages…
          </p>
        ) : activeMessages.length > 0 ? (
          activeMessages.map((m, i) =>
            renderMessage(m, i, friend, i === lastOutgoingIdx),
          )
        ) : !chatError ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Say hello, or invite them to study together.
          </p>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="bg-white border-t border-slate-200 p-3 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={draftMsg}
          onChange={(e) => setDraftMsg(e.target.value)}
          disabled={chatSending}
          placeholder="Message"
          className="flex-1 border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={chatSending || !draftMsg.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-sm min-h-[44px] transition-colors"
        >
          <Send className="w-4 h-4" />
          <span>{chatSending ? 'Sending…' : 'Send'}</span>
        </button>
      </form>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left column: Add friend + Friends list */}
      <div className="lg:col-span-5 space-y-5">
        {isAdministrativeAccount ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Account privacy active
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Administrative accounts are private across Diadikasia and do not
              appear in learner directories or send and receive friend requests.
            </p>
          </div>
        ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <label
            htmlFor="friend-search"
            className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
          >
            Add a friend
          </label>
          <input
            id="friend-search"
            type="text"
            value={friendQuery}
            onChange={(e) => setFriendQuery(e.target.value)}
            placeholder="Search by name"
            className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />

          {q && (
            <div className="mt-3 space-y-2">
              {discoverLoading ? (
                <p className="text-xs text-slate-500">Searching people…</p>
              ) : discoverError ? (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-2.5 text-xs text-red-800 flex items-center justify-between gap-2">
                  <span>{discoverError}</span>
                  {onRetryDiscover && (
                    <button
                      type="button"
                      onClick={onRetryDiscover}
                      className="font-semibold text-teal-700 hover:underline shrink-0"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((person) => {
                  const outgoingReq = outgoingRequests.find((r) =>
                    person.id ? r.userId === person.id : r.name === person.name,
                  );
                  const incomingReq = incomingRequests.find((r) =>
                    person.id ? r.userId === person.id : r.name === person.name,
                  );
                  const isSent =
                    Boolean(outgoingReq) || sentRequests.includes(person.name);
                  const isBusy = Boolean(
                    (person.id && busyIds?.has(`add:${person.id}`)) ||
                      (outgoingReq && busyIds?.has(`req:${outgoingReq.id}`)) ||
                      (incomingReq && busyIds?.has(`req:${incomingReq.id}`)),
                  );

                  return (
                    <div
                      key={person.id || person.name}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenProfile(person.name)}
                        className="min-w-0 text-left group"
                      >
                        <div className="font-semibold text-sm text-slate-900 truncate group-hover:text-teal-700 group-hover:underline">
                          {person.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {person.role}
                        </div>
                      </button>

                      {incomingReq && onAcceptRequest && onDeclineRequest ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onAcceptRequest(incomingReq.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[34px]"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onDeclineRequest(incomingReq.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-xs font-semibold min-h-[34px]"
                          >
                            Decline
                          </button>
                        </div>
                      ) : isSent ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium text-slate-500">
                            Requested
                          </span>
                          {outgoingReq && onCancelRequest && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onCancelRequest(outgoingReq.id)}
                              className="text-xs font-semibold text-slate-600 hover:text-red-700 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onAddFriend(person.name, person)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[36px] shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isBusy ? 'Sending…' : 'Add friend'}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500">
                  No one found. Invite them with a link below.
                </p>
              )}
            </div>
          )}

          {outgoingRequests.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sent requests ({outgoingRequests.length})
              </div>
              {outgoingRequests.map((req) => {
                const isBusy = Boolean(busyIds?.has(`req:${req.id}`));
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProfile(req.name)}
                      className="min-w-0 text-left group"
                    >
                      <div className="font-semibold text-xs text-slate-900 truncate group-hover:text-teal-700 group-hover:underline">
                        {req.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {req.role}
                      </div>
                    </button>
                    {onCancelRequest && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onCancelRequest(req.id)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-xs font-semibold text-slate-700 shrink-0"
                      >
                        {isBusy ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onCopyInviteLink}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 min-h-[44px] transition-colors"
          >
            <Link2 className="w-4 h-4 text-slate-500" />
            <span>Invite someone who isn’t on Diadikasia</span>
          </button>
        </div>
        )}

        {incomingRequests.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Friend requests ({incomingRequests.length})
            </h2>
            <div className="space-y-2">
              {incomingRequests.map((req) => {
                const isBusy = Boolean(busyIds?.has(`req:${req.id}`));
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProfile(req.name)}
                      className="min-w-0 text-left group"
                    >
                      <div className="font-semibold text-sm text-slate-900 truncate group-hover:text-teal-700 group-hover:underline">
                        {req.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {req.role}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onAcceptRequest && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onAcceptRequest(req.id)}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[36px]"
                        >
                          Accept
                        </button>
                      )}
                      {onDeclineRequest && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onDeclineRequest(req.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-semibold min-h-[36px]"
                        >
                          Decline
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Friends ({friends.length})
          </h2>
          {loading ? (
            <div className="space-y-2.5">
              {[0, 1].map((idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white animate-pulse"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 bg-slate-200 rounded" />
                    <div className="h-3 w-24 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-white border border-red-200 rounded-2xl p-4">
              <div className="font-semibold text-sm text-slate-900">
                Unable to load friends
              </div>
              <p className="text-xs text-slate-600 mt-1">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs min-h-[38px]"
                >
                  Retry
                </button>
              )}
            </div>
          ) : friends.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-600">
              No confirmed friends yet. Search by name above or share an invite
              link to connect.
            </div>
          ) : (
            <div className="space-y-2.5">
              {friends.map((friend) => {
                const list = chats[friend.name] || [];
                const lastMsg = list[list.length - 1];
                const unread = unreadCounts[friend.name] || 0;
                const isSelected = activeChat === friend.name;

                const preview = !lastMsg
                  ? 'No messages yet'
                  : lastMsg.type === 'invite'
                  ? 'Study invite'
                  : lastMsg.type === 'post'
                  ? 'Shared a reel'
                  : lastMsg.type === 'remind'
                  ? 'Reminder'
                  : lastMsg.text;

                const lastTime = formatMessageTime(lastMsg?.createdAt);

                return (
                  <button
                    key={friend.id || friend.name}
                    type="button"
                    onClick={() => onSelectChat(friend.name)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-colors ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="relative w-11 h-11 rounded-full bg-teal-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                      {getInitials(friend.name)}
                      {(friend.online || friend.lastSeen) && (
                        <span
                          title={friend.online ? 'Online' : 'Offline'}
                          className={`absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-white ${
                            friend.online ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {friend.name}
                        </div>
                        {lastTime && (
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            {lastTime}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs ${
                          friend.online ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        {friend.online
                          ? 'Online'
                          : friend.lastSeen
                          ? `Last seen ${friend.lastSeen}`
                          : friend.role}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {preview}
                      </div>
                    </div>
                    {unread > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right column on Desktop: Inline Chat */}
      <div className="hidden lg:block lg:col-span-7">
        {selectedFriend ? (
          renderChatPanel(selectedFriend, false)
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center h-[560px] flex flex-col items-center justify-center">
            <div className="font-display font-bold text-base text-slate-900">
              Select a friend to message or schedule a study session
            </div>
            <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
              You can send procedure study invites, reminders, and share
              community reels directly with friends.
            </p>
          </div>
        )}
      </div>

      {/* Mobile full-screen chat overlay */}
      {selectedFriend && (
        <div className="lg:hidden">{renderChatPanel(selectedFriend, true)}</div>
      )}
    </div>
  );
};
