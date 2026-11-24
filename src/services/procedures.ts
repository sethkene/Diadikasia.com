import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type {
  CommentItem,
  Discipline,
  ProcedureVideo,
  Region,
  RegionFilter,
} from '../types';

export interface ProcedureFilterParams {
  discipline?: Discipline;
  region?: RegionFilter;
  category?: string;
  searchQuery?: string;
}

interface ProcedureRow {
  id: number;
  discipline: Discipline;
  category: string;
  title: string;
  instructor_display: string;
  organization: string;
  region: Region;
  duration: string;
  steps: unknown;
  hue: number;
  storage_path: string | null;
  external_video_url: string | null;
  views_count: number;
  likes_count: number;
  created_at: string;
}

const PROCEDURE_SELECT_COLUMNS =
  'id, discipline, category, title, instructor_display, organization, region, duration, steps, hue, storage_path, external_video_url, views_count, likes_count, created_at';

function formatRelativeCommentTime(iso: string | null | undefined): string {
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
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function mapProcedureRow(row: ProcedureRow): ProcedureVideo {
  let videoUrl = row.external_video_url || undefined;
  if (!videoUrl && row.storage_path && supabase) {
    if (
      row.storage_path.startsWith('http://') ||
      row.storage_path.startsWith('https://')
    ) {
      videoUrl = row.storage_path;
    } else {
      const { data: pub } = supabase.storage
        .from('procedures-public')
        .getPublicUrl(row.storage_path);
      if (pub?.publicUrl) {
        videoUrl = pub.publicUrl;
      }
    }
  }

  const createdMs = new Date(row.created_at).getTime();
  const daysAgo = Number.isNaN(createdMs)
    ? 0
    : Math.max(0, Math.floor((Date.now() - createdMs) / 86400000));

  return {
    id: row.id,
    discipline: row.discipline,
    category: row.category,
    title: row.title,
    instructor: row.instructor_display,
    organization: row.organization,
    region: row.region,
    duration: row.duration || 'New',
    steps: Array.isArray(row.steps) ? row.steps.map((s) => String(s)) : [],
    hue: typeof row.hue === 'number' ? row.hue : 190,
    views: row.views_count || 0,
    likes: row.likes_count || 0,
    daysAgo,
    videoUrl,
  };
}

function sanitizeSearchTerm(raw: string): string {
  // Strip PostgREST `.or()` structural characters and wildcard operators
  return raw.replace(/[,()*%_\\]/g, ' ').trim().replace(/\s+/g, ' ');
}

export async function fetchPublishedProcedures(): Promise<{
  procedures: ProcedureVideo[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { procedures: [], error: supabaseConfigError };
  }

  const { data, error } = await supabase
    .from('procedures')
    .select(PROCEDURE_SELECT_COLUMNS)
    .order('id', { ascending: true });

  if (error) {
    return { procedures: [], error: error.message };
  }

  return {
    procedures: ((data || []) as ProcedureRow[]).map(mapProcedureRow),
  };
}

export async function queryPublishedProcedures(
  params: ProcedureFilterParams,
): Promise<{
  procedures: ProcedureVideo[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { procedures: [], error: supabaseConfigError };
  }

  let query = supabase.from('procedures').select(PROCEDURE_SELECT_COLUMNS);

  if (params.discipline) {
    query = query.eq('discipline', params.discipline);
  }
  if (params.region && params.region !== 'All') {
    query = query.eq('region', params.region);
  }
  if (params.category && params.category !== 'All') {
    query = query.eq('category', params.category);
  }

  const cleanSearch = params.searchQuery
    ? sanitizeSearchTerm(params.searchQuery)
    : '';
  if (cleanSearch) {
    query = query.or(
      `title.ilike.%${cleanSearch}%,instructor_display.ilike.%${cleanSearch}%,organization.ilike.%${cleanSearch}%`,
    );
  }

  const { data, error } = await query.order('id', { ascending: true });

  if (error) {
    return { procedures: [], error: error.message };
  }

  return {
    procedures: ((data || []) as ProcedureRow[]).map(mapProcedureRow),
  };
}

export async function fetchProcedureById(procedureId: number): Promise<{
  procedure: ProcedureVideo | null;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { procedure: null, error: supabaseConfigError };
  }

  const { data, error } = await supabase
    .from('procedures')
    .select(PROCEDURE_SELECT_COLUMNS)
    .eq('id', procedureId)
    .maybeSingle();

  if (error) {
    return { procedure: null, error: error.message };
  }

  return {
    procedure: data ? mapProcedureRow(data as ProcedureRow) : null,
  };
}

export async function promoteSubmissionVideoToPublicStorage(
  storagePath: string,
): Promise<{ error?: string }> {
  if (!storagePath || !isSupabaseConfigured || !supabase) {
    return {};
  }

  const { data: blob, error: downloadErr } = await supabase.storage
    .from('procedure-submissions')
    .download(storagePath);

  if (downloadErr || !blob) {
    return {
      error:
        downloadErr?.message ||
        'Unable to read submitted video from storage for publishing.',
    };
  }

  const { error: uploadErr } = await supabase.storage
    .from('procedures-public')
    .upload(storagePath, blob, {
      upsert: false,
      contentType: blob.type || 'video/mp4',
    });

  if (uploadErr) {
    const msg = uploadErr.message.toLowerCase();
    if (!msg.includes('already exists') && !msg.includes('duplicate')) {
      return { error: uploadErr.message };
    }
  }

  return {};
}

export async function fetchMySavedProcedureIds(userId: string): Promise<{
  savedIds: number[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { savedIds: [] };
  }

  const { data, error } = await supabase
    .from('saved_procedures')
    .select('procedure_id')
    .eq('user_id', userId);

  if (error) {
    return { savedIds: [], error: error.message };
  }

  return {
    savedIds: ((data || []) as Array<{ procedure_id: number }>).map(
      (r) => r.procedure_id,
    ),
  };
}

export async function setSavedProcedureInSupabase(
  userId: string,
  procedureId: number,
  save: boolean,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  if (save) {
    const { error } = await supabase
      .from('saved_procedures')
      .upsert(
        { user_id: userId, procedure_id: procedureId },
        { onConflict: 'user_id,procedure_id', ignoreDuplicates: true },
      );
    return error ? { error: error.message } : {};
  }

  const { error } = await supabase
    .from('saved_procedures')
    .delete()
    .eq('user_id', userId)
    .eq('procedure_id', procedureId);
  return error ? { error: error.message } : {};
}

export async function fetchMyProcedureProgress(userId: string): Promise<{
  progressMap: Record<number, boolean[]>;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { progressMap: {} };
  }

  const { data, error } = await supabase
    .from('procedure_progress')
    .select('procedure_id, completed_steps')
    .eq('user_id', userId);

  if (error) {
    return { progressMap: {}, error: error.message };
  }

  const progressMap: Record<number, boolean[]> = {};
  for (const row of (data || []) as Array<{
    procedure_id: number;
    completed_steps: unknown;
  }>) {
    if (Array.isArray(row.completed_steps)) {
      progressMap[row.procedure_id] = row.completed_steps.map(Boolean);
    }
  }
  return { progressMap };
}

export async function upsertProcedureProgressInSupabase(
  userId: string,
  procedureId: number,
  completedSteps: boolean[],
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.from('procedure_progress').upsert(
    {
      user_id: userId,
      procedure_id: procedureId,
      completed_steps: completedSteps,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,procedure_id' },
  );

  return error ? { error: error.message } : {};
}

export async function fetchMyProcedureLikes(userId: string): Promise<{
  likedIds: number[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { likedIds: [] };
  }

  const { data, error } = await supabase
    .from('procedure_likes')
    .select('procedure_id')
    .eq('user_id', userId);

  if (error) {
    return { likedIds: [], error: error.message };
  }

  return {
    likedIds: ((data || []) as Array<{ procedure_id: number }>).map(
      (r) => r.procedure_id,
    ),
  };
}

export async function setProcedureLikeInSupabase(
  userId: string,
  procedureId: number,
  like: boolean,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  if (like) {
    const { error } = await supabase
      .from('procedure_likes')
      .upsert(
        { user_id: userId, procedure_id: procedureId },
        { onConflict: 'user_id,procedure_id', ignoreDuplicates: true },
      );
    return error ? { error: error.message } : {};
  }

  const { error } = await supabase
    .from('procedure_likes')
    .delete()
    .eq('user_id', userId)
    .eq('procedure_id', procedureId);
  return error ? { error: error.message } : {};
}

export async function fetchProcedureComments(): Promise<{
  commentsByProcedure: Record<number, CommentItem[]>;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { commentsByProcedure: {} };
  }

  const { data, error } = await supabase
    .from('procedure_comments')
    .select('procedure_id, author_name, body, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return { commentsByProcedure: {}, error: error.message };
  }

  const commentsByProcedure: Record<number, CommentItem[]> = {};
  for (const row of (data || []) as Array<{
    procedure_id: number;
    author_name: string;
    body: string;
    created_at: string;
  }>) {
    const item: CommentItem = {
      name: row.author_name,
      text: row.body,
      ago: formatRelativeCommentTime(row.created_at),
    };
    if (!commentsByProcedure[row.procedure_id]) {
      commentsByProcedure[row.procedure_id] = [];
    }
    commentsByProcedure[row.procedure_id].push(item);
  }

  return { commentsByProcedure };
}

export async function addProcedureCommentInSupabase(
  procedureId: number,
  userId: string,
  authorName: string,
  body: string,
): Promise<{ comment?: CommentItem; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase
    .from('procedure_comments')
    .insert({
      procedure_id: procedureId,
      author_id: userId,
      author_name: authorName,
      body,
    })
    .select('author_name, body, created_at')
    .single();

  if (error || !data) {
    return { error: error?.message || 'Unable to post comment.' };
  }

  const row = data as {
    author_name: string;
    body: string;
    created_at: string;
  };
  return {
    comment: {
      name: row.author_name,
      text: row.body,
      ago: 'now',
    },
  };
}

export async function incrementProcedureViewRpc(
  procedureId: number,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc('increment_procedure_view', {
    p_procedure_id: procedureId,
  });
}
