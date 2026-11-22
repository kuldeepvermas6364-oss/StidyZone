import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Flag,
  RotateCcw,
  Target,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { QuestionRenderer } from '../components/assessments/QuestionRenderer';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import {
  checkPracticeQuestionApi,
  fetchQuestionsApi,
} from '../services/assessments/assessmentApi';
import type {
  DifficultyLevel,
  QuestionAnswerKey,
  QuestionPublic,
  QuestionScoreDetail,
  StudentAnswerValue,
} from '../types/assessment';
import type { ExamTrack, LanguageCode } from '../types/database';

const PracticeModePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { language: appLanguage } = useApp();
  const { isAuthenticated, session } = useAuth();
  const {
    practiceHistory,
    isQuestionTagged,
    toggleQuestionTag,
    refreshAssessmentData,
  } = useAssessments();

  const initialIdsParam = searchParams.get('ids');
  const [displayLang, setDisplayLang] = useState<LanguageCode>(appLanguage);
  const [examTrack, setExamTrack] = useState<ExamTrack | 'all'>(
    (searchParams.get('exam') as ExamTrack) || 'all'
  );
  const [subjectId, setSubjectId] = useState<string>(searchParams.get('subject') || 'all');
  const [chapterId, setChapterId] = useState<string>(searchParams.get('chapter') || 'all');
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [mode, setMode] = useState<'standard' | 'retry_incorrect'>(
    searchParams.get('mode') === 'retry_incorrect' ? 'retry_incorrect' : 'standard'
  );

  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerValue>>({});
  const [checkedMap, setCheckedMap] = useState<
    Record<string, { evaluation: QuestionScoreDetail; answerKey: QuestionAnswerKey }>
  >({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    setDisplayLang(appLanguage);
  }, [appLanguage]);

  const availableSubjects = useMemo(() => {
    if (examTrack === 'all') return ALL_CURRICULUM_SUBJECTS;
    return ALL_CURRICULUM_SUBJECTS.filter((s) => s.examTrack === examTrack);
  }, [examTrack]);

  const availableChapters = useMemo(() => {
    if (subjectId === 'all') return [];
    const sub = ALL_CURRICULUM_SUBJECTS.find((s) => s.id === subjectId);
    return sub?.chapters ?? [];
  }, [subjectId]);

  const loadPracticeSet = useCallback(async () => {
    setLoading(true);
    setIndex(0);
    setSummaryOpen(false);
    try {
      const res = await fetchQuestionsApi(session, {
        examTrack: initialIdsParam ? 'all' : examTrack,
        subjectId: initialIdsParam ? 'all' : subjectId,
        chapterId: initialIdsParam ? 'all' : chapterId,
        difficulty: initialIdsParam ? 'all' : difficulty,
        attemptFilter: mode === 'retry_incorrect' && isAuthenticated ? 'incorrect' : 'all',
        page: 1,
        pageSize: 50,
      });

      let list = res.questions;
      if (initialIdsParam) {
        const idSet = new Set(initialIdsParam.split(',').map((s) => s.trim()).filter(Boolean));
        const matched = list.filter((q) => idSet.has(q.id));
        if (matched.length > 0) list = matched;
      }
      setQuestions(list.slice(0, 15));
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [session, initialIdsParam, examTrack, subjectId, chapterId, difficulty, mode, isAuthenticated]);

  useEffect(() => {
    void loadPracticeSet();
  }, [loadPracticeSet]);

  const currentQuestion = questions[index];
  const currentChecked = currentQuestion ? checkedMap[currentQuestion.id] : undefined;

  const handleCheckAnswer = async () => {
    if (!currentQuestion) return;
    setChecking(true);
    setCheckError(null);
    try {
      const res = await checkPracticeQuestionApi(session, {
        questionId: currentQuestion.id,
        answer: answers[currentQuestion.id] ?? {},
        markedForRevision: isQuestionTagged(currentQuestion.id, 'revision'),
        savedDifficult: isQuestionTagged(currentQuestion.id, 'difficult'),
      });
      setCheckedMap((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          evaluation: res.evaluation,
          answerKey: res.answerKey,
        },
      }));
      if (res.persisted) {
        void refreshAssessmentData();
      }
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Unable to check answer');
    } finally {
      setChecking(false);
    }
  };

  const sessionStats = useMemo(() => {
    const entries = Object.values(checkedMap);
    const correct = entries.filter((e) => e.evaluation.status === 'correct').length;
    const incorrect = entries.filter((e) => e.evaluation.status === 'incorrect').length;
    return { checkedCount: entries.length, correct, incorrect };
  }, [checkedMap]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/practice-tests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{displayLang === 'hi' ? 'अभ्यास केंद्र पर लौटें' : 'Back to Practice & Tests Hub'}</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {(['en', 'hi'] as LanguageCode[]).map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => setDisplayLang(lng)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  displayLang === lng
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {lng === 'en' ? 'EN' : 'हिन्दी'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Practice Mode Selector Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {displayLang === 'hi' ? 'अभ्यास मोड (तत्काल उत्तर जाँच)' : 'Guided Practice Mode (Instant Feedback)'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Separate from timed exams · Immediate answer verification & step-by-step solutions.
            </p>
          </div>
          <div className="font-mono text-xs font-semibold text-blue-600 tabular-nums dark:text-blue-400">
            Session: {sessionStats.correct}/{sessionStats.checkedCount} Correct
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <select
            aria-label="Practice Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'standard' | 'retry_incorrect')}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="standard">Topic / Chapter Practice</option>
            <option value="retry_incorrect">Retry Incorrect Questions</option>
          </select>

          <select
            aria-label="Practice Exam Track"
            value={examTrack}
            onChange={(e) => {
              setExamTrack(e.target.value as ExamTrack | 'all');
              setSubjectId('all');
              setChapterId('all');
            }}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Exams</option>
            <option value="up-board-12">UP Board Class 12</option>
            <option value="jee-main">JEE Main</option>
            <option value="jee-advanced">JEE Advanced</option>
          </select>

          <select
            aria-label="Practice Subject"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setChapterId('all');
            }}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Subjects</option>
            {availableSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.examTrack.toUpperCase()} · {sub.name[displayLang]}
              </option>
            ))}
          </select>

          <select
            aria-label="Practice Chapter"
            value={chapterId}
            disabled={subjectId === 'all'}
            onChange={(e) => setChapterId(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Chapters</option>
            {availableChapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.order}. {ch.title[displayLang]}
              </option>
            ))}
          </select>

          <select
            aria-label="Practice Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyLevel | 'all')}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" aria-hidden="true" />}
          title={displayLang === 'hi' ? 'इस फ़िल्टर में कोई प्रश्न नहीं मिला' : 'No practice questions matched'}
          body={
            mode === 'retry_incorrect'
              ? 'You currently have no unanswered incorrect questions for retry. Switch to Standard Practice!'
              : 'Try broadening your exam, subject, or chapter filter.'
          }
          actionLabel="Switch to All Questions"
          onAction={() => {
            setMode('standard');
            setExamTrack('all');
            setSubjectId('all');
            setChapterId('all');
            setDifficulty('all');
          }}
        />
      ) : summaryOpen ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Practice Session Summary
          </h2>
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <p className="text-xs text-slate-500">Checked</p>
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                {sessionStats.checkedCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Correct</p>
              <p className="font-mono text-2xl font-bold text-emerald-600 tabular-nums">
                {sessionStats.correct}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Incorrect</p>
              <p className="font-mono text-2xl font-bold text-rose-600 tabular-nums">
                {sessionStats.incorrect}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setSummaryOpen(false);
                setIndex(0);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Review Questions</span>
            </button>
            <Link
              to="/practice-tests"
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100"
            >
              Return to Practice Hub
            </Link>
          </div>
        </section>
      ) : (
        currentQuestion && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className="font-mono text-xs font-bold text-slate-600 tabular-nums dark:text-slate-300">
                Question {index + 1} of {questions.length}
              </span>

              {isAuthenticated && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    aria-pressed={isQuestionTagged(currentQuestion.id, 'bookmark')}
                    onClick={() => void toggleQuestionTag(currentQuestion.id, 'bookmark')}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                      isQuestionTagged(currentQuestion.id, 'bookmark')
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{displayLang === 'hi' ? 'सहेजें' : 'Bookmark'}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={isQuestionTagged(currentQuestion.id, 'difficult')}
                    onClick={() => void toggleQuestionTag(currentQuestion.id, 'difficult')}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                      isQuestionTagged(currentQuestion.id, 'difficult')
                        ? 'border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{displayLang === 'hi' ? 'कठिन' : 'Difficult'}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={isQuestionTagged(currentQuestion.id, 'revision')}
                    onClick={() => void toggleQuestionTag(currentQuestion.id, 'revision')}
                    className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold ${
                      isQuestionTagged(currentQuestion.id, 'revision')
                        ? 'border-violet-600 bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {displayLang === 'hi' ? 'पुनरीक्षण हेतु' : 'Mark Revision'}
                  </button>
                </div>
              )}
            </div>

            <QuestionRenderer
              question={currentQuestion}
              language={displayLang}
              value={answers[currentQuestion.id]}
              onChange={(val) =>
                setAnswers((prev) => ({
                  ...prev,
                  [currentQuestion.id]: val,
                }))
              }
              disabled={Boolean(currentChecked)}
              answerKey={currentChecked?.answerKey}
              evaluation={currentChecked?.evaluation}
              showSolution={Boolean(currentChecked)}
            />

            {checkError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {checkError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (index < questions.length - 1) setIndex((i) => i + 1);
                    else setSummaryOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                >
                  <span>{index < questions.length - 1 ? 'Next Question' : 'Finish Summary'}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {!currentChecked ? (
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => void handleCheckAnswer()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {checking
                      ? displayLang === 'hi'
                        ? 'जाँच हो रही है...'
                        : 'Checking...'
                      : displayLang === 'hi'
                      ? 'उत्तर जाँचें'
                      : 'Check Answer'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (index < questions.length - 1) setIndex((i) => i + 1);
                    else setSummaryOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <span>{index < questions.length - 1 ? 'Continue Next' : 'View Session Summary'}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        )
      )}

      {/* Persisted Practice History */}
      {isAuthenticated && practiceHistory.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Recent Saved Practice Log ({practiceHistory.length})
          </h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {practiceHistory.slice(0, 6).map((item) => (
              <Link
                key={item.id}
                to={`/practice?ids=${item.questionId}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                    {item.questionId} · {item.chapterId}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {item.questionType} · {item.attemptedAt.slice(0, 10)}
                  </p>
                </div>
                <span
                  className={`font-mono font-bold ${
                    item.isCorrect ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {item.isCorrect ? '✓' : '✕'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PracticeModePage;
