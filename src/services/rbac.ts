import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type {
  ContributeForm,
  Discipline,
  InstructorApplication,
  ProcedureVideo,
  ReelPost,
  Region,
  ReportedPost,
  SubmissionItem,
  SubmissionStatus,
} from '../types';

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Recently';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
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

interface ApplicationRow {
  id: number;
  applicant_id: string;
  email: string;
  full_name: string;
  qualifications: string;
  youtube_handle: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'declined';
  decision_note: string | null;
  submitted_at: string;
}

export async function fetchInstructorApplications(): Promise<{
  applications: InstructorApplication[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { applications: [] };
  }

  const { data, error } = await supabase
    .from('instructor_applications')
    .select(
      'id, applicant_id, email, full_name, qualifications, youtube_handle, note, status, decision_note, submitted_at',
    )
    .order('submitted_at', { ascending: false });

  if (error) {
    return { applications: [], error: error.message };
  }

  const applications: InstructorApplication[] = (
    (data || []) as ApplicationRow[]
  ).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    qualifications: row.qualifications,
    youtubeHandle: row.youtube_handle || '',
    note: row.note || '',
    submittedAt: formatRelativeTime(row.submitted_at),
    status: row.status,
    decisionNote: row.decision_note || undefined,
  }));

  return { applications };
}

export async function submitInstructorApplicationToSupabase(
  userId: string,
  email: string,
  data: {
    fullName: string;
    qualifications: string;
    youtubeHandle: string;
    note: string;
  },
): Promise<{ application?: InstructorApplication; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data: inserted, error } = await supabase
    .from('instructor_applications')
    .insert({
      applicant_id: userId,
      email: email.trim().toLowerCase(),
      full_name: data.fullName.trim(),
      qualifications: data.qualifications.trim(),
      youtube_handle: data.youtubeHandle.trim(),
      note: data.note.trim(),
      status: 'pending',
    })
    .select(
      'id, applicant_id, email, full_name, qualifications, youtube_handle, note, status, decision_note, submitted_at',
    )
    .single();

  if (error || !inserted) {
    return {
      error: error?.message || 'Unable to submit instructor application.',
    };
  }

  const row = inserted as ApplicationRow;
  return {
    application: {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      qualifications: row.qualifications,
      youtubeHandle: row.youtube_handle || '',
      note: row.note || '',
      submittedAt: 'Just now',
      status: row.status,
      decisionNote: row.decision_note || undefined,
    },
  };
}

export async function reviewInstructorApplicationRpc(
  appId: number,
  approve: boolean,
  decisionNote?: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.rpc('review_instructor_application', {
    p_app_id: appId,
    p_approve: approve,
    p_decision_note: decisionNote?.trim() || null,
  });

  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function revokeInstructorRpc(
  targetUserId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.rpc('revoke_instructor', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function appointOrUpdateSubAdminRpc(data: {
  email: string;
  name: string;
  canReview: boolean;
  canModerate: boolean;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.rpc('appoint_or_update_sub_admin', {
    p_email: data.email.trim().toLowerCase(),
    p_name: data.name.trim(),
    p_can_review: data.canReview,
    p_can_moderate: data.canModerate,
  });

  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function removeSubAdminRpc(
  targetUserId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.rpc('remove_sub_admin', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { error: error.message };
  }
  return {};
}

interface VideoSubmissionRow {
  id: number;
  submitted_by_email: string;
  discipline: Discipline;
  category: string;
  title: string;
  instructor_display: string;
  organization: string;
  region: Region;
  duration: string;
  storage_path: string;
  external_video_url: string | null;
  steps: unknown;
  checklist: unknown;
  reviewer_note: string;
  status: SubmissionStatus;
}

async function resolveSubmissionVideoUrl(
  storagePath: string,
  externalUrl: string | null,
): Promise<string> {
  if (externalUrl) return externalUrl;
  if (!storagePath || !supabase) return '';
  const { data } = await supabase.storage
    .from('procedure-submissions')
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl || '';
}

export async function fetchVideoSubmissions(): Promise<{
  submissions: SubmissionItem[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { submissions: [] };
  }

  const { data, error } = await supabase
    .from('video_submissions')
    .select(
      'id, submitted_by_email, discipline, category, title, instructor_display, organization, region, duration, storage_path, external_video_url, steps, checklist, reviewer_note, status',
    )
    .order('created_at', { ascending: false });

  if (error) {
    return { submissions: [], error: error.message };
  }

  const rows = (data || []) as VideoSubmissionRow[];
  const submissions = await Promise.all(
    rows.map(async (row): Promise<SubmissionItem> => {
      const steps = Array.isArray(row.steps)
        ? row.steps.map((s) => String(s))
        : [];
      const rawChecks = Array.isArray(row.checklist) ? row.checklist : [];
      const checks = [0, 1, 2, 3, 4].map((idx) => Boolean(rawChecks[idx]));
      const url = await resolveSubmissionVideoUrl(
        row.storage_path,
        row.external_video_url,
      );

      return {
        id: row.id,
        submittedByEmail: row.submitted_by_email,
        discipline: row.discipline,
        category: row.category,
        title: row.title,
        instructor: row.instructor_display,
        organization: row.organization,
        region: row.region,
        duration: row.duration || 'New',
        url,
        steps,
        checks,
        note: row.reviewer_note || '',
        err: '',
        status: row.status,
      };
    }),
  );

  return { submissions };
}

export async function submitVideoForReviewToSupabase(params: {
  userId: string;
  email: string;
  form: ContributeForm;
  file?: File | null;
}): Promise<{ submission?: SubmissionItem; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { userId, email, form, file } = params;
  let storagePath = '';

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: uploadErr } = await supabase.storage
      .from('procedure-submissions')
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      return { error: uploadErr.message };
    }
    storagePath = path;
  }

  const cleanedSteps = form.steps.map((s) => s.trim()).filter(Boolean);

  const { data: inserted, error } = await supabase
    .from('video_submissions')
    .insert({
      submitted_by: userId,
      submitted_by_email: email.trim().toLowerCase(),
      discipline: form.discipline,
      category: form.category,
      title: form.title.trim(),
      instructor_display: form.by.trim(),
      organization: form.org.trim(),
      region: form.region,
      duration: 'New',
      storage_path: storagePath,
      steps: cleanedSteps,
      owns_rights: form.ownsRights,
      patient_consent: form.patientConsent,
      status: 'pending',
    })
    .select(
      'id, submitted_by_email, discipline, category, title, instructor_display, organization, region, duration, storage_path, external_video_url, steps, checklist, reviewer_note, status',
    )
    .single();

  if (error || !inserted) {
    return {
      error: error?.message || 'Unable to submit video for review.',
    };
  }

  const row = inserted as VideoSubmissionRow;
  const resolvedUrl =
    (await resolveSubmissionVideoUrl(row.storage_path, row.external_video_url)) ||
    form.url;

  return {
    submission: {
      id: row.id,
      submittedByEmail: row.submitted_by_email,
      discipline: row.discipline,
      category: row.category,
      title: row.title,
      instructor: row.instructor_display,
      organization: row.organization,
      region: row.region,
      duration: row.duration || 'New',
      url: resolvedUrl,
      steps: cleanedSteps,
      checks: [false, false, false, false, false],
      note: '',
      err: '',
      status: row.status,
    },
  };
}

export async function reviewVideoSubmissionRpc(
  submissionId: number,
  decision: Exclude<SubmissionStatus, 'pending'>,
  checklist: boolean[],
  note: string,
): Promise<{ procedureId?: number | null; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase.rpc('review_video_submission', {
    p_submission_id: submissionId,
    p_decision: decision,
    p_checklist: checklist,
    p_note: note,
  });

  if (error) {
    return { error: error.message };
  }

  return { procedureId: typeof data === 'number' ? data : null };
}

interface ReportRow {
  id: number;
  reel_id: number;
  reason: string;
  reporter_name: string;
  status: 'open' | 'removed' | 'dismissed';
  created_at: string;
}

export async function fetchPostReports(): Promise<{
  reports: ReportedPost[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { reports: [] };
  }

  const { data, error } = await supabase
    .from('post_reports')
    .select('id, reel_id, reason, reporter_name, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return { reports: [], error: error.message };
  }

  const reports: ReportedPost[] = ((data || []) as ReportRow[]).map((row) => ({
    id: row.id,
    postId: row.reel_id,
    reason: row.reason,
    reportedBy: row.reporter_name,
    reportedAt: formatRelativeTime(row.created_at),
    status: row.status,
  }));

  return { reports };
}

export async function submitPostReportToSupabase(
  userId: string,
  reporterName: string,
  reelId: number,
  reason: string,
): Promise<{ report?: ReportedPost; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase
    .from('post_reports')
    .insert({
      reel_id: reelId,
      reported_by: userId,
      reporter_name: reporterName,
      reason,
      status: 'open',
    })
    .select('id, reel_id, reason, reporter_name, status, created_at')
    .single();

  if (error || !data) {
    return { error: error?.message || 'Unable to submit report.' };
  }

  const row = data as ReportRow;
  return {
    report: {
      id: row.id,
      postId: row.reel_id,
      reason: row.reason,
      reportedBy: row.reporter_name,
      reportedAt: 'Just now',
      status: row.status,
    },
  };
}

export async function moderateReportedPostRpc(
  reportId: number,
  action: 'removed' | 'dismissed',
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.rpc('moderate_reported_post', {
    p_report_id: reportId,
    p_action: action,
  });

  if (error) {
    return { error: error.message };
  }
  return {};
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

export async function fetchPublishedProcedures(): Promise<{
  procedures: ProcedureVideo[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { procedures: [] };
  }

  const { data, error } = await supabase
    .from('procedures')
    .select(
      'id, discipline, category, title, instructor_display, organization, region, duration, steps, hue, storage_path, external_video_url, views_count, likes_count, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    return { procedures: [], error: error.message };
  }

  const rows = (data || []) as ProcedureRow[];
  const procedures = await Promise.all(
    rows.map(async (row): Promise<ProcedureVideo> => {
      let videoUrl = row.external_video_url || undefined;
      if (!videoUrl && row.storage_path && supabase) {
        const { data: pub } = supabase.storage
          .from('procedures-public')
          .getPublicUrl(row.storage_path);
        if (pub?.publicUrl) {
          videoUrl = pub.publicUrl;
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
    }),
  );

  return { procedures };
}

interface ReelRow {
  id: number;
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

export async function fetchVisibleReels(): Promise<{
  reels: ReelPost[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { reels: [] };
  }

  const { data, error } = await supabase
    .from('reels')
    .select(
      'id, author_display, author_role, author_org, author_reg, author_bio, verified, kind, genre, discipline, category, linked_procedure_id, caption, media_path, is_image, hue, views_count, likes_count, practice_clicks, is_removed, created_at',
    )
    .eq('is_removed', false)
    .order('created_at', { ascending: false });

  if (error) {
    return { reels: [], error: error.message };
  }

  const reels: ReelPost[] = ((data || []) as ReelRow[]).map((row) => {
    let mediaUrl: string | undefined;
    if (row.media_path && supabase) {
      if (
        row.media_path.startsWith('http://') ||
        row.media_path.startsWith('https://')
      ) {
        mediaUrl = row.media_path;
      } else {
        const { data: pub } = supabase.storage
          .from('reel-media')
          .getPublicUrl(row.media_path);
        mediaUrl = pub?.publicUrl;
      }
    }

    return {
      id: row.id,
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
      hue: row.hue || 200,
      ago: formatRelativeTime(row.created_at),
      views: row.views_count || 0,
      likes: row.likes_count || 0,
      practiceClicks: row.practice_clicks || 0,
      comments: [],
      url: mediaUrl,
      isImage: Boolean(row.is_image),
    };
  });

  return { reels };
}
