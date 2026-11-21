import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import type { ExamTrack } from '../types/database';

const ProfilePage: React.FC = () => {
  const { setPrimaryExam, t } = useApp();
  const { session, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(session?.profile.fullName ?? '');
  const [exam, setExam] = useState<ExamTrack>(session?.profile.primaryExam ?? 'up-board-12');
  const [medium, setMedium] = useState<'hindi' | 'english' | 'bilingual'>(
    session?.profile.studyMedium ?? 'bilingual'
  );
  const [saved, setSaved] = useState(false);

  if (!session) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      fullName,
      primaryExam: exam,
      studyMedium: medium,
    });
    setPrimaryExam(exam);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t('profile.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('profile.subtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{t('nav.signOut')}</span>
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('auth.email')}
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
              {session.user.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('profile.authModeLabel')}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {session.mode === 'firebase'
                ? t('profile.authModeFirebase')
                : t('profile.authModeLocal')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="profile-fullname"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('auth.fullName')}
            </label>
            <input
              id="profile-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="profile-exam"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('auth.primaryExam')}
              </label>
              <select
                id="profile-exam"
                value={exam}
                onChange={(e) => setExam(e.target.value as ExamTrack)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="up-board-12">{t('nav.upBoard12')}</option>
                <option value="jee-main">{t('nav.jeeMain')}</option>
                <option value="jee-advanced">{t('nav.jeeAdvanced')}</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="profile-medium"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('auth.studyMedium')}
              </label>
              <select
                id="profile-medium"
                value={medium}
                onChange={(e) =>
                  setMedium(e.target.value as 'hindi' | 'english' | 'bilingual')
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="bilingual">{t('auth.medium.bilingual')}</option>
                <option value="hindi">{t('auth.medium.hindi')}</option>
                <option value="english">{t('auth.medium.english')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <span>{t('profile.save')}</span>
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" aria-hidden="true" />
                {t('profile.saved')}
              </span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
};

export default ProfilePage;
