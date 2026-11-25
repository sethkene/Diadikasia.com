import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type { ChatMessage, Friend } from '../types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: string | undefined | null): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

export interface ChatMessageRow {
  id: number;
  sender_id: string;
  recipient_id: string;
  msg_type: 'text' | 'invite' | 'remind' | 'post';
  body: string | null;
  procedure_id: number | null;
  reel_id: number | null;
  scheduled_for: string | null;
  invite_status: 'pending' | 'accepted' | null;
  read_at: string | null;
  created_at: string;
}

const CHAT_SELECT_COLS =
  'id, sender_id, recipient_id, msg_type, body, procedure_id, reel_id, scheduled_for, invite_status, read_at, created_at';

export function mapChatRowToMessage(
  row: ChatMessageRow,
  currentUserId: string,
): ChatMessage | null {
  const base = {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    me: row.sender_id === currentUserId,
  };

  if (row.msg_type === 'text') {
    return {
      ...base,
      type: 'text',
      text: row.body ?? '',
    };
  }

  if (row.msg_type === 'remind') {
    if (typeof row.procedure_id !== 'number') return null;
    return {
      ...base,
      type: 'remind',
      vid: row.procedure_id,
    };
  }

  if (row.msg_type === 'post') {
    if (typeof row.reel_id !== 'number') return null;
    return {
      ...base,
      type: 'post',
      pid: row.reel_id,
    };
  }

  if (row.msg_type === 'invite') {
    if (typeof row.procedure_id !== 'number') return null;
    return {
      ...base,
      type: 'invite',
      vid: row.procedure_id,
      when: row.scheduled_for || '',
      note: row.body || '',
      status: row.invite_status === 'accepted' ? 'accepted' : 'pending',
    };
  }

  return null;
}

export async function fetchAllChatsFromSupabase(
  currentUserId: string,
  friends: Friend[],
): Promise<{
  chats: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { chats: {}, unreadCounts: {} };
  }
  if (!isValidUuid(currentUserId)) {
    return {
      chats: {},
      unreadCounts: {},
      error: 'Please sign in to load your messages.',
    };
  }

  const friendById = new Map<string, Friend>();
  for (const f of friends) {
    if (f.id) friendById.set(f.id, f);
  }

  if (friendById.size === 0) {
    return { chats: {}, unreadCounts: {} };
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select(CHAT_SELECT_COLS)
    .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    return { chats: {}, unreadCounts: {}, error: error.message };
  }

  const chats: Record<string, ChatMessage[]> = {};
  const unreadCounts: Record<string, number> = {};

  for (const row of (data || []) as ChatMessageRow[]) {
    const otherUserId =
      row.sender_id === currentUserId ? row.recipient_id : row.sender_id;
    const friend = friendById.get(otherUserId);
    if (!friend) continue;

    const mapped = mapChatRowToMessage(row, currentUserId);
    if (!mapped) continue;

    if (!chats[friend.name]) {
      chats[friend.name] = [];
    }
    chats[friend.name].push(mapped);

    if (row.recipient_id === currentUserId && !row.read_at) {
      unreadCounts[friend.name] = (unreadCounts[friend.name] || 0) + 1;
    }
  }

  return { chats, unreadCounts };
}

export async function fetchConversationMessagesFromSupabase(
  currentUserId: string,
  friendUserId: string,
): Promise<{
  messages: ChatMessage[];
  unreadCount: number;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { messages: [], unreadCount: 0 };
  }
  if (!isValidUuid(currentUserId) || !isValidUuid(friendUserId)) {
    return {
      messages: [],
      unreadCount: 0,
      error: 'Invalid conversation participant.',
    };
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select(CHAT_SELECT_COLS)
    .or(
      `and(sender_id.eq.${currentUserId},recipient_id.eq.${friendUserId}),and(sender_id.eq.${friendUserId},recipient_id.eq.${currentUserId})`,
    )
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    return { messages: [], unreadCount: 0, error: error.message };
  }

  const messages: ChatMessage[] = [];
  let unreadCount = 0;

  for (const row of (data || []) as ChatMessageRow[]) {
    const mapped = mapChatRowToMessage(row, currentUserId);
    if (!mapped) continue;
    messages.push(mapped);
    if (row.recipient_id === currentUserId && !row.read_at) {
      unreadCount += 1;
    }
  }

  return { messages, unreadCount };
}

export interface SendChatMessageInput {
  senderId: string;
  recipientId: string;
  msgType: 'text' | 'invite' | 'remind' | 'post';
  body?: string;
  procedureId?: number;
  reelId?: number;
  scheduledFor?: string;
}

export async function sendChatMessageInSupabase(
  input: SendChatMessageInput,
): Promise<{
  message?: ChatMessage;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(input.senderId) || !isValidUuid(input.recipientId)) {
    return { error: 'Please sign in and select a confirmed friend to message.' };
  }
  if (input.senderId === input.recipientId) {
    return { error: 'You cannot send messages to yourself.' };
  }

  let cleanBody: string | null = null;
  if (input.msgType === 'text') {
    const trimmed = (input.body || '').trim();
    if (!trimmed) {
      return { error: 'Enter a message before sending.' };
    }
    cleanBody = trimmed;
  } else if (input.msgType === 'invite') {
    const trimmedNote = (input.body || '').trim();
    cleanBody = trimmedNote || null;
  }

  const payload = {
    sender_id: input.senderId,
    recipient_id: input.recipientId,
    msg_type: input.msgType,
    body: cleanBody,
    procedure_id:
      input.msgType === 'invite' || input.msgType === 'remind'
        ? input.procedureId ?? null
        : null,
    reel_id: input.msgType === 'post' ? input.reelId ?? null : null,
    scheduled_for:
      input.msgType === 'invite' ? input.scheduledFor || null : null,
    invite_status: input.msgType === 'invite' ? ('pending' as const) : null,
  };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select(CHAT_SELECT_COLS)
    .single();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;
    if (code === '42501') {
      return {
        error: 'You can only send messages to confirmed friends.',
      };
    }
    return { error: error?.message || 'Unable to send message.' };
  }

  const mapped = mapChatRowToMessage(data as ChatMessageRow, input.senderId);
  if (!mapped) {
    return { error: 'Sent message could not be parsed.' };
  }

  return { message: mapped };
}

export async function markConversationAsReadInSupabase(
  currentUserId: string,
  friendUserId: string,
): Promise<{
  updatedIds: number[];
  readAt?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { updatedIds: [] };
  }
  if (!isValidUuid(currentUserId) || !isValidUuid(friendUserId)) {
    return { updatedIds: [], error: 'Invalid conversation participant.' };
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', friendUserId)
    .eq('recipient_id', currentUserId)
    .is('read_at', null)
    .select('id, read_at');

  if (error) {
    return { updatedIds: [], error: error.message };
  }

  const rows = (data || []) as Array<{ id: number; read_at: string | null }>;
  return {
    updatedIds: rows.map((r) => r.id),
    readAt: rows[0]?.read_at || undefined,
  };
}

export async function acceptStudyInviteInSupabase(
  messageId: number,
  currentUserId: string,
): Promise<{
  readAt?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(currentUserId)) {
    return { error: 'Please sign in to respond to study invites.' };
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .update({
      invite_status: 'accepted',
      read_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('recipient_id', currentUserId)
    .eq('msg_type', 'invite')
    .eq('invite_status', 'pending')
    .select('id, read_at');

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: 'This study invitation could not be accepted.' };
  }

  const first = data[0] as { id: number; read_at: string | null };
  return { readAt: first.read_at || undefined };
}

export function subscribeToChatMessages(
  currentUserId: string,
  callbacks: {
    onInsert: (row: ChatMessageRow) => void;
    onUpdate: (row: ChatMessageRow) => void;
  },
): () => void {
  if (!isSupabaseConfigured || !supabase || !isValidUuid(currentUserId)) {
    return () => {};
  }

  const client = supabase;
  const channel = client.channel(`chat-live-${currentUserId}`);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    (payload) => {
      const row = payload.new as ChatMessageRow | undefined;
      if (
        row &&
        (row.sender_id === currentUserId || row.recipient_id === currentUserId)
      ) {
        callbacks.onInsert(row);
      }
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
    (payload) => {
      const row = payload.new as ChatMessageRow | undefined;
      if (
        row &&
        (row.sender_id === currentUserId || row.recipient_id === currentUserId)
      ) {
        callbacks.onUpdate(row);
      }
    },
  );

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
