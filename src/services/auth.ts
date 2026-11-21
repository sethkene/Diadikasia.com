import type { EmailOtpType, User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';

export const AUTH_EMAIL_REDIRECT_URL = 'https://diadikasia-com.ai.studio';

const ALLOWED_EMAIL_OTP_TYPES = new Set<string>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

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

export interface AuthCallbackResult {
  handled: boolean;
  verified?: boolean;
  recovery?: boolean;
  type?: string;
  user?: UserProfile;
  error?: string;
}

export function isEmailVerified(
  user: { email_confirmed_at?: string | null } | null | undefined,
): boolean {
  return Boolean(user?.email_confirmed_at);
}

function buildFallbackUserProfile(
  authUser: Pick<User, 'id' | 'email' | 'user_metadata'>,
  fallbackEmail = '',
  fallbackName = '',
): UserProfile {
  const email = authUser.email || fallbackEmail;
  const metaName =
    typeof authUser.user_metadata?.name === 'string'
      ? authUser.user_metadata.name
      : '';
  return {
    id: authUser.id,
    email,
    name: metaName || fallbackName || (email ? email.split('@')[0] : 'Learner'),
    role: 'learner',
  };
}

function formatCallbackError(
  rawError: string | null,
  errorCode: string | null,
  errorDescription: string | null,
): string {
  const code = (errorCode || '').toLowerCase();
  const desc = (errorDescription || rawError || '').trim();
  if (code === 'otp_expired' || desc.toLowerCase().includes('expired')) {
    return 'That confirmation link has expired or was already used. Sign in or request a new confirmation email.';
  }
  if (code === 'access_denied' && !desc) {
    return 'Email confirmation was cancelled or denied. Please request a fresh confirmation email.';
  }
  return (
    desc ||
    'Unable to complete email confirmation. Please request a new confirmation link.'
  );
}

function cleanAuthCallbackUrlFromHistory(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    const authParams = [
      'code',
      'token_hash',
      'type',
      'flow_id',
      'sb_flow_id',
      'error',
      'error_code',
      'error_description',
    ];
    for (const key of authParams) {
      url.searchParams.delete(key);
    }

    const hashRaw = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    if (hashRaw) {
      const hashParams = new URLSearchParams(hashRaw);
      if (
        hashParams.has('access_token') ||
        hashParams.has('refresh_token') ||
        hashParams.has('error') ||
        hashParams.has('error_description') ||
        hashParams.has('error_code') ||
        hashParams.has('type')
      ) {
        url.hash = '';
      }
    }

    const cleanRelative = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', cleanRelative || '/');
  } catch {
    // ignore history cleanup errors in restricted frames
  }
}

let inFlightCallbackPromise: Promise<AuthCallbackResult> | null = null;

export function processAuthCallbackFromUrl(): Promise<AuthCallbackResult> {
  if (inFlightCallbackPromise) {
    return inFlightCallbackPromise;
  }

  inFlightCallbackPromise = (async (): Promise<AuthCallbackResult> => {
    if (typeof window === 'undefined') {
      return { handled: false };
    }

    const searchParams = new URLSearchParams(window.location.search);
    const hashRaw = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hashRaw);

    const urlError = searchParams.get('error') || hashParams.get('error');
    const urlErrorCode =
      searchParams.get('error_code') || hashParams.get('error_code');
    const urlErrorDesc =
      searchParams.get('error_description') ||
      hashParams.get('error_description');

    const code = searchParams.get('code');
    const flowId =
      searchParams.get('sb_flow_id') || searchParams.get('flow_id');
    const tokenHash = searchParams.get('token_hash');
    const queryType = searchParams.get('type');
    const hashType = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    const hasCallbackParams = Boolean(
      urlError ||
        urlErrorCode ||
        urlErrorDesc ||
        code ||
        (tokenHash && queryType) ||
        (accessToken && refreshToken),
    );

    if (!hasCallbackParams) {
      return { handled: false };
    }

    if (urlError || urlErrorCode || urlErrorDesc) {
      cleanAuthCallbackUrlFromHistory();
      return {
        handled: true,
        error: formatCallbackError(urlError, urlErrorCode, urlErrorDesc),
      };
    }

    if (!isSupabaseConfigured || !supabase) {
      cleanAuthCallbackUrlFromHistory();
      return { handled: true, error: supabaseConfigError };
    }

    const callbackType = (queryType || hashType || '').toLowerCase();
    let establishedUser: User | null = null;
    let establishedError: string | null = null;

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (error) {
        establishedError = error.message;
      } else {
        establishedUser = data.session?.user || data.user || null;
      }
    } else if (tokenHash && queryType) {
      if (!ALLOWED_EMAIL_OTP_TYPES.has(callbackType)) {
        establishedError = 'Unsupported verification link type.';
      } else {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: callbackType as EmailOtpType,
        });
        if (error) {
          establishedError = error.message;
        } else {
          establishedUser = data.session?.user || data.user || null;
        }
      }
    } else if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        establishedError = error.message;
      } else {
        establishedUser = data.session?.user || data.user || null;
      }
    }

    cleanAuthCallbackUrlFromHistory();

    if (establishedError) {
      return {
        handled: true,
        error: formatCallbackError(establishedError, null, establishedError),
      };
    }

    if (!establishedUser) {
      return {
        handled: true,
        error:
          'Email verification completed, please sign in with your email and password.',
      };
    }

    if (!isEmailVerified(establishedUser)) {
      await supabase.auth.signOut();
      return {
        handled: true,
        error:
          'Your email has not been confirmed yet. Please open the confirmation link in your email.',
      };
    }

    if (callbackType === 'recovery') {
      return {
        handled: true,
        recovery: true,
        type: 'recovery',
      };
    }

    const profile = await fetchMyProfile(establishedUser.id);
    return {
      handled: true,
      verified: true,
      type: callbackType || 'signup',
      user: profile || buildFallbackUserProfile(establishedUser),
    };
  })().finally(() => {
    inFlightCallbackPromise = null;
  });

  return inFlightCallbackPromise;
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
          'Your email has not been confirmed yet. Open the confirmation link in your email or resend it below.',
      };
    }
    return { error: error.message };
  }

  if (!data.user || !data.session) {
    return { error: 'Unable to sign in. Please verify your email and try again.' };
  }

  if (!isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    return {
      needsEmailConfirmation: true,
      error:
        'Your email has not been confirmed yet. Open the confirmation link in your email or resend it below.',
    };
  }

  const profile = await fetchMyProfile(data.user.id);
  if (!profile) {
    return {
      user: buildFallbackUserProfile(data.user, email),
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
      emailRedirectTo: AUTH_EMAIL_REDIRECT_URL,
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

  // Enforce email verification: never admit an unverified user into the authenticated app
  if (!data.session || !isEmailVerified(data.user)) {
    if (data.session) {
      await supabase.auth.signOut();
    }
    return { needsEmailConfirmation: true };
  }

  const profile = await fetchMyProfile(data.user.id);
  return {
    user: profile || buildFallbackUserProfile(data.user, email, name),
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
    if (!isEmailVerified(data.user)) {
      await supabase.auth.signOut();
      return {
        error:
          'Email confirmation is still pending. Please open the confirmation link in your email.',
      };
    }
    const profile = await fetchMyProfile(data.user.id);
    if (profile) return { user: profile };
    return {
      user: buildFallbackUserProfile(data.user, email),
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
    options: {
      emailRedirectTo: AUTH_EMAIL_REDIRECT_URL,
    },
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

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: AUTH_EMAIL_REDIRECT_URL,
  });
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
    if (!isEmailVerified(data.user)) {
      await supabase.auth.signOut();
      return {
        error: 'Please confirm your email address before signing in.',
      };
    }
    const profile = await fetchMyProfile(data.user.id);
    if (profile) return { user: profile };
    return {
      user: buildFallbackUserProfile(data.user, email),
    };
  }

  return {};
}

export async function updatePasswordForRecoverySession(
  newPassword: string,
): Promise<{ user?: UserProfile; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: supabaseConfigError };
  }

  const { data, error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateErr) {
    return { error: updateErr.message };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const activeUser = sessionData.session?.user || data.user;

  if (!activeUser || !sessionData.session) {
    return {
      error: 'Password updated. Please sign in with your new password.',
    };
  }

  if (!isEmailVerified(activeUser)) {
    await supabase.auth.signOut();
    return {
      error: 'Please confirm your email address before signing in.',
    };
  }

  const profile = await fetchMyProfile(activeUser.id);
  return {
    user: profile || buildFallbackUserProfile(activeUser),
  };
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
