import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type {
  CommentItem,
  Discipline,
  NewPostForm,
  PracticeMilestone,
  ProcedureVideo,
  ReelPost,
  ReelSignals,
  UserProfile,
} from '../types';
import { INITIAL_REEL_SIGNALS } from '../data/seed';

export const REEL_MEDIA_BUCKET = 'reel-media';
export const MAX_REEL_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB (matches bucket limit)

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_VIDEO_EXTS = new Set(['mp4', 'mov', 'webm']);

export function validateReelMediaFile(
  file: File,
  kind: NewPostForm['kind'],
): string | null {
  if (file.size <= 0) {
    return 'Selected file is empty.';
  }
  if (file.size > MAX_REEL_MEDIA_BYTES) {
    return 'Media file must be 20 MB or smaller.';
  }

  const baseMime = file.type.split(';')[0].trim().toLowerCase();
  const ext = file.name.split('.').pop()?.trim().toLowerCase() || '';

  if (kind === 'photo') {
    const validMime = baseMime
      ? ALLOWED_IMAGE_MIMES.has(baseMime)
      : ALLOWED_IMAGE_EXTS.has(ext);
    if (!validMime) {
      return 'Photos must be JPG, PNG, or WebP.';
    }
    return null;
  }

  const validMime = baseMime
    ? ALLOWED_VIDEO_MIMES.has(baseMime)
    : ALLOWED_VIDEO_EXTS.has(ext);
  if (!validMime) {
    return 'Videos must be MP4, MOV (QuickTime), or WebM.';
  }
  return null;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatCommentTime(iso: string | null | undefined): string {
  if (!iso) return 'now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'now';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export interface ReelRow {
  id: number;
  author_id: string | null;
  author_display: string;
  author_role: string;
  author_org: string | null;
  author_reg: string | null;
  author_bio: string | null;
  verified: boolean;
  kind: 'video' | 'photo';
  genre: string;
  discipline: Discipline | 'general';
  category: string | null;
  linked_procedure_id: number | null;
  caption: string;
  media_path: string | null;
  is_image: boolean;
  hue: number;
  views_count: number;
  likes_count: number;
  practice_clicks: number;
  is_removed: boolean;
  created_at: string;
}

export interface ReelCommentRow {
  id: number;
  reel_id: number;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

const REEL_SELECT_COLUMNS =
  'id, author_id, author_display, author_role, author_org, author_reg, author_bio, verified, kind, genre, discipline, category, linked_procedure_id, caption, media_path, is_image, hue, views_count, likes_count, practice_clicks, is_removed, created_at';

function resolveReelMediaUrl(mediaPath: string | null): string | undefined {
  if (!mediaPath) return undefined;
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
    return mediaPath;
  }
  if (!supabase) return undefined;
  const { data } = supabase.storage
    .from(REEL_MEDIA_BUCKET)
    .getPublicUrl(mediaPath);
  return data?.publicUrl || undefined;
}

export function mapReelRowToPost(
  row: ReelRow,
  comments: CommentItem[] = [],
): ReelPost {
  return {
    id: row.id,
    authorId: row.author_id || undefined,
    kind: row.kind,
    by: row.author_display,
    role: row.author_role,
    org: row.author_org || '',
    reg: row.author_reg || '',
    bio: row.author_bio || '',
    verified: Boolean(row.verified),
    genre: row.genre,
    discipline: row.discipline,
    category: row.category || undefined,
    vid: row.linked_procedure_id || undefined,
    caption: row.caption,
    hue: typeof row.hue === 'number' ? row.hue : 200,
    ago: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    views: row.views_count || 0,
    likes: row.likes_count || 0,
    practiceClicks: row.practice_clicks || 0,
    comments,
    url: resolveReelMediaUrl(row.media_path),
    mediaPath: row.media_path || undefined,
    isImage: Boolean(row.is_image),
    isRemoved: Boolean(row.is_removed),
  };
}

export function mapReelCommentRow(row: ReelCommentRow): CommentItem {
  return {
    id: row.id,
    authorId: row.author_id || undefined,
    name: row.author_name,
    text: row.body,
    ago: formatCommentTime(row.created_at),
  };
}

export async function fetchVisibleReelsPage(params?: {
  offset?: number;
  limit?: number;
}): Promise<{
  reels: ReelPost[];
  hasMore: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { reels: [], hasMore: false };
  }

  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 20;

  const { data, error } = await supabase
    .from('reels')
    .select(REEL_SELECT_COLUMNS)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { reels: [], hasMore: false, error: error.message };
  }

  const rows = (data || []) as ReelRow[];
  const reelIds = rows.map((r) => r.id);

  const commentsByReel: Record<number, CommentItem[]> = {};
  if (reelIds.length > 0) {
    const { data: commentsData } = await supabase
      .from('reel_comments')
      .select('id, reel_id, author_id, author_name, body, created_at')
      .in('reel_id', reelIds)
      .order('created_at', { ascending: true });

    for (const row of (commentsData || []) as ReelCommentRow[]) {
      if (!commentsByReel[row.reel_id]) {
        commentsByReel[row.reel_id] = [];
      }
      commentsByReel[row.reel_id].push(mapReelCommentRow(row));
    }
  }

  return {
    reels: rows.map((row) =>
      mapReelRowToPost(row, commentsByReel[row.id] || []),
    ),
    hasMore: rows.length === limit,
  };
}

export async function fetchVisibleReels(): Promise<{
  reels: ReelPost[];
  error?: string;
}> {
  const { reels, error } = await fetchVisibleReelsPage({ offset: 0, limit: 30 });
  return { reels, error };
}

export async function createReelInSupabase(params: {
  user: UserProfile;
  form: NewPostForm;
  file: File;
  linkedCategory?: string;
}): Promise<{ post?: ReelPost; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { user, form, file, linkedCategory } = params;
  if (!user.id) {
    return { error: 'Please sign in before posting a Reel.' };
  }

  const fileError = validateReelMediaFile(file, form.kind);
  if (fileError) {
    return { error: fileError };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;
  const contentType = file.type.split(';')[0].trim() || undefined;

  const { error: uploadErr } = await supabase.storage
    .from(REEL_MEDIA_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType,
    });

  if (uploadErr) {
    return { error: uploadErr.message };
  }

  const roleLabel =
    user.role === 'instructor'
      ? 'Clinical instructor'
      : user.role === 'admin'
      ? 'Supreme Admin'
      : user.role === 'sub_admin'
      ? 'Staff'
      : 'Learner';

  const isVerifiedAuthor =
    user.role === 'instructor' || user.role === 'admin';
  const kind: 'video' | 'photo' = form.kind === 'photo' ? 'photo' : 'video';
  const isImage = kind === 'photo' || file.type.startsWith('image/');

  const { data: inserted, error: insertErr } = await supabase
    .from('reels')
    .insert({
      author_id: user.id,
      author_display: user.name || 'Learner',
      author_role: roleLabel,
      author_org: '',
      author_reg: '',
      author_bio: '',
      verified: isVerifiedAuthor,
      kind,
      genre: form.genre,
      discipline: form.discipline,
      category: linkedCategory || null,
      linked_procedure_id:
        form.linkedVid !== '' ? Number(form.linkedVid) : null,
      caption: form.caption.trim(),
      media_path: storagePath,
      is_image: isImage,
      hue: 200,
      views_count: 0,
      likes_count: 0,
      practice_clicks: 0,
      is_removed: false,
    })
    .select(REEL_SELECT_COLUMNS)
    .single();

  if (insertErr || !inserted) {
    // Roll back uploaded media if database insert fails
    await supabase.storage.from(REEL_MEDIA_BUCKET).remove([storagePath]);
    return { error: insertErr?.message || 'Unable to publish Reel.' };
  }

  return {
    post: mapReelRowToPost(inserted as ReelRow, []),
  };
}

export async function updateReelInSupabase(params: {
  reelId: number;
  userId: string;
  caption: string;
  genre: string;
  discipline: Discipline | 'general';
  linkedProcedureId: number | null;
  category?: string;
}): Promise<{ post?: ReelPost; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase
    .from('reels')
    .update({
      caption: params.caption.trim(),
      genre: params.genre,
      discipline: params.discipline,
      linked_procedure_id: params.linkedProcedureId,
      category: params.category || null,
    })
    .eq('id', params.reelId)
    .eq('author_id', params.userId)
    .select(REEL_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    return {
      error:
        error?.message ||
        'Unable to update this Reel. Ensure you own it and database policies are up to date.',
    };
  }

  return { post: mapReelRowToPost(data as ReelRow, []) };
}

export async function deleteReelInSupabase(
  reelId: number,
  mediaPath?: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data: deletedRows, error } = await supabase
    .from('reels')
    .delete()
    .eq('id', reelId)
    .select('id, media_path');

  if (error) {
    return { error: error.message };
  }

  if (!deletedRows || deletedRows.length === 0) {
    return {
      error:
        'Unable to delete this Reel. Check your permissions or database deletion policy.',
    };
  }

  const pathToRemove =
    (deletedRows[0] as { media_path?: string | null })?.media_path || mediaPath;
  if (
    pathToRemove &&
    !pathToRemove.startsWith('http://') &&
    !pathToRemove.startsWith('https://')
  ) {
    await supabase.storage.from(REEL_MEDIA_BUCKET).remove([pathToRemove]);
  }

  return {};
}

export async function fetchMyReelLikes(userId: string): Promise<{
  likedIds: number[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { likedIds: [] };
  }

  const { data, error } = await supabase
    .from('reel_likes')
    .select('reel_id')
    .eq('user_id', userId);

  if (error) {
    return { likedIds: [], error: error.message };
  }

  return {
    likedIds: ((data || []) as Array<{ reel_id: number }>).map(
      (r) => r.reel_id,
    ),
  };
}

export async function setReelLikeInSupabase(
  userId: string,
  reelId: number,
  like: boolean,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  if (like) {
    const { error } = await supabase
      .from('reel_likes')
      .upsert(
        { user_id: userId, reel_id: reelId },
        { onConflict: 'user_id,reel_id', ignoreDuplicates: true },
      );
    return error ? { error: error.message } : {};
  }

  const { error } = await supabase
    .from('reel_likes')
    .delete()
    .eq('user_id', userId)
    .eq('reel_id', reelId);
  return error ? { error: error.message } : {};
}

export async function addReelCommentInSupabase(
  reelId: number,
  userId: string,
  authorName: string,
  body: string,
): Promise<{ comment?: CommentItem; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase
    .from('reel_comments')
    .insert({
      reel_id: reelId,
      author_id: userId,
      author_name: authorName,
      body,
    })
    .select('id, reel_id, author_id, author_name, body, created_at')
    .single();

  if (error || !data) {
    return { error: error?.message || 'Unable to post comment.' };
  }

  return { comment: mapReelCommentRow(data as ReelCommentRow) };
}

export async function deleteReelCommentInSupabase(
  commentId: number,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data: deleted, error } = await supabase
    .from('reel_comments')
    .delete()
    .eq('id', commentId)
    .select('id');

  if (error) {
    return { error: error.message };
  }
  if (!deleted || deleted.length === 0) {
    return {
      error: 'You do not have permission to delete this comment.',
    };
  }
  return {};
}

export async function incrementReelViewRpc(reelId: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc('increment_reel_view', { p_reel_id: reelId });
}

export async function incrementReelPracticeClickRpc(
  reelId: number,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc('increment_reel_practice_click', { p_reel_id: reelId });
}

export async function fetchMyReelSignals(userId: string): Promise<{
  signals: ReelSignals;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { signals: INITIAL_REEL_SIGNALS };
  }

  const { data, error } = await supabase
    .from('reel_signals')
    .select('signals')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { signals: INITIAL_REEL_SIGNALS, error: error.message };
  }

  const raw = (data as { signals?: Partial<ReelSignals> } | null)?.signals;
  if (!raw || typeof raw !== 'object') {
    return { signals: INITIAL_REEL_SIGNALS };
  }

  return {
    signals: {
      dwellMsByPost: raw.dwellMsByPost || {},
      fastSkipsByPost: raw.fastSkipsByPost || {},
      notInterestedPostIds: Array.isArray(raw.notInterestedPostIds)
        ? raw.notInterestedPostIds
        : [],
      notInterestedGenres: raw.notInterestedGenres || {},
      categoryAffinity: raw.categoryAffinity || {},
      disciplineAffinity: {
        nursing: raw.disciplineAffinity?.nursing || 0,
        surgical: raw.disciplineAffinity?.surgical || 0,
      },
      practiceConversions: Array.isArray(raw.practiceConversions)
        ? raw.practiceConversions
        : [],
    },
  };
}

export async function upsertMyReelSignals(
  userId: string,
  signals: ReelSignals,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return {};
  }

  const { error } = await supabase.from('reel_signals').upsert(
    {
      user_id: userId,
      signals,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  return error ? { error: error.message } : {};
}

export async function fetchPracticeMilestonesFromSupabase(
  directory: UserProfile[],
  procedures: ProcedureVideo[],
): Promise<{ milestones: PracticeMilestone[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { milestones: [] };
  }

  const { data, error } = await supabase
    .from('practice_milestones')
    .select('id, user_id, procedure_id, points, score_text, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return { milestones: [], error: error.message };
  }

  const nameById = new Map(
    directory.filter((u) => u.id).map((u) => [u.id as string, u.name]),
  );
  const procById = new Map(procedures.map((p) => [p.id, p]));

  const milestones: PracticeMilestone[] = (
    (data || []) as Array<{
      id: number;
      user_id: string;
      procedure_id: number;
      points: number;
      score_text: string;
      created_at: string;
    }>
  ).map((row) => {
    const proc = procById.get(row.procedure_id);
    const createdMs = new Date(row.created_at).getTime();
    return {
      id: row.id,
      userName: nameById.get(row.user_id) || 'Learner',
      procedureTitle: proc?.title || 'Clinical procedure',
      vid: row.procedure_id,
      category: proc?.category || 'Clinical skills',
      points: row.points,
      scoreText: row.score_text,
      createdAt: Number.isNaN(createdMs) ? Date.now() : createdMs,
    };
  });

  return { milestones };
}

export async function createPracticeMilestoneInSupabase(params: {
  userId: string;
  userName: string;
  procedureId: number;
  procedureTitle: string;
  category: string;
  points: number;
  scoreText: string;
  reflection?: string;
}): Promise<{ milestone?: PracticeMilestone; error?: string }> {
  if (!isSupabaseConfigured || !supabase || !params.userId) {
    return {};
  }

  const { data, error } = await supabase
    .from('practice_milestones')
    .insert({
      user_id: params.userId,
      procedure_id: params.procedureId,
      points: params.points,
      score_text: params.scoreText,
      reflection: params.reflection || '',
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    return { error: error?.message };
  }

  const row = data as { id: number; created_at: string };
  const createdMs = new Date(row.created_at).getTime();
  return {
    milestone: {
      id: row.id,
      userName: params.userName,
      procedureTitle: params.procedureTitle,
      vid: params.procedureId,
      category: params.category,
      points: params.points,
      scoreText: params.scoreText,
      createdAt: Number.isNaN(createdMs) ? Date.now() : createdMs,
    },
  };
}

export interface ReelsRealtimeHandlers {
  onReelUpsert: (post: ReelPost) => void;
  onReelRemove: (reelId: number) => void;
  onCommentInsert: (reelId: number, comment: CommentItem) => void;
  onCommentDelete: (commentId: number) => void;
  onReportsChanged?: () => void;
}

export function subscribeToReelsUpdates(
  userId: string,
  canModerate: boolean,
  handlers: ReelsRealtimeHandlers,
): () => void {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return () => {};
  }

  const client = supabase;
  const channel = client.channel(`reels-live-${userId}`);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'reels' },
    (payload) => {
      const row = payload.new as ReelRow | undefined;
      if (!row || row.is_removed) return;
      handlers.onReelUpsert(mapReelRowToPost(row, []));
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'reels' },
    (payload) => {
      const row = payload.new as ReelRow | undefined;
      if (!row) return;
      if (row.is_removed) {
        handlers.onReelRemove(row.id);
      } else {
        handlers.onReelUpsert(mapReelRowToPost(row, []));
      }
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'reels' },
    (payload) => {
      const oldRow = payload.old as { id?: number } | undefined;
      if (typeof oldRow?.id === 'number') {
        handlers.onReelRemove(oldRow.id);
      }
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'reel_comments' },
    (payload) => {
      const row = payload.new as ReelCommentRow | undefined;
      if (!row) return;
      handlers.onCommentInsert(row.reel_id, mapReelCommentRow(row));
    },
  );

  channel.on(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'reel_comments' },
    (payload) => {
      const oldRow = payload.old as { id?: number } | undefined;
      if (typeof oldRow?.id === 'number') {
        handlers.onCommentDelete(oldRow.id);
      }
    },
  );

  if (canModerate && handlers.onReportsChanged) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'post_reports' },
      () => {
        handlers.onReportsChanged?.();
      },
    );
  }

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
