import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ClipboardCheck,
  FileText,
  Info,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { GuestSaveBanner } from '../components/curriculum/GuestSaveBanner';
import { VerificationNotice } from '../components/curriculum/VerificationNotice';
import { MaterialCard } from '../components/materials/MaterialCard';
import { getChapterById } from '../data/curriculum';
import { QUESTION_PUBLIC_CATALOG } from '../data/assessments/questionBankCatalog';
import { STUDY_MATERIALS_CATALOG } from '../data/materials/studyMaterialsCatalog';
import { useApp } from '../contexts/AppContext';
import { useMaterials } from '../contexts/MaterialsContext';
import { useProgress } from '../contexts/ProgressContext';
import type { ChapterProgressStatus, PracticeStatus } from '../types/curriculum';
import type { ExamTrack } from '../types/database';
import { getChapterProgress } from '../utils/curriculumProgress';
import { groupChapterMaterials } from '../utils/materialsSearch';

const TRACK_LABELS: Record<ExamTrack, string> = {
  'up-board-12': 'nav.upBoard12',
  'jee-main': 'nav.jeeMain',
  'jee-advanced': 'nav.jeeAdvanced',
};

const ALL_STATUSES: ChapterProgressStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'needs_revision',
];

const PRACTICE_STATUSES: PracticeStatus[] = ['not_started', 'in_progress', 'completed'];

const ChapterDetailPage: React.FC = () => {
  const { examTrack, subjectId, chapterId } = useParams<{
    examTrack: string;
    subjectId: string;
    chapterId: string;
  }>();
  const { language, t } = useApp();
  const {
    progressMap,
    setChapterStatus,
    setChapterPracticeStatus,
    toggleTopicCompletion,
  } = useProgress();
  const { isBookmarked, toggleBookmark } = useMaterials();
  const [chapterBmHint, setChapterBmHint] = useState(false);

  const validTrack =
    examTrack === 'up-board-12' || examTrack === 'jee-main' || examTrack === 'jee-advanced'
      ? examTrack
      : null;

  const found =
    validTrack && subjectId && chapterId
      ? getChapterById(validTrack, subjectId, chapterId)
      : undefined;

  const buckets = useMemo(
    () =>
      validTrack && found
        ? groupChapterMaterials(
            STUDY_MATERIALS_CATALOG,
            validTrack,
            found.subject.id,
            found.chapter.id
          )
        : null,
    [validTrack, found]
  );

  if (!validTrack || !found) {
    return <Navigate to="/up-board-class-12" replace />;
  }

  const { subject, chapter } = found;
  const prog = getChapterProgress(progressMap, validTrack, subject.id, chapter.id);
  const completedSet = new Set(prog.completedTopicIds);
  const chapterSaved = isBookmarked('chapter', chapter.id);

  const nonEmptySections = buckets
    ? [
        { key: 'notes', label: t('chapterMaterials.bucket.notes'), items: buckets.chapterNotes },
        { key: 'formulas', label: t('chapterMaterials.bucket.formulas'), items: buckets.formulaSheets },
        { key: 'revision', label: t('chapterMaterials.bucket.revision'), items: buckets.revisionNotes },
        { key: 'textbooks', label: t('chapterMaterials.bucket.textbooks'), items: buckets.textbooks },
        { key: 'pyqs', label: t('chapterMaterials.bucket.pyqs'), items: buckets.previousYearPapers },
        { key: 'samples', label: t('chapterMaterials.bucket.samples'), items: buckets.sampleAndModelQuestions },
        { key: 'videos', label: t('chapterMaterials.bucket.videos'), items: buckets.videoLectures },
        { key: 'other', label: t('chapterMaterials.bucket.other'), items: buckets.otherResources },
      ].filter((sec) => sec.items.length > 0)
    : [];

  return (
    <div className="space-y-6">
      <GuestSaveBanner />

      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <Link
          to={`/syllabus/${validTrack}/${subject.id}`}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('syllabus.backToSubject', { subject: subject.name[language] })}</span>
        </Link>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="text-slate-600 dark:text-slate-400">
          {t(TRACK_LABELS[validTrack])}
        </span>
      </div>

      {/* Chapter Overview & Status Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {subject.name[language]} · Unit {chapter.unitNumber} · ~{chapter.estimatedHours}h
              {chapter.weightageLabel ? ` · ${chapter.weightageLabel[language]}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {chapter.order}. {chapter.title[language]}
              </h1>
              <button
                type="button"
                onClick={async () => {
                  const res = await toggleBookmark({
                    itemType: 'chapter',
                    itemId: chapter.id,
                    examTrack: validTrack,
                  });
                  setChapterBmHint(Boolean(res.requiresAuth));
                }}
                aria-pressed={chapterSaved}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                  chapterSaved
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${chapterSaved ? 'fill-current' : ''}`} aria-hidden="true" />
                <span>
                  {chapterSaved
                    ? t('materials.action.savedBookmark')
                    : t('materials.action.saveBookmark')}
                </span>
              </button>
            </div>
            {chapterBmHint && (
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                <Link to="/login" className="underline">
                  {t('materials.action.signInToBookmark')}
                </Link>
              </p>
            )}
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {chapter.overview[language]}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:min-w-[200px] dark:border-slate-800 dark:bg-slate-800/40">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('syllabus.progressLabel')}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
              {prog.completionPercent}%
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${prog.completionPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Status & Practice Controls */}
        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2 dark:border-slate-800">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('syllabus.markStatusLabel')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map((st) => {
                const active = prog.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void setChapterStatus(chapter, st)}
                    aria-pressed={active}
                    className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t(`syllabus.status.${st}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('syllabus.practice.label')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRACTICE_STATUSES.map((ps) => {
                const active = prog.practiceStatus === ps;
                return (
                  <button
                    key={ps}
                    type="button"
                    onClick={() => void setChapterPracticeStatus(chapter, ps)}
                    aria-pressed={active}
                    className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t(`syllabus.practice.${ps}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {chapter.studyGuideNote && (
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">
                {t('syllabus.studyGuideLabel')}:{' '}
              </span>
              {chapter.studyGuideNote[language]}
            </div>
          </div>
        )}
      </section>

      {/* Topics & Subtopics Interactive Checklist */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {t('syllabus.topicsHeading')}
          </h2>
          <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
            {prog.completedTopicIds.filter((id) => chapter.topics.some((tp) => tp.id === id)).length}/
            {chapter.topics.length}
          </span>
        </div>

        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {chapter.topics.map((topic) => {
            const checked = completedSet.has(topic.id);
            return (
              <li key={topic.id} className="py-3.5 first:pt-1 last:pb-1">
                <button
                  type="button"
                  onClick={() => void toggleTopicCompletion(chapter, topic.id)}
                  aria-pressed={checked}
                  className="flex w-full items-start gap-3 text-left group"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white group-hover:border-blue-500 dark:border-slate-600 dark:bg-slate-800'
                    }`}
                  >
                    {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          checked
                            ? 'text-slate-500 line-through dark:text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {topic.title[language]}
                      </span>
                      {topic.inclusionStatus === 'advanced_only' && (
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          · {t('syllabus.advancedRetainedTag')}
                        </span>
                      )}
                      {topic.verificationStatus === 'awaiting_verification' && (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          · {t('syllabus.verification.awaiting')}
                        </span>
                      )}
                    </div>

                    {topic.subtopics.length > 0 && (
                      <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {topic.subtopics.map((st, sIdx) => (
                          <li key={sIdx}>— {st[language]}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Real Connected Study Materials & Video Lectures (Prompt 3) */}
      <section
        aria-labelledby="chapter-materials-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="chapter-materials-heading"
              className="font-display text-base font-bold text-slate-900 dark:text-white"
            >
              {t('chapterMaterials.heading')}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t('syllabus.studyMaterialsDesc')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/pdf-library?exam=${validTrack}&subject=${subject.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('syllabus.openPdfLibrary')}</span>
            </Link>
            <Link
              to="/video-lectures"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <PlayCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('syllabus.openVideoLectures')}</span>
            </Link>
          </div>
        </div>

        {nonEmptySections.length > 0 ? (
          <div className="space-y-5">
            {nonEmptySections.map((sec) => (
              <div key={sec.key} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {sec.label} ({sec.items.length})
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {sec.items.map((mat) => (
                    <MaterialCard key={mat.id} material={mat} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            title={t('chapterMaterials.emptyTitle')}
            body={t('chapterMaterials.emptyBody')}
            actionLabel={t('syllabus.openPdfLibrary')}
            actionTo={`/pdf-library?exam=${validTrack}&subject=${subject.id}`}
          />
        )}
      </section>

      {/* Prompt 4 Chapter Practice, Question Bank & Chapter Quiz Actions */}
      <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {
              QUESTION_PUBLIC_CATALOG.filter(
                (q) => q.examTrack === validTrack && q.subjectId === subject.id && q.chapterId === chapter.id
              ).length
            }{' '}
            {language === 'hi' ? 'प्रश्न इस अध्याय में मैप किए गए हैं' : 'mapped chapter question(s)'}
          </p>
          <h2 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
            {t('syllabus.practiceSectionTitle')}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {t('syllabus.practiceSectionDesc')}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            to={`/practice?exam=${validTrack}&subject=${subject.id}&chapter=${chapter.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{language === 'hi' ? 'अध्याय अभ्यास शुरू करें' : 'Practice Chapter Questions'}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            to={`/quiz?exam=${validTrack}&subject=${subject.id}&chapter=${chapter.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span>{language === 'hi' ? 'अध्याय क्विज़ बनाएँ' : 'Chapter Quiz Builder'}</span>
          </Link>
          <Link
            to={`/question-bank?exam=${validTrack}&subject=${subject.id}&chapter=${chapter.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span>{language === 'hi' ? 'प्रश्न बैंक में देखें' : 'Browse Questions'}</span>
          </Link>
          <Link
            to={`/ai-assistant?tab=chat&exam=${validTrack}&subject=${subject.id}&chapter=${chapter.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{language === 'hi' ? 'AI ट्यूटर से पूछें' : 'Ask AI Tutor'}</span>
          </Link>
          <Link
            to={`/ai-assistant?tab=summary&exam=${validTrack}&subject=${subject.id}&chapter=${chapter.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span>{language === 'hi' ? 'अध्याय सारांश (AI)' : 'AI Chapter Summary'}</span>
          </Link>
          <Link
            to={`/ai-assistant?tab=quiz&exam=${validTrack}&subject=${subject.id}&chapter=${chapter.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span>{language === 'hi' ? 'AI क्विज़ बनाएँ' : 'Generate AI Quiz'}</span>
          </Link>
        </div>
      </section>

      <VerificationNotice verification={subject.verification} />
    </div>
  );
};

export default ChapterDetailPage;
