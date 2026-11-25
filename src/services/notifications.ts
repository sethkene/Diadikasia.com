import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type { NotificationItem } from '../types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: string | undefined | null): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

export interface NotificationRow {
  id: number;
  recipient_id: string;
  actor_id: string | null;
  actor_name: string;
  type: 'invite' | 'req' | 'remind';
  procedure_id: number | null;
  scheduled_for: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'done' | 'seen';
  read_at: string | null;
  chat_message_id: number | null;
  created_at: string;
}

const NOTIF_SELECT_COLS =
  'id, recipient_id, actor_id, actor_name, type, procedure_id, scheduled_for, status, read_at, chat_message_id, created_at';

export function mapNotificationRow(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id || undefined,
    from: row.actor_name,
    type: row.type,
    vid: row.procedure_id ?? undefined,
    when: row.scheduled_for || undefined,
    status: row.status,
    readAt: row.read_at,
    chatMessageId: row.chat_message_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchNotificationsFromSupabase(
  currentUserId: string,
): Promise<{
  notifications: NotificationItem[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { notifications: [] };
  }
  if (!isValidUuid(currentUserId)) {
    return {
      notifications: [],
      error: 'Please sign in to load your notifications.',
    };
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIF_SELECT_COLS)
    .eq('recipient_id', currentUserId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    return { notifications: [], error: error.message };
  }

  return {
    notifications: ((data || []) as NotificationRow[]).map(mapNotificationRow),
  };
}

export async function updateNotificationStatusInSupabase(
  notificationId: number,
  currentUserId: string,
  status: 'accepted' | 'declined' | 'done' | 'seen',
): Promise<{ readAt?: string | null; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(currentUserId)) {
    return { error: 'Please sign in to update notifications.' };
  }

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { status };
  if (
    status === 'accepted' ||
    status === 'declined' ||
    status === 'done' ||
    status === 'seen'
  ) {
    updatePayload.read_at = nowIso;
  }

  const { data, error } = await supabase
    .from('notifications')
    .update(updatePayload)
    .eq('id', notificationId)
    .eq('recipient_id', currentUserId)
    .select('id, read_at, status');

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return {
      error: 'Notification could not be updated or authorization denied.',
    };
  }

  const row = data[0] as { read_at: string | null };
  return { readAt: row.read_at };
}

export async function markAllNotificationsAsReadInSupabase(
  currentUserId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {};
  }
  if (!isValidUuid(currentUserId)) {
    return { error: 'Please sign in.' };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: nowIso })
    .eq('recipient_id', currentUserId)
    .is('read_at', null);

  return error ? { error: error.message } : {};
}

export function subscribeToNotifications(
  currentUserId: string,
  callbacks: {
    onInsert: (row: NotificationRow) => void;
    onUpdate: (row: NotificationRow) => void;
    onDelete: (id: number) => void;
  },
): () => void {
  if (!isSupabaseConfigured || !supabase || !isValidUuid(currentUserId)) {
    return () => {};
  }

  const client = supabase;
  const channel = client.channel(`notifications-live-${currentUserId}`);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications' },
    (payload) => {
      const row = payload.new as NotificationRow | undefined;
      if (row && row.recipient_id === currentUserId) {
        callbacks.onInsert(row);
      }
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'notifications' },
    (payload) => {
      const row = payload.new as NotificationRow | undefined;
      if (row && row.recipient_id === currentUserId) {
        callbacks.onUpdate(row);
      }
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'notifications' },
    (payload) => {
      const oldRow = payload.old as { id?: number } | undefined;
      if (typeof oldRow?.id === 'number') {
        callbacks.onDelete(oldRow.id);
      }
    },
  );

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
