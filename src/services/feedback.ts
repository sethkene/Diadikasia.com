import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type {
  FeedbackCategory,
  FeedbackInternalNote,
  FeedbackItem,
  FeedbackStatus,
  UserProfile,
} from '../types';

export const FEEDBACK_ATTACHMENT_BUCKET = 'feedback-attachments';
export const MAX_FEEDBACK_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: string | undefined | null): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

function createRandomToken(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  suggestions: 'Suggestions and Improvements',
  complaints: 'Complaints',
  technical: 'Technical Problems / Bug Reports',
  safety: 'Clinical Content or Safety Concerns',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  received: 'Received',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
};

export interface PlatformFeedbackRow {
  id: number;
  reference_number: string;
  user_id: string | null;
  category: FeedbackCategory;
  subject: string;
  message: string;
  is_anonymous: boolean;
  attachment_path: string | null;
  attachment_name: string | null;
  status: FeedbackStatus;
  admin_response: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformFeedbackNoteRow {
  id: number;
  feedback_id: number;
  author_id: string | null;
  author_name: string;
  note: string;
  status_at_time: FeedbackStatus;
  created_at: string;
}

const FEEDBACK_SELECT_COLUMNS =
  'id, reference_number, user_id, category, subject, message, is_anonymous, attachment_path, attachment_name, status, admin_response, responded_at, resolved_at, created_at, updated_at';

const FEEDBACK_NOTE_SELECT_COLUMNS =
  'id, feedback_id, author_id, author_name, note, status_at_time, created_at';

export function validateFeedbackAttachment(file: File): string | null {
  if (file.size <= 0) {
    return 'Selected screenshot or image file is empty.';
  }
  if (file.size > MAX_FEEDBACK_ATTACHMENT_BYTES) {
    return 'Attachment must be 10 MB or smaller.';
  }

  const baseMime = file.type.split(';')[0].trim().toLowerCase();
  const ext = file.name.split('.').pop()?.trim().toLowerCase() || '';
  const validMime = baseMime
    ? ALLOWED_IMAGE_MIMES.has(baseMime)
    : ALLOWED_IMAGE_EXTS.has(ext);
  if (!validMime) {
    return 'Attachments must be JPG, PNG, or WebP images.';
  }
  return null;
}

export function validateFeedbackDraft(params: {
  category: FeedbackCategory;
  subject: string;
  message: string;
}): string | null {
  if (!(params.category in FEEDBACK_CATEGORY_LABELS)) {
    return 'Please select a valid feedback category.';
  }
  const subject = params.subject.trim();
  if (subject.length < 3 || subject.length > 160) {
    return 'Subject must be between 3 and 160 characters.';
  }
  const message = params.message.trim();
  if (message.length < 10 || message.length > 4000) {
    return 'Please write at least 10 characters (max 4,000) explaining your feedback.';
  }
  return null;
}

async function resolveFeedbackAttachmentUrl(
  path: string | null | undefined,
): Promise<string | undefined> {
  if (!path || !supabase) return undefined;
  const { data, error } = await supabase.storage
    .from(FEEDBACK_ATTACHMENT_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

function mapFeedbackNoteRow(
  row: PlatformFeedbackNoteRow,
): FeedbackInternalNote {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    authorId: row.author_id || undefined,
    authorName: row.author_name,
    note: row.note,
    statusAtTime: row.status_at_time,
    createdAt: row.created_at,
  };
}

function mapFeedbackRow(
  row: PlatformFeedbackRow,
  options?: {
    attachmentUrl?: string;
    submitterName?: string;
    submitterEmail?: string;
    internalNotes?: FeedbackInternalNote[];
  },
): FeedbackItem {
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    userId: row.is_anonymous ? null : row.user_id,
    submitterName: row.is_anonymous ? undefined : options?.submitterName,
    submitterEmail: row.is_anonymous ? undefined : options?.submitterEmail,
    category: row.category,
    subject: row.subject,
    message: row.message,
    isAnonymous: Boolean(row.is_anonymous),
    attachmentPath: row.is_anonymous
      ? row.attachment_path
        ? 'anonymous'
        : undefined
      : row.attachment_path || undefined,
    attachmentName: row.attachment_name || undefined,
    attachmentUrl: options?.attachmentUrl,
    status: row.status,
    adminResponse: row.admin_response || undefined,
    respondedAt: row.responded_at || undefined,
    resolvedAt: row.resolved_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    internalNotes: options?.internalNotes,
  };
}

export async function submitFeedbackToSupabase(params: {
  userId: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  isAnonymous: boolean;
  file?: File | null;
}): Promise<{ item?: FeedbackItem; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(params.userId)) {
    return { error: 'Please sign in before submitting feedback.' };
  }

  const draftError = validateFeedbackDraft({
    category: params.category,
    subject: params.subject,
    message: params.message,
  });
  if (draftError) {
    return { error: draftError };
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;

  if (params.file) {
    const fileError = validateFeedbackAttachment(params.file);
    if (fileError) {
      return { error: fileError };
    }

    const safeName =
      params.file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '.') || 'attachment.png';
    attachmentPath = params.isAnonymous
      ? `anonymous/${params.userId}/${createRandomToken()}-${safeName}`
      : `${params.userId}/${Date.now()}-${safeName}`;
    attachmentName = params.file.name;

    const contentType = params.file.type.split(';')[0].trim() || undefined;
    const { error: uploadErr } = await supabase.storage
      .from(FEEDBACK_ATTACHMENT_BUCKET)
      .upload(attachmentPath, params.file, {
        upsert: false,
        contentType,
      });

    if (uploadErr) {
      return { error: uploadErr.message };
    }
  }

  const { data, error } = await supabase.rpc('submit_platform_feedback', {
    p_category: params.category,
    p_subject: params.subject.trim(),
    p_message: params.message.trim(),
    p_is_anonymous: params.isAnonymous,
    p_attachment_path: attachmentPath,
    p_attachment_name: attachmentName,
  });

  if (error || !data) {
    if (attachmentPath) {
      await supabase.storage
        .from(FEEDBACK_ATTACHMENT_BUCKET)
        .remove([attachmentPath]);
    }
    return { error: error?.message || 'Unable to submit feedback right now.' };
  }

  const rows = Array.isArray(data) ? data : [data];
  const row = rows[0] as
    | {
        id: number;
        reference_number: string;
        category: FeedbackCategory;
        subject: string;
        message: string;
        is_anonymous: boolean;
        attachment_path: string | null;
        attachment_name: string | null;
        status: FeedbackStatus;
        created_at: string;
      }
    | undefined;

  if (!row) {
    return { error: 'Feedback submission could not be confirmed.' };
  }

  const attachmentUrl =
    !row.is_anonymous && row.attachment_path
      ? await resolveFeedbackAttachmentUrl(row.attachment_path)
      : undefined;

  return {
    item: {
      id: row.id,
      referenceNumber: row.reference_number,
      userId: row.is_anonymous ? null : params.userId,
      category: row.category,
      subject: row.subject,
      message: row.message,
      isAnonymous: Boolean(row.is_anonymous),
      attachmentPath: row.is_anonymous
        ? attachmentPath
          ? 'anonymous'
          : undefined
        : row.attachment_path || undefined,
      attachmentName: row.attachment_name || undefined,
      attachmentUrl,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.created_at,
    },
  };
}

export async function fetchMyFeedbackFromSupabase(
  userId: string,
): Promise<{ items: FeedbackItem[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { items: [] };
  }
  if (!isValidUuid(userId)) {
    return { items: [], error: 'Please sign in to view your feedback history.' };
  }

  const { data, error } = await supabase
    .from('platform_feedback')
    .select(FEEDBACK_SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('is_anonymous', false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    return { items: [], error: error.message };
  }

  const rows = (data || []) as PlatformFeedbackRow[];
  const items = await Promise.all(
    rows.map(async (row) => {
      const attachmentUrl = row.attachment_path
        ? await resolveFeedbackAttachmentUrl(row.attachment_path)
        : undefined;
      return mapFeedbackRow(row, { attachmentUrl });
    }),
  );

  return { items };
}

export async function fetchAllFeedbackForAdminFromSupabase(
  accounts: UserProfile[],
): Promise<{ items: FeedbackItem[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { items: [] };
  }

  const [feedbackRes, notesRes] = await Promise.all([
    supabase
      .from('platform_feedback')
      .select(FEEDBACK_SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('platform_feedback_notes')
      .select(FEEDBACK_NOTE_SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ]);

  if (feedbackRes.error) {
    return { items: [], error: feedbackRes.error.message };
  }
  if (notesRes.error) {
    return { items: [], error: notesRes.error.message };
  }

  const rows = (feedbackRes.data || []) as PlatformFeedbackRow[];
  const noteRows = (notesRes.data || []) as PlatformFeedbackNoteRow[];

  const profileById = new Map<string, UserProfile>();
  for (const acc of accounts) {
    if (acc.id) profileById.set(acc.id, acc);
  }

  const missingIds = Array.from(
    new Set(
      rows
        .filter((r) => !r.is_anonymous && r.user_id && !profileById.has(r.user_id))
        .map((r) => r.user_id as string),
    ),
  );

  if (missingIds.length > 0) {
    const { data: extraProfiles } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('id', missingIds);

    for (const p of (extraProfiles || []) as Array<{
      id: string;
      name: string;
      email: string;
      role: UserProfile['role'];
    }>) {
      profileById.set(p.id, {
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
      });
    }
  }

  const notesByFeedback = new Map<number, FeedbackInternalNote[]>();
  for (const noteRow of noteRows) {
    const mapped = mapFeedbackNoteRow(noteRow);
    const list = notesByFeedback.get(noteRow.feedback_id) || [];
    list.push(mapped);
    notesByFeedback.set(noteRow.feedback_id, list);
  }

  const items = await Promise.all(
    rows.map(async (row) => {
      const attachmentUrl = row.attachment_path
        ? await resolveFeedbackAttachmentUrl(row.attachment_path)
        : undefined;
      const submitter =
        !row.is_anonymous && row.user_id ? profileById.get(row.user_id) : undefined;
      return mapFeedbackRow(row, {
        attachmentUrl,
        submitterName: submitter?.name || (row.is_anonymous ? undefined : 'Diadikasia Member'),
        submitterEmail: submitter?.email,
        internalNotes: notesByFeedback.get(row.id) || [],
      });
    }),
  );

  return { items };
}

export async function updateFeedbackByAdminInSupabase(params: {
  feedbackId: number;
  adminId: string;
  adminName: string;
  status: FeedbackStatus;
  adminResponse: string;
  internalNote?: string;
}): Promise<{
  updatedRow?: PlatformFeedbackRow;
  newNote?: FeedbackInternalNote;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }
  if (!isValidUuid(params.adminId)) {
    return { error: 'Supreme Admin authentication required.' };
  }

  const trimmedResponse = params.adminResponse.trim();
  const { data: updated, error: updateErr } = await supabase
    .from('platform_feedback')
    .update({
      status: params.status,
      admin_response: trimmedResponse || null,
    })
    .eq('id', params.feedbackId)
    .select(FEEDBACK_SELECT_COLUMNS)
    .single();

  if (updateErr || !updated) {
    return {
      error: updateErr?.message || 'Unable to update feedback submission.',
    };
  }

  let newNote: FeedbackInternalNote | undefined;
  const trimmedNote = params.internalNote?.trim() || '';
  if (trimmedNote) {
    if (trimmedNote.length > 2000) {
      return {
        updatedRow: updated as PlatformFeedbackRow,
        error: 'Status updated, but internal note must be 2,000 characters or less.',
      };
    }

    const { data: noteInserted, error: noteErr } = await supabase
      .from('platform_feedback_notes')
      .insert({
        feedback_id: params.feedbackId,
        author_id: params.adminId,
        author_name: params.adminName || 'Supreme Admin',
        note: trimmedNote,
        status_at_time: params.status,
      })
      .select(FEEDBACK_NOTE_SELECT_COLUMNS)
      .single();

    if (noteErr) {
      return {
        updatedRow: updated as PlatformFeedbackRow,
        error: `Status saved, but internal note failed: ${noteErr.message}`,
      };
    }
    if (noteInserted) {
      newNote = mapFeedbackNoteRow(noteInserted as PlatformFeedbackNoteRow);
    }
  }

  return {
    updatedRow: updated as PlatformFeedbackRow,
    newNote,
  };
}

export function subscribeToFeedbackUpdates(
  userId: string,
  isAdmin: boolean,
  onChanged: () => void,
): () => void {
  if (!isSupabaseConfigured || !supabase || !isValidUuid(userId)) {
    return () => {};
  }

  const client = supabase;
  const channel = client.channel(`feedback-live-${userId}`);

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'platform_feedback' },
    (payload) => {
      if (isAdmin) {
        onChanged();
        return;
      }
      const nextRow = payload.new as Partial<PlatformFeedbackRow> | undefined;
      const oldRow = payload.old as Partial<PlatformFeedbackRow> | undefined;
      if (nextRow?.user_id === userId || oldRow?.user_id === userId) {
        onChanged();
      }
    },
  );

  if (isAdmin) {
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'platform_feedback_notes' },
      () => {
        onChanged();
      },
    );
  }

  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
