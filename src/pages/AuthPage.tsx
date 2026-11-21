import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { AuthFoundationError } from '../services/auth/authService';
import type { ExamTrack } from '../types/database';
import { PrepZoneLogo } from '../components/brand/PrepZoneLogo';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { language, t } = useApp();
  const { signIn, register, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = (location.state as { from?: string } | null)?.from || '/profile';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [primaryExam, setPrimaryExam] = useState<ExamTrack>('up-board-12');
  const [studyMedium, setStudyMedium] = useState<'hindi' | 'english' | 'bilingual'>('bilingual');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  const mapAuthError = (err: unknown): string => {
    if (err instanceof AuthFoundationError) {
      switch (err.code) {
        case 'INVALID_NAME':
          return t('auth.errName');
        case 'INVALID_EMAIL':
          return t('auth.errEmail');
        case 'WEAK_PASSWORD':
          return t('auth.errPassword');
        case 'ACCOUNT_NOT_FOUND':
          return t('auth.errNotFound');
        case 'WRONG_PASSWORD':
          return t('auth.errWrongPass');
        case 'GOOGLE_REQUIRES_FIREBASE':
          return t('auth.errGoogleUnconfigured');
      }
    }
    return t('auth.errGoogleFailed');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      if (mode === 'register') {
        register({
          fullName,
          email,
          password,
          primaryExam,
          studyMedium,
          preferredLanguage: language,
        });
      } else {
        signIn({ email, password });
      }
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setErrorMessage(mapAuthError(err));
    }
  };

  const handleGoogle = async () => {
    setErrorMessage(null);
    setGooglePending(true);
    try {
      await signInWithGoogle();
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setErrorMessage(mapAuthError(err));
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <PrepZoneLogo />
        </div>

        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          {mode === 'register' ? t('auth.registerTitle') : t('auth.loginTitle')}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {mode === 'register' ? t('auth.registerSubtitle') : t('auth.loginSubtitle')}
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Primary Firebase Google Sign-In */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googlePending}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <span>{googlePending ? t('auth.signingIn') : t('auth.googleBtn')}</span>
          </button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {t('auth.orDivider')}
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
          {t('auth.foundationNotice')}
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-fullname"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('auth.fullName')}
              </label>
              <input
                id="auth-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('auth.email')}
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('auth.password')}
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="auth-exam"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {t('auth.primaryExam')}
                </label>
                <select
                  id="auth-exam"
                  value={primaryExam}
                  onChange={(e) => setPrimaryExam(e.target.value as ExamTrack)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="up-board-12">{t('nav.upBoard12')}</option>
                  <option value="jee-main">{t('nav.jeeMain')}</option>
                  <option value="jee-advanced">{t('nav.jeeAdvanced')}</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="auth-medium"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {t('auth.studyMedium')}
                </label>
                <select
                  id="auth-medium"
                  value={studyMedium}
                  onChange={(e) =>
                    setStudyMedium(e.target.value as 'hindi' | 'english' | 'bilingual')
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="bilingual">{t('auth.medium.bilingual')}</option>
                  <option value="hindi">{t('auth.medium.hindi')}</option>
                  <option value="english">{t('auth.medium.english')}</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {mode === 'register' ? t('auth.submitRegister') : t('auth.submitLogin')}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
          <Link
            to={mode === 'register' ? '/login' : '/register'}
            state={{ from: redirectTarget }}
            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {mode === 'register' ? t('auth.switchToLogin') : t('auth.switchToRegister')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
