import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';

export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  qualifications: string | null;
  youtube_handle: string | null;
  approved_at: string | null;
  can_review_videos: boolean;
  can_moderate_posts: boolean;
  share_practice_popups: boolean;
}

interface PublicDirectoryRow {
  id: string;
  name: string;
  role: UserRole;
  qualifications: string | null;
  youtube_handle: string | null;
  approved_at: string | null;
}

export function mapProfileRowToUser(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    qualifications: row.qualifications || undefined,
    youtubeHandle: row.youtube_handle || undefined,
    approvedAt: row.approved_at || undefined,
    permissions:
      row.role === 'sub_admin'
        ? {
            canReviewVideos: Boolean(row.can_review_videos),
            canModeratePosts: Boolean(row.can_moderate_posts),
          }
        : undefined,
    sharePracticePopups: row.share_practice_popups,
  };
}

export async function fetchMyProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, name, role, qualifications, youtube_handle, approved_at, can_review_videos, can_moderate_posts, share_practice_popups',
    )
    .eq('id', userId)
    .maybeSingle();

  if (!error && data) {
    return mapProfileRowToUser(data as ProfileRow);
  }

  // Fallback for users created before trigger deployment
  const { data: ensured, error: rpcErr } = await supabase.rpc('ensure_my_profile');
  if (!rpcErr && ensured) {
    return mapProfileRowToUser(ensured as ProfileRow);
  }

  return null;
}

export async function fetchDirectoryProfiles(
  isAdmin = false,
): Promise<UserProfile[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  if (isAdmin) {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, name, role, qualifications, youtube_handle, approved_at, can_review_videos, can_moderate_posts, share_practice_popups',
      )
      .order('created_at', { ascending: true });

    if (!error && data) {
      return (data as ProfileRow[]).map(mapProfileRowToUser);
    }
  }

  const { data, error } = await supabase.rpc('get_public_directory');
  if (error || !data) return [];

  return (data as PublicDirectoryRow[]).map((row) => ({
    id: row.id,
    email: '',
    name: row.name,
    role: row.role,
    qualifications: row.qualifications || undefined,
    youtubeHandle: row.youtube_handle || undefined,
    approvedAt: row.approved_at || undefined,
  }));
}

export async function signInWithSupabase(
  email: string,
  password: string,
): Promise<{
  user?: UserProfile;
  needsEmailConfirmation?: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        needsEmailConfirmation: true,
        error:
          'Your email has not been confirmed yet. Enter your 6-digit verification code or resend it.',
      };
    }
    return { error: error.message };
  }

  if (!data.user || !data.session) {
    return { error: 'Unable to sign in. Please verify your email and try again.' };
  }

  const profile = await fetchMyProfile(data.user.id);
  if (!profile) {
    return {
      user: {
        id: data.user.id,
        email: data.user.email || email,
        name:
          (data.user.user_metadata?.name as string | undefined) ||
          email.split('@')[0],
        role: 'learner',
      },
    };
  }

  return { user: profile };
}

export async function signUpWithSupabase(
  name: string,
  email: string,
  password: string,
): Promise<{
  user?: UserProfile;
  needsEmailConfirmation?: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('already registered') ||
      msg.includes('already exists') ||
      msg.includes('user already')
    ) {
      return {
        error: 'An account with that email already exists. Please sign in.',
      };
    }
    return { error: error.message };
  }

  if (!data.user) {
    return { error: 'Account creation failed. Please try again.' };
  }

  // Supabase returns an obfuscated user with identities: [] when the email is already registered & confirmed
  if (
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    return {
      error:
        'An account with that email already exists. Please sign in or reset your password.',
    };
  }

  // If Supabase requires email confirmation before issuing a session
  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  const profile = await fetchMyProfile(data.user.id);
  return {
    user: profile || {
      id: data.user.id,
      email: data.user.email || email,
      name,
      role: 'learner',
    },
  };
}

export async function verifySignupOtp(
  email: string,
  token: string,
): Promise<{ user?: UserProfile; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: token.trim(),
    type: 'signup',
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user && data.session) {
    const profile = await fetchMyProfile(data.user.id);
    if (profile) return { user: profile };
    return {
      user: {
        id: data.user.id,
        email: data.user.email || email,
        name:
          (data.user.user_metadata?.name as string | undefined) ||
          email.split('@')[0],
        role: 'learner',
      },
    };
  }

  return { error: 'Verification succeeded, please sign in.' };
}

export async function resendSignupOtp(
  email: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });

  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function requestPasswordReset(
  email: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function verifyRecoveryOtpAndSetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<{ user?: UserProfile; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: token.trim(),
    type: 'recovery',
  });

  if (error) {
    return { error: error.message };
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateErr) {
    return { error: updateErr.message };
  }

  if (data.user && data.session) {
    const profile = await fetchMyProfile(data.user.id);
    if (profile) return { user: profile };
    return {
      user: {
        id: data.user.id,
        email: data.user.email || email,
        name:
          (data.user.user_metadata?.name as string | undefined) ||
          email.split('@')[0],
        role: 'learner',
      },
    };
  }

  return {};
}

export async function updateMySharePopupsPreference(
  userId: string,
  enabled: boolean,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase
    .from('profiles')
    .update({ share_practice_popups: enabled })
    .eq('id', userId);
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.auth.signOut();
}
