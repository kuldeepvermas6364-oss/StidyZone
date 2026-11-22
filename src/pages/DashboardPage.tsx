import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Atom,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Compass,
  FileText,
  GraduationCap,
  History,
  Minus,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';
import { useMaterials } from '../contexts/MaterialsContext';
import { useProgress } from '../contexts/ProgressContext';
import { getStreamDefinition, getSubjectsForExam } from '../data/curriculum';
import { getMaterialById } from '../data/materials/studyMaterialsCatalog';
import type { ExamTrack } from '../types/database';
import { calculateExamCountdown } from '../utils/countdown';
import {
  computeExamStats,
  computeSubjectStats,
  getRecentlyStudiedChapters,
} from '../utils/curriculumProgress';
import { EmptyState } from '../components/common/EmptyState';

const BANNER_IMAGE_SRC = '/src/assets/images/prepzone_academic_banner_1795273672359.jpg';

const DashboardPage: React.FC = () => {
  const {
    language,
    primaryExam,
    setPrimaryExam,
    dailyTargetHours,
    setDailyTargetHours,
    countdowns,
    t,
  } = useApp();
  const { isAuthenticated, session } = useAuth();
  const { progressMap, selectedStream, selectedSubjects } = useProgress();
  const { readingHistory, clearReadingHistory } = useMaterials();
  const { analytics, attempts, examConfigurations, quizzes, totalQuestionCount } = useAssessments();
  const submittedTests = attempts.filter((a) => a.status === 'submitted');
  const [imgError, setImgError] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const examLabels: Record<ExamTrack, string> = {
    'up-board-12': t('nav.upBoard12'),
    'jee-main': t('nav.jeeMain'),
    'jee-advanced': t('nav.jeeAdvanced'),
  };

  const activeSubjects = getSubjectsForExam(
    primaryExam,
    primaryExam === 'up-board-12' ? selectedStream : undefined,
    primaryExam === 'up-board-12' ? selectedSubjects : undefined
  );
  const examStats = computeExamStats(activeSubjects, progressMap);
  const recentStudied = getRecentlyStudiedChapters(progressMap, activeSubjects, 4);
  const latestStudied = recentStudied[0];
  const hasAnyProgress =
    examStats.completedChapters > 0 ||
    examStats.inProgressChapters > 0 ||
    examStats.needsRevisionChapters > 0 ||
    recentStudied.length > 0;
  const activeStreamLabel = getStreamDefinition(selectedStream).name[language];

  const trackCards: Array<{
    id: ExamTrack;
    path: string;
    title: string;
    meta: string;
    desc: string;
    cta: string;
    icon: React.ReactNode;
    accentBg: string;
  }> = [
    {
      id: 'up-board-12',
      path: '/up-board-class-12',
      title: t('dashboard.track.upBoard.title'),
      meta: t('dashboard.track.upBoard.meta'),
      desc: t('dashboard.track.upBoard.desc'),
      cta: t('dashboard.track.upBoard.cta'),
      icon: <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
      accentBg: 'bg-blue-50 dark:bg-blue-950/50',
    },
    {
      id: 'jee-main',
      path: '/jee-main',
      title: t('dashboard.track.jeeMain.title'),
      meta: t('dashboard.track.jeeMain.meta'),
      desc: t('dashboard.track.jeeMain.desc'),
      cta: t('dashboard.track.jeeMain.cta'),
      icon: <Atom className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
      accentBg: 'bg-blue-50 dark:bg-blue-950/50',
    },
    {
      id: 'jee-advanced',
      path: '/jee-advanced',
      title: t('dashboard.track.jeeAdvanced.title'),
      meta: t('dashboard.track.jeeAdvanced.meta'),
      desc: t('dashboard.track.jeeAdvanced.desc'),
      cta: t('dashboard.track.jeeAdvanced.cta'),
      icon: <Compass className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />,
      accentBg: 'bg-slate-100 dark:bg-slate-800',
    },
  ];

  const countdownItems: Array<{ id: ExamTrack; label: string; dateISO: string }> = [
    { id: 'up-board-12', label: t('nav.upBoard12'), dateISO: countdowns['up-board-12'] },
    { id: 'jee-main', label: t('nav.jeeMain'), dateISO: countdowns['jee-main'] },
    { id: 'jee-advanced', label: t('nav.jeeAdvanced'), dateISO: countdowns['jee-advanced'] },
  ];

  const quickAccessItems = [
    {
      path: '/pdf-library',
      title: t('dashboard.quickAccess.pdfTitle'),
      desc: t('dashboard.quickAccess.pdfDesc'),
      icon: <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    },
    {
      path: '/practice-tests',
      title: t('dashboard.quickAccess.testsTitle'),
      desc: t('dashboard.quickAccess.testsDesc'),
      icon: <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    },
    {
      path: '/study-planner',
      title: t('dashboard.quickAccess.plannerTitle'),
      desc: t('dashboard.quickAccess.plannerDesc'),
      icon: <CalendarClock className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Welcome Section */}
      <section
        aria-labelledby="dashboard-welcome-heading"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
          <div className="flex flex-col justify-between p-6 lg:col-span-7 lg:p-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {t('dashboard.activeFocus')} · {examLabels[primaryExam]}
                {primaryExam === 'up-board-12' ? ` (${activeStreamLabel})` : ''} ·{' '}
                {language === 'hi' ? 'हिन्दी' : 'English'}
              </p>

              <h1
                id="dashboard-welcome-heading"
                className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white text-balance"
              >
                {isAuthenticated && session
                  ? t('dashboard.welcomeUser', { name: session.profile.fullName })
                  : t('dashboard.welcomeGuest')}
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
                {t('dashboard.welcomeSubtitle')}
              </p>

              {/* Segmented Exam Focus Switcher */}
              <div
                role="group"
                aria-label={t('dashboard.activeFocus')}
                className="grid w-full grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto dark:bg-slate-800"
              >
                {(['up-board-12', 'jee-main', 'jee-advanced'] as ExamTrack[]).map((track) => {
                  const shortLabel =
                    track === 'up-board-12'
                      ? language === 'hi'
                        ? 'UP बोर्ड 12'
                        : 'UP Board 12'
                      : track === 'jee-main'
                      ? 'JEE Main'
                      : 'JEE Adv';
                  return (
                    <button
                      key={track}
                      type="button"
                      onClick={() => setPrimaryExam(track)}
                      aria-pressed={primaryExam === track}
                      className={`rounded-lg px-2 py-1.5 text-[11px] sm:px-3 sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                        primaryExam === track
                          ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <span className="sm:hidden">{shortLabel}</span>
                      <span className="hidden sm:inline">{examLabels[track]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <span>{t('dashboard.configureGoals')}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to={primaryExam === 'jee-main' ? '/jee-main' : primaryExam === 'jee-advanced' ? '/jee-advanced' : '/up-board-class-12'}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <span>{t('dashboard.exploreTracks')}</span>
              </Link>
            </div>
          </div>

          <div className="relative min-h-48 border-t border-slate-200 bg-blue-50/40 lg:col-span-5 lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-900/90">
            {!imgError ? (
              <img
                src={BANNER_IMAGE_SRC}
                alt={t('dashboard.bannerAlt')}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover lg:h-full dark:opacity-85 dark:brightness-90 dark:contrast-105"
              />
            ) : (
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 bg-linear-to-br from-blue-50 to-slate-100 p-6 text-center dark:from-slate-800 dark:to-slate-900">
                <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span className="font-display text-sm font-semibold text-slate-700 dark:text-slate-200">
                  PrepZone
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Exam Preparation Cards */}
      <section aria-labelledby="tracks-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="tracks-heading"
            className="font-display text-lg font-bold text-slate-900 dark:text-white"
          >
            {t('dashboard.tracksHeading')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {trackCards.map((card) => (
            <article
              key={card.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
            >
              <div>
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.accentBg}`}>
                  {card.icon}
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.meta}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {card.desc}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  to={card.path}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 whitespace-nowrap"
                >
                  <span>{card.cta}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Daily Study Target & Study Progress Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Daily Study Target */}
        <section
          aria-labelledby="daily-target-heading"
          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="daily-target-heading"
                  className="font-display text-base font-bold text-slate-900 dark:text-white"
                >
                  {t('dashboard.dailyTarget.title')}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.dailyTarget.subtitle')}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <Target className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('dashboard.dailyTarget.loggedToday')}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                  0h 00m
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('dashboard.dailyTarget.goalLabel')}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
                  {dailyTargetHours} {t('dashboard.dailyTarget.hoursUnit')}
                </p>
              </div>
            </div>

            {/* Interactive Daily Goal Adjuster */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('dashboard.dailyTarget.adjust')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDailyTargetHours(dailyTargetHours - 0.5)}
                  disabled={dailyTargetHours <= 1}
                  aria-label={t('dashboard.dailyTarget.decrease')}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="w-14 text-center font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  {dailyTargetHours}h
                </span>
                <button
                  type="button"
                  onClick={() => setDailyTargetHours(dailyTargetHours + 0.5)}
                  disabled={dailyTargetHours >= 16}
                  aria-label={t('dashboard.dailyTarget.increase')}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t('dashboard.dailyTarget.emptyHint')}
          </p>
        </section>

        {/* Study Progress Overview */}
        <section
          aria-labelledby="progress-overview-heading"
          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="progress-overview-heading"
                  className="font-display text-base font-bold text-slate-900 dark:text-white"
                >
                  {t('dashboard.progress.title')}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {examLabels[primaryExam]}
                  {primaryExam === 'up-board-12' ? ` · ${t('dashboard.streamLabel')}: ${activeStreamLabel}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.progress.overall')}
                </span>
                <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                  {examStats.completionPercent}%
                </span>
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${examStats.completionPercent}%` }}
              />
            </div>

            {/* Completed / Remaining / Needs Revision Counts */}
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="p-3 text-center">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('dashboard.progress.completedChapters')}
                </p>
                <p className="mt-0.5 font-mono text-lg font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {examStats.completedChapters}
                </p>
              </div>
              <div className="p-3 text-center">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('dashboard.progress.remainingChapters')}
                </p>
                <p className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums dark:text-white">
                  {examStats.remainingChapters}
                </p>
              </div>
              <div className="p-3 text-center">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('dashboard.progress.needsRevision')}
                </p>
                <p className="mt-0.5 font-mono text-lg font-bold text-amber-600 tabular-nums dark:text-amber-400">
                  {examStats.needsRevisionChapters}
                </p>
              </div>
            </div>
          </div>

          {hasAnyProgress ? (
            <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('dashboard.progress.subjectWise')}
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {activeSubjects.map((sub) => {
                  const subStats = computeSubjectStats(sub, progressMap);
                  return (
                    <Link
                      key={sub.id}
                      to={`/syllabus/${sub.examTrack}/${sub.id}`}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-700"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                          {sub.name[language]}
                        </span>
                        <span className="font-mono font-semibold text-blue-600 tabular-nums dark:text-blue-400">
                          {subStats.completionPercent}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${subStats.completionPercent}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
                title={t('dashboard.progress.emptyTitle')}
                body={t('dashboard.progress.emptyBody')}
                actionLabel={t('dashboard.continue.browseSyllabus')}
                actionTo={primaryExam === 'jee-main' ? '/jee-main' : primaryExam === 'jee-advanced' ? '/jee-advanced' : '/up-board-class-12'}
              />
            </div>
          )}
        </section>
      </div>

      {/* 4. Upcoming Exam Countdowns */}
      <section
        aria-labelledby="countdowns-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2
              id="countdowns-heading"
              className="font-display text-base font-bold text-slate-900 dark:text-white"
            >
              {t('dashboard.countdown.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('dashboard.countdown.subtitle')}
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>{t('dashboard.countdown.editDates')}</span>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
          {countdownItems.map((item) => {
            const cd = calculateExamCountdown(item.dateISO, nowMs);
            return (
              <div key={item.id} className="p-4 sm:p-5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {item.label}
                </p>
                {cd.isPast ? (
                  <p className="mt-2 font-display text-base font-bold text-slate-900 dark:text-white">
                    {t('dashboard.countdown.passed')}
                  </p>
                ) : (
                  <div className="mt-2 flex items-baseline gap-3 font-mono tabular-nums">
                    <div>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {cd.days}
                      </span>{' '}
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {t('dashboard.countdown.days')}
                      </span>
                    </div>
                    <div>
                      <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {cd.hours}
                      </span>{' '}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('dashboard.countdown.hours')}
                      </span>
                    </div>
                    <div>
                      <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {cd.minutes}
                      </span>{' '}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('dashboard.countdown.mins')}
                      </span>
                    </div>
                  </div>
                )}
                <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.countdown.targetDate')}: {item.dateISO}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Continue Learning & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="continue-learning-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2
            id="continue-learning-heading"
            className="font-display text-base font-bold text-slate-900 dark:text-white"
          >
            {t('dashboard.continue.title')}
          </h2>
          {latestStudied ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {latestStudied.subject.name[language]} · {t(`syllabus.status.${latestStudied.record.status}`)}
                  </p>
                  <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
                    {latestStudied.chapter.order}. {latestStudied.chapter.title[language]}
                  </h3>
                </div>
                <span className="font-mono text-base font-bold text-blue-600 tabular-nums shrink-0 dark:text-blue-400">
                  {latestStudied.record.completionPercent}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${latestStudied.record.completionPercent}%` }}
                />
              </div>
              <div className="pt-1">
                <Link
                  to={`/syllabus/${latestStudied.subject.examTrack}/${latestStudied.subject.id}/${latestStudied.chapter.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  <span>{t('dashboard.continue.openChapter')}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <EmptyState
                icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                title={t('dashboard.continue.emptyTitle')}
                body={t('dashboard.continue.emptyBody')}
                actionLabel={t('dashboard.continue.cta')}
                actionTo={primaryExam === 'jee-main' ? '/jee-main' : primaryExam === 'jee-advanced' ? '/jee-advanced' : '/up-board-class-12'}
              />
            </div>
          )}
        </section>

        <section
          aria-labelledby="recent-activity-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2
            id="recent-activity-heading"
            className="font-display text-base font-bold text-slate-900 dark:text-white"
          >
            {t('dashboard.activity.title')}
          </h2>
          {recentStudied.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {recentStudied.map((item) => (
                <li key={item.record.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    to={`/syllabus/${item.subject.examTrack}/${item.subject.id}/${item.chapter.id}`}
                    className="flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                        {item.subject.name[language]} · {item.chapter.title[language]}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t(`syllabus.status.${item.record.status}`)} ·{' '}
                        {t('dashboard.activity.updatedOn')}{' '}
                        {item.record.lastActivityAt.slice(0, 10)}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums shrink-0 dark:text-slate-300">
                      {item.record.completionPercent}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2">
              <EmptyState
                icon={<History className="h-5 w-5" aria-hidden="true" />}
                title={t('dashboard.activity.emptyTitle')}
                body={t('dashboard.activity.emptyBody')}
              />
            </div>
          )}
        </section>
      </div>

      {/* 5b. Recently Viewed Study Materials (Prompt 3) */}
      <section
        aria-labelledby="recent-materials-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="recent-materials-heading"
            className="font-display text-base font-bold text-slate-900 dark:text-white"
          >
            {t('dashboard.recentMaterials.title')}
          </h2>
          {readingHistory.length > 0 && (
            <button
              type="button"
              onClick={() => void clearReadingHistory()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('materials.library.clearHistory')}</span>
            </button>
          )}
        </div>

        {readingHistory.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {readingHistory.slice(0, 4).map((entry) => {
              const mat = getMaterialById(entry.materialId);
              if (!mat) return null;
              const targetRoute =
                mat.materialType === 'video_lecture'
                  ? `/video-lectures/${mat.id}`
                  : `/pdf-library/view/${mat.id}`;
              return (
                <Link
                  key={entry.id}
                  to={targetRoute}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-700"
                >
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                    {mat.title[language]}
                  </p>
                  <p className="mt-1 font-mono text-[11px] font-medium text-blue-600 dark:text-blue-400">
                    {entry.totalPages
                      ? t('materials.library.pageProgress', {
                          page: entry.lastViewedPage,
                          total: entry.totalPages,
                        })
                      : t(`materials.type.${mat.materialType}`)}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-2">
            <EmptyState
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              title={t('dashboard.recentMaterials.emptyTitle')}
              body={t('dashboard.recentMaterials.emptyBody')}
              actionLabel={t('dashboard.recentMaterials.browseLibrary')}
              actionTo="/pdf-library"
            />
          </div>
        )}
      </section>

      {/* 5c. Practice, Quizzes & Exam Simulator Analytics (Prompt 4) */}
      <section
        aria-labelledby="dashboard-assessments-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="dashboard-assessments-heading"
              className="font-display text-base font-bold text-slate-900 dark:text-white"
            >
              {t('dashboard.assessments.title')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {totalQuestionCount} questions · {quizzes.length} quizzes · {examConfigurations.length} mock formats
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/practice"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>{t('dashboard.assessments.dailyQuizTitle')}</span>
            </Link>
            <Link
              to="/exam-simulator"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('dashboard.assessments.mockTestsTitle')}</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Practice Accuracy & Weak Chapters */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-6 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('dashboard.assessments.accuracy')}
                </p>
                <p className="mt-0.5 font-mono text-2xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
                  {analytics.overallAccuracyPercent}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('dashboard.assessments.weakChapters')}
                </p>
                <p className="mt-0.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                  {analytics.weakChapters.length}
                </p>
              </div>
            </div>

            {analytics.weakChapters.length > 0 ? (
              <div className="space-y-2">
                {analytics.weakChapters.slice(0, 3).map((wc) => (
                  <div
                    key={`${wc.subjectId}-${wc.chapterId}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                      {wc.subjectId} · {wc.chapterId} ({wc.accuracyPercent}%)
                    </span>
                    <Link
                      to={`/practice?subject=${wc.subjectId}&chapter=${wc.chapterId}`}
                      className="font-semibold text-blue-600 hover:underline shrink-0 dark:text-blue-400"
                    >
                      Practice
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t('dashboard.assessments.emptyWeak')}
              </p>
            )}
          </div>

          {/* Recent Test Results */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-6 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {t('dashboard.assessments.recentResults')}
              </h3>
              <Link
                to="/practice-tests"
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Open Hub
              </Link>
            </div>

            {submittedTests.length > 0 ? (
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {submittedTests.slice(0, 3).map((att) => (
                  <li key={att.id} className="py-2 first:pt-0 last:pb-0">
                    <Link
                      to={`/exam-results/${att.id}`}
                      className="flex items-center justify-between gap-3 text-xs group"
                    >
                      <span className="truncate font-semibold text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                        {att.title[language]}
                      </span>
                      <span className="font-mono font-bold text-blue-600 tabular-nums shrink-0 dark:text-blue-400">
                        {att.result ? `${att.result.score}/${att.result.maxMarks}` : '--'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t('dashboard.assessments.emptyResults')}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 5d. PrepZone AI Study Assistant Quick-Action Card (Prompt 5) */}
      <section
        aria-labelledby="dashboard-ai-assistant-heading"
        className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/60 via-white to-white p-6 space-y-4 dark:border-blue-900/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="dashboard-ai-assistant-heading"
                className="font-display text-base font-bold text-slate-900 dark:text-white"
              >
                {t('dashboard.aiCard.title')}
              </h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {t('dashboard.aiCard.subtitle')}
              </p>
            </div>
          </div>

          <Link
            to={`/ai-assistant?exam=${primaryExam}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('dashboard.aiCard.openWorkspace')}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/ai-assistant?tab=chat&exam=${primaryExam}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-600"
          >
            <span>{t('dashboard.aiCard.askDoubt')}</span>
          </Link>
          <Link
            to={`/ai-assistant?tab=pdf&exam=${primaryExam}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-600"
          >
            <span>{t('dashboard.aiCard.pdfTutor')}</span>
          </Link>
          <Link
            to={`/ai-assistant?tab=quiz&exam=${primaryExam}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-600"
          >
            <span>{t('dashboard.aiCard.aiQuiz')}</span>
          </Link>
          <Link
            to={`/ai-assistant?tab=summary&exam=${primaryExam}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-600"
          >
            <span>{t('dashboard.aiCard.summary')}</span>
          </Link>
          <Link
            to={`/ai-assistant?tab=plan&exam=${primaryExam}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-blue-600"
          >
            <span>{t('dashboard.aiCard.studyPlan')}</span>
          </Link>
          {analytics.weakChapters.length > 0 && (
            <Link
              to={`/ai-assistant?tab=chat&exam=${primaryExam}&subject=${analytics.weakChapters[0].subjectId}&chapter=${analytics.weakChapters[0].chapterId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <span>
                {language === 'hi'
                  ? `कमज़ोर अध्याय दोहराएँ (${analytics.weakChapters[0].accuracyPercent}%)`
                  : `Revise Weak Chapter (${analytics.weakChapters[0].accuracyPercent}%)`}
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* 6. Quick Access Trio */}
      <section aria-labelledby="quick-access-heading" className="space-y-4">
        <h2
          id="quick-access-heading"
          className="font-display text-lg font-bold text-slate-900 dark:text-white"
        >
          {t('dashboard.quickAccess.title')}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickAccessItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800/70"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.desc}
                  </p>
                </div>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
