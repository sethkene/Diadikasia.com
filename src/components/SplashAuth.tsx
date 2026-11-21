import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';
import {
  requestPasswordReset,
  resendSignupOtp,
  signInWithSupabase,
  signUpWithSupabase,
  updatePasswordForRecoverySession,
  verifyRecoveryOtpAndSetPassword,
  verifySignupOtp,
} from '../services/auth';
import type { AuthMode, ScreenMode, UserProfile } from '../types';
import { BrandMark, BrandWordmark } from './BrandLogo';

export interface AuthNotice {
  error?: string;
  info?: string;
  recoverySession?: boolean;
}

interface SplashAuthProps {
  screen: Exclude<ScreenMode, 'app'>;
  authMode: AuthMode;
  initialNotice?: AuthNotice;
  onContinueFromSplash: () => void;
  onChangeAuthMode: (mode: AuthMode) => void;
  onAuthenticate: (user: UserProfile, isSignup: boolean) => void;
  onToast: (msg: string) => void;
}

export const SplashAuth: React.FC<SplashAuthProps> = ({
  screen,
  authMode,
  initialNotice,
  onContinueFromSplash,
  onChangeAuthMode,
  onAuthenticate,
  onToast,
}) => {
  const [forgotMode, setForgotMode] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [recoveryLinkMode, setRecoveryLinkMode] = useState(false);
  const [signupOtpStep, setSignupOtpStep] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [signupOtpCode, setSignupOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!initialNotice) return;
    if (initialNotice.recoverySession) {
      setForgotMode(true);
      setRecoveryLinkMode(true);
      setOtpStep(false);
      setSignupOtpStep(false);
    }
    if (initialNotice.error) {
      setError(initialNotice.error);
      setInfoMsg('');
    } else if (initialNotice.info) {
      setInfoMsg(initialNotice.info);
      setError('');
    }
  }, [initialNotice]);

  if (screen === 'splash') {
    return (
      <div
        onClick={onContinueFromSplash}
        className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6 py-12 select-none"
      >
        <div className="flex flex-col items-center">
          <BrandMark width={96} />
          <div className="mt-5">
            <BrandWordmark size={34} />
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError(supabaseConfigError);
      return;
    }

    if (signupOtpStep) {
      if (!signupOtpCode.trim()) {
        setError('Enter the confirmation code from your email.');
        return;
      }
      setError('');
      setIsSubmitting(true);
      try {
        const res = await verifySignupOtp(cleanEmail, signupOtpCode);
        if (res.error) {
          setError(res.error);
          return;
        }
        if (res.user) {
          setSignupOtpStep(false);
          setSignupOtpCode('');
          onAuthenticate(res.user, true);
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }
    if (authMode === 'up' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (authMode === 'up' && !name.trim()) {
      setError('Enter your full name.');
      return;
    }
    setError('');
    setInfoMsg('');

    setIsSubmitting(true);
    try {
      if (authMode === 'up') {
        const result = await signUpWithSupabase(
          name.trim(),
          cleanEmail,
          password,
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.needsEmailConfirmation) {
          setSignupOtpStep(true);
          setInfoMsg(
            `Account created! We sent a confirmation link to ${cleanEmail}. Click that link in your email to confirm your account, or enter a 6-digit code below if included.`,
          );
          return;
        }
        if (result.user) {
          onAuthenticate(result.user, true);
        }
      } else {
        const result = await signInWithSupabase(cleanEmail, password);
        if (result.needsEmailConfirmation) {
          setSignupOtpStep(true);
          setInfoMsg(
            result.error ||
              'Your email is not confirmed yet. Click the confirmation link sent to your email or resend it below.',
          );
          return;
        }
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.user) {
          onAuthenticate(result.user, false);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendSignupOtp = async () => {
    if (isSubmitting) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const res = await resendSignupOtp(cleanEmail);
      if (res.error) {
        setError(res.error);
        return;
      }
      setInfoMsg(
        `A fresh confirmation email has been sent to ${cleanEmail}. Check your inbox and spam folder.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isSupabaseConfigured) {
      setError(supabaseConfigError);
      return;
    }

    if (recoveryLinkMode) {
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      setError('');
      setInfoMsg('');
      setIsSubmitting(true);
      try {
        const res = await updatePasswordForRecoverySession(newPassword);
        if (res.error) {
          setError(res.error);
          return;
        }
        setForgotMode(false);
        setRecoveryLinkMode(false);
        setOtpStep(false);
        setNewPassword('');
        onToast('Password updated. Welcome back.');
        if (res.user) {
          onAuthenticate(res.user, false);
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const cleanReset = resetEmail.trim().toLowerCase();
    if (!cleanReset || !cleanReset.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setInfoMsg('');

    setIsSubmitting(true);
    try {
      if (!otpStep) {
        const res = await requestPasswordReset(cleanReset);
        if (res.error) {
          setError(res.error);
          return;
        }
        setOtpStep(true);
        setInfoMsg(
          'If that email has an account, check your inbox for a recovery link or 6-digit code.',
        );
      } else {
        if (!otpCode.trim()) {
          setError('Enter the recovery code from your email.');
          return;
        }
        if (newPassword.length < 6) {
          setError('New password must be at least 6 characters.');
          return;
        }
        const res = await verifyRecoveryOtpAndSetPassword(
          cleanReset,
          otpCode,
          newPassword,
        );
        if (res.error) {
          setError(res.error);
          return;
        }
        setForgotMode(false);
        setOtpStep(false);
        setOtpCode('');
        setNewPassword('');
        setResetEmail('');
        onToast('Password updated. Welcome back.');
        if (res.user) {
          onAuthenticate(res.user, false);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-2.5">
          <BrandMark width={30} />
          <BrandWordmark size={22} />
        </div>

        {forgotMode ? (
          <form onSubmit={handleResetSubmit} className="mt-6">
            <h1 className="text-xl font-bold text-slate-900">
              {recoveryLinkMode ? 'Set a new password' : 'Reset your password'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {recoveryLinkMode
                ? 'Choose a new password for your Diadikasia account.'
                : otpStep
                ? 'Enter the code from your email and choose a new password.'
                : 'Enter your email and we’ll send a reset link or code.'}
            </p>

            {recoveryLinkMode ? (
              <>
                <label
                  htmlFor="reset-link-new-password"
                  className="block text-xs font-semibold text-slate-700 mt-5 mb-1.5"
                >
                  New password
                </label>
                <input
                  id="reset-link-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </>
            ) : (
              <>
                <label
                  htmlFor="reset-email"
                  className="block text-xs font-semibold text-slate-700 mt-5 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                {otpStep && isSupabaseConfigured && (
                  <>
                    <label
                      htmlFor="reset-otp"
                      className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5"
                    >
                      Recovery code
                    </label>
                    <input
                      id="reset-otp"
                      type="text"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />

                    <label
                      htmlFor="reset-new-password"
                      className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5"
                    >
                      New password
                    </label>
                    <input
                      id="reset-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </>
                )}
              </>
            )}

            {infoMsg && (
              <p
                className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 mt-3"
                role="status"
              >
                {infoMsg}
              </p>
            )}

            {error && (
              <p className="text-xs font-medium text-red-700 mt-2" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 min-h-[46px] text-sm transition-colors"
            >
              {isSubmitting
                ? 'Please wait…'
                : recoveryLinkMode || otpStep
                ? 'Update password'
                : 'Send reset email'}
            </button>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setRecoveryLinkMode(false);
                  setOtpStep(false);
                  setError('');
                  setInfoMsg('');
                }}
                className="text-sm font-semibold text-teal-600 hover:text-teal-700 py-2"
              >
                Back to sign in
              </button>

              {isSupabaseConfigured && !otpStep && !recoveryLinkMode && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep(true);
                    setError('');
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 py-2"
                >
                  I have a code
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6">
            <h1 className="text-xl font-bold text-slate-900">
              {signupOtpStep
                ? 'Confirm your email'
                : authMode === 'up'
                ? 'Create your account'
                : 'Welcome back'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Learn clinical procedures from instructors across Africa, Europe
              and Asia.
            </p>

            <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1 mt-5">
              <button
                type="button"
                onClick={() => {
                  onChangeAuthMode('in');
                  setSignupOtpStep(false);
                  setSignupOtpCode('');
                  setError('');
                  setInfoMsg('');
                }}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${
                  authMode === 'in' && !signupOtpStep
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeAuthMode('up');
                  setSignupOtpStep(false);
                  setSignupOtpCode('');
                  setError('');
                  setInfoMsg('');
                }}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] ${
                  authMode === 'up' || signupOtpStep
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create account
              </button>
            </div>

            {signupOtpStep ? (
              <div>
                <p className="text-xs text-slate-600 mt-4">
                  Open the confirmation link in your email to activate your
                  account and continue automatically.
                </p>
                <label
                  htmlFor="signup-otp"
                  className="block text-xs font-semibold text-slate-700 mt-3 mb-1.5"
                >
                  Verification code (optional)
                </label>
                <input
                  id="signup-otp"
                  type="text"
                  inputMode="numeric"
                  value={signupOtpCode}
                  onChange={(e) => setSignupOtpCode(e.target.value)}
                  placeholder="6-digit code (if provided)"
                  className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            ) : (
              <>
                {authMode === 'up' && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5"
                    >
                      Full name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Chidi Okafor"
                      className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={
                      authMode === 'up' ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-300 bg-white rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {authMode === 'up' && (
                  <p className="text-xs text-slate-500 mt-3">
                    All new accounts start as a normal learner profile. Clinical
                    instructors can apply for verification inside Profile after
                    signing in.
                  </p>
                )}
              </>
            )}

            {infoMsg && (
              <p
                className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 mt-3"
                role="status"
              >
                {infoMsg}
              </p>
            )}

            {error && (
              <p className="text-xs font-medium text-red-700 mt-2.5" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 min-h-[46px] text-sm transition-colors"
            >
              {isSubmitting
                ? 'Please wait…'
                : signupOtpStep
                ? 'Verify & continue'
                : authMode === 'up'
                ? 'Create account'
                : 'Sign in'}
            </button>

            {signupOtpStep ? (
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSignupOtpStep(false);
                    setSignupOtpCode('');
                    onChangeAuthMode('in');
                    setError('');
                    setInfoMsg('');
                  }}
                  className="text-sm font-semibold text-teal-600 hover:text-teal-700 py-2"
                >
                  Already confirmed via link? Sign in
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleResendSignupOtp}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 py-2"
                >
                  Resend confirmation email
                </button>
              </div>
            ) : (
              authMode === 'in' && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setOtpStep(false);
                    if (!resetEmail && email) setResetEmail(email);
                    setError('');
                    setInfoMsg('');
                  }}
                  className="mt-2.5 text-sm font-semibold text-teal-600 hover:text-teal-700 py-2"
                >
                  Forgot password?
                </button>
              )
            )}
          </form>
        )}
      </div>
    </div>
  );
};
