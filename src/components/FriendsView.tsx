import React, { useState } from 'react';
import { ArrowLeft, CalendarPlus, Link2, Send, UserPlus } from 'lucide-react';
import type {
  ChatMessage,
  Friend,
  PersonCandidate,
  ProcedureVideo,
  ReelPost,
} from '../types';
import { getInitials } from '../utils/format';

interface FriendsViewProps {
  friends: Friend[];
  discoverPeople: PersonCandidate[];
  sentRequests: string[];
  chats: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  videos: ProcedureVideo[];
  posts: ReelPost[];
  activeChat: string | null;
  onSelectChat: (friendName: string | null) => void;
  onAddFriend: (name: string) => void;
  onCopyInviteLink: () => void;
  onSendMessage: (friendName: string, text: string) => void;
  onOpenStudyInvite: () => void;
  onSendReminder: (friendName: string, messageIndex: number) => void;
  onOpenProfile: (name: string) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  discoverPeople,
  sentRequests,
  chats,
  unreadCounts,
  videos,
  posts,
  activeChat,
  onSelectChat,
  onAddFriend,
  onCopyInviteLink,
  onSendMessage,
  onOpenStudyInvite,
  onSendReminder,
  onOpenProfile,
}) => {
  const [friendQuery, setFriendQuery] = useState('');
  const [draftMsg, setDraftMsg] = useState('');

  const q = friendQuery.trim().toLowerCase();
  const searchResults = q
    ? discoverPeople.filter(
        (person) =>
          person.name.toLowerCase().includes(q) &&
          !friends.some((f) => f.name === person.name),
      )
    : [];

  const selectedFriend = activeChat
    ? friends.find((f) => f.name === activeChat)
    : undefined;
  const activeMessages = activeChat ? chats[activeChat] || [] : [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !draftMsg.trim()) return;
    onSendMessage(activeChat, draftMsg.trim());
    setDraftMsg('');
  };

  const renderMessage = (m: ChatMessage, idx: number, friend: Friend) => {
    if (m.type === 'text') {
      return (
        <div
          key={idx}
          className={`max-w-[78%] w-fit px-3.5 py-2.5 rounded-2xl text-sm ${
            m.me
              ? 'ml-auto bg-teal-600 text-white rounded-br-xs'
              : 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs'
          }`}
        >
          {m.text}
        </div>
      );
    }
    if (m.type === 'remind') {
      const video = videos.find((v) => v.id === m.vid);
      return (
        <div
          key={idx}
          className="text-xs text-slate-500 text-center my-2 px-3"
        >
          Reminder sent for “{video?.title}”.
          {!friend.online && ' They will get it as a notification.'}
        </div>
      );
    }
    if (m.type === 'post') {
      const post = posts.find((p) => p.id === m.pid);
      return (
        <div
          key={idx}
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
        </div>
      );
    }

    const video = videos.find((v) => v.id === m.vid);
    return (
      <div
        key={idx}
        className={`max-w-[86%] w-fit border border-teal-500/60 bg-teal-50 rounded-2xl p-3.5 ${
          m.me ? 'ml-auto' : ''
        }`}
      >
        <div className="text-xs font-medium text-teal-800">Study session</div>
        <div className="font-bold text-sm text-slate-900 mt-0.5">
          {video?.title}
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
            : `Waiting for ${friend.name.split(' ')[0]}`}
        </div>
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
            {friend.online ? 'Online' : `Last seen ${friend.lastSeen}`}
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
        {activeMessages.length > 0 ? (
          activeMessages.map((m, i) => renderMessage(m, i, friend))
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">
            Say hello, or invite them to study together.
          </p>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="bg-white border-t border-slate-200 p-3 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={draftMsg}
          onChange={(e) => setDraftMsg(e.target.value)}
          placeholder="Message"
          className="flex-1 border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm min-h-[44px] transition-colors"
        >
          <Send className="w-4 h-4" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left column: Add friend + Friends list */}
      <div className="lg:col-span-5 space-y-5">
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
              {searchResults.length > 0 ? (
                searchResults.map((person) => {
                  const isSent = sentRequests.includes(person.name);
                  return (
                    <div
                      key={person.name}
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
                        <div className="text-xs text-slate-500">
                          {person.role}
                        </div>
                      </button>
                      {isSent ? (
                        <span className="text-xs font-medium text-slate-500">
                          Requested
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddFriend(person.name)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[36px] shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add friend</span>
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

          <button
            type="button"
            onClick={onCopyInviteLink}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 min-h-[44px] transition-colors"
          >
            <Link2 className="w-4 h-4 text-slate-500" />
            <span>Invite someone who isn’t on Diadikasia</span>
          </button>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Friends ({friends.length})
          </h2>
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

              return (
                <button
                  key={friend.name}
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
                    <span
                      title={friend.online ? 'Online' : 'Offline'}
                      className={`absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-white ${
                        friend.online ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {friend.name}
                    </div>
                    <div
                      className={`text-xs ${
                        friend.online ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {friend.online
                        ? 'Online'
                        : `Last seen ${friend.lastSeen}`}
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
