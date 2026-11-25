import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type {
  Friend,
  FriendRequestItem,
  PersonCandidate,
  UserRole,
} from '../types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: string | undefined | null): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

interface PublicDirectoryEntry {
  id: string;
  name: string;
  role: UserRole;
  qualifications: string | null;
}

interface FriendshipRow {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export function formatUserRoleLabel(role: UserRole | string | undefined): string {
  if (role === 'instructor') return 'Clinical instructor';
  if (role === 'admin') return 'Clinical director';
  if (role === 'sub_admin') return 'Clinical reviewer & staff';
  return 'Learner';
}

async function fetchSafeDirectoryMap(): Promise<{
  byId: Map<string, PublicDirectoryEntry>;
  entries: PublicDirectoryEntry[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { byId: new Map(), entries: [], error: supabaseConfigError };
  }

  const { data, error } = await supabase.rpc('get_public_directory');
  if (error) {
    return { byId: new Map(), entries: [], error: error.message };
  }

  const entries = ((data || []) as PublicDirectoryEntry[]).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    qualifications: row.qualifications,
  }));

  return {
    byId: new Map(entries.map((e) => [e.id, e])),
    entries,
  };
}

export async function fetchDiscoverPeopleFromSupabase(
  currentUserId: string,
): Promise<{
  people: PersonCandidate[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { people: [] };
  }
  if (!isValidUuid(currentUserId)) {
    return { people: [], error: 'Sign in to discover people on Diadikasia.' };
  }

  const { entries, error } = await fetchSafeDirectoryMap();
  if (error) {
    return { people: [], error };
  }

  const people: PersonCandidate[] = entries
    .filter((entry) => entry.id !== currentUserId)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      role: formatUserRoleLabel(entry.role),
      qualifications: entry.qualifications || undefined,
    }));

  return { people };
}

export async function fetchFriendshipsFromSupabase(
  currentUserId: string,
): Promise<{
  friends: Friend[];
  incomingRequests: FriendRequestItem[];
  outgoingRequests: FriendRequestItem[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }
  if (!isValidUuid(currentUserId)) {
    return {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      error: 'Please sign in to load your friends.',
    };
  }

  const [friendshipsRes, directoryRes] = await Promise.all([
    supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false }),
    fetchSafeDirectoryMap(),
  ]);

  if (friendshipsRes.error) {
    return {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      error: friendshipsRes.error.message,
    };
  }

  if (directoryRes.error) {
    return {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      error: directoryRes.error,
    };
  }

  const rows = (friendshipsRes.data || []) as FriendshipRow[];
  const byId = directoryRes.byId;

  const friends: Friend[] = [];
  const incomingRequests: FriendRequestItem[] = [];
  const outgoingRequests: FriendRequestItem[] = [];

  for (const row of rows) {
    const isRequester = row.requester_id === currentUserId;
    const otherUserId = isRequester ? row.addressee_id : row.requester_id;
    const otherProfile = byId.get(otherUserId);
    const otherName = otherProfile?.name || 'Diadikasia Member';
    const otherRole = formatUserRoleLabel(otherProfile?.role);
    const otherQuals = otherProfile?.qualifications || undefined;

    if (row.status === 'accepted') {
      friends.push({
        id: otherUserId,
        friendshipId: row.id,
        name: otherName,
        online: false,
        role: otherRole,
        qualifications: otherQuals,
      });
    } else if (row.status === 'pending') {
      if (isRequester) {
        outgoingRequests.push({
          id: row.id,
          requesterId: row.requester_id,
          addresseeId: row.addressee_id,
          userId: otherUserId,
          name: otherName,
          role: otherRole,
          qualifications: otherQuals,
          direction: 'outgoing',
          status: row.status,
          createdAt: row.created_at,
        });
      } else {
        incomingRequests.push({
          id: row.id,
          requesterId: row.requester_id,
          addresseeId: row.addressee_id,
          userId: otherUserId,
          name: otherName,
          role: otherRole,
          qualifications: otherQuals,
          direction: 'incoming',
          status: row.status,
          createdAt: row.created_at,
        });
      }
    }
  }

  return { friends, incomingRequests, outgoingRequests };
}

export async function sendFriendRequestInSupabase(
  requesterId: string,
  addresseeId: string,
): Promise<{
  request?: FriendRequestItem;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(requesterId) || !isValidUuid(addresseeId)) {
    return { error: 'Invalid user selection for friend request.' };
  }
  if (requesterId === addresseeId) {
    return { error: 'You cannot send a friend request to yourself.' };
  }

  const { data: existingRows, error: checkErr } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(
      `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`,
    )
    .limit(1);

  if (checkErr) {
    return { error: checkErr.message };
  }

  const existing = (existingRows?.[0] as FriendshipRow | undefined) || null;
  if (existing) {
    if (existing.status === 'accepted') {
      return { error: 'You are already friends with this user.' };
    }
    if (existing.status === 'pending') {
      if (existing.requester_id === requesterId) {
        return { error: 'Friend request already sent.' };
      }
      return {
        error:
          'This person already sent you a friend request. Check your incoming requests to accept or decline.',
      };
    }
    if (existing.status === 'declined') {
      const { error: cleanErr } = await supabase
        .from('friendships')
        .delete()
        .eq('id', existing.id);
      if (cleanErr) {
        return { error: cleanErr.message };
      }
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('friendships')
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending',
    })
    .select('id, requester_id, addressee_id, status, created_at')
    .single();

  if (insertErr || !inserted) {
    const code = (insertErr as { code?: string } | null)?.code;
    if (code === '23505') {
      return {
        error: 'A friend request or connection already exists with this user.',
      };
    }
    return { error: insertErr?.message || 'Unable to send friend request.' };
  }

  const { byId } = await fetchSafeDirectoryMap();
  const row = inserted as FriendshipRow;
  const targetProfile = byId.get(addresseeId);

  return {
    request: {
      id: row.id,
      requesterId: row.requester_id,
      addresseeId: row.addressee_id,
      userId: addresseeId,
      name: targetProfile?.name || 'Diadikasia Member',
      role: formatUserRoleLabel(targetProfile?.role),
      qualifications: targetProfile?.qualifications || undefined,
      direction: 'outgoing',
      status: row.status,
      createdAt: row.created_at,
    },
  };
}

export async function respondToFriendRequestInSupabase(
  friendshipId: number,
  currentUserId: string,
  accept: boolean,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(currentUserId)) {
    return { error: 'Please sign in to respond to friend requests.' };
  }

  const nextStatus = accept ? 'accepted' : 'declined';
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: nextStatus })
    .eq('id', friendshipId)
    .eq('addressee_id', currentUserId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return {
      error:
        'This friend request is no longer pending or you are not authorized to respond.',
    };
  }
  return {};
}

export async function cancelFriendRequestInSupabase(
  friendshipId: number,
  currentUserId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(currentUserId)) {
    return { error: 'Please sign in to cancel friend requests.' };
  }

  const { data, error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .eq('requester_id', currentUserId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return {
      error: 'Unable to cancel this pending friend request.',
    };
  }
  return {};
}

export function subscribeToFriendshipsUpdates(
  currentUserId: string,
  onChanged: () => void,
): () => void {
  if (!isSupabaseConfigured || !supabase || !isValidUuid(currentUserId)) {
    return () => {};
  }

  const client = supabase;
  const channel = client.channel(`friendships-live-${currentUserId}`);

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'friendships' },
    (payload) => {
      const nextRow = payload.new as Partial<FriendshipRow> | undefined;
      const oldRow = payload.old as Partial<FriendshipRow> | undefined;
      const involvesUser =
        nextRow?.requester_id === currentUserId ||
        nextRow?.addressee_id === currentUserId ||
        oldRow?.requester_id === currentUserId ||
        oldRow?.addressee_id === currentUserId ||
        (payload.eventType === 'DELETE' && !oldRow?.requester_id);

      if (involvesUser) {
        onChanged();
      }
    },
  );

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
