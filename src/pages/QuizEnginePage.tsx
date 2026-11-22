import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Eraser,
  LayoutGrid,
  LayoutList,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { QuestionRenderer } from '../components/assessments/QuestionRenderer';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import {
  autosaveAttemptApi,
  clearLocalAttemptDraft,
  fetchAttemptDetailsApi,
  readLocalAttemptDraft,
  saveLocalAttemptDraft,
  startAssessmentAttemptApi,
  submitAttemptApi,
} from '../services/assessments/assessmentApi';
import type {
  AssessmentAttempt,
  DifficultyLevel,
  QuestionPublic,
  QuizCategory,
  StudentAnswerValue,
} from '../types/assessment';
import type { ExamTrack, LanguageCode } from '../types/database';
import { isStudentAnswerProvided } from '../utils/examScoring';

function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

const QuizEnginePage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { language: appLanguage } = useApp();
  const { isAuthenticated, session } = useAuth();
  const { quizzes, refreshAssessmentData } = useAssessments();

  const [displayLang, setDisplayLang] = useState<LanguageCode>(appLanguage);
  useEffect(() => {
    setDisplayLang(appLanguage);
  }, [appLanguage]);

  // Custom Quiz Builder State
  const [builderTrack, setBuilderTrack] = useState<ExamTrack>(
    (searchParams.get('exam') as ExamTrack) || 'jee-main'
  );
  const [builderSubject, setBuilderSubject] = useState<string>(searchParams.get('subject') || 'all');
  const [builderChapter, setBuilderChapter] = useState<string>(searchParams.get('chapter') || 'all');
  const [builderDifficulty, setBuilderDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [builderType, setBuilderType] = useState<QuizCategory>('custom_quiz');
  const [builderCount, setBuilderCount] = useState<number>(5);
  const [builderDuration, setBuilderDuration] = useState<number>(15);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Active Runner State (when attemptId is set)
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerValue>>({});
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [markedIds, setMarkedIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [loadingRunner, setLoadingRunner] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmitFiredRef = useRef(false);

  const builderSubjects = useMemo(
    () => ALL_CURRICULUM_SUBJECTS.filter((s) => s.examTrack === builderTrack),
    [builderTrack]
  );

  const builderChapters = useMemo(() => {
    if (builderSubject === 'all') return [];
    return ALL_CURRICULUM_SUBJECTS.find((s) => s.id === builderSubject)?.chapters ?? [];
  }, [builderSubject]);

  // Load existing attempt if navigated to /quiz/play/:attemptId
  useEffect(() => {
    if (!attemptId) {
      setAttempt(null);
      return;
    }
    if (!isAuthenticated || !session) return;

    let cancelled = false;
    setLoadingRunner(true);
    autoSubmitFiredRef.current = false;

    fetchAttemptDetailsApi(session, attemptId)
      .then((res) => {
        if (cancelled) return;
        if (res.attempt.status === 'submitted') {
          navigate(`/exam-results/${res.attempt.id}`, { replace: true });
          return;
        }
        setAttempt(res.attempt);
        setQuestions(res.questions);

        // Merge local draft if newer than initial server answers
        const localDraft = readLocalAttemptDraft(session.user.uid, res.attempt.id);
        const mergedAnswers = localDraft
          ? { ...res.attempt.answers, ...localDraft.answers }
          : res.attempt.answers;
        const mergedVisited = localDraft?.visitedIds?.length
          ? Array.from(new Set([...res.attempt.visitedIds, ...localDraft.visitedIds]))
          : res.attempt.visitedIds;
        const mergedMarked = localDraft?.markedForReviewIds ?? res.attempt.markedForReviewIds;
        const idx = localDraft?.currentQuestionIndex ?? res.attempt.currentQuestionIndex ?? 0;

        setAnswers(mergedAnswers);
        setVisitedIds(mergedVisited);
        setMarkedIds(mergedMarked);
        setCurrentIdx(Math.min(Math.max(0, idx), Math.max(0, res.questions.length - 1)));
        setSecondsRemaining(Math.max(0, Math.floor((res.attempt.expiresAtServerMs - Date.now()) / 1000)));
      })
      .catch(() => {
        if (!cancelled) setStartError('Unable to load quiz attempt.');
      })
      .finally(() => {
        if (!cancelled) setLoadingRunner(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId, isAuthenticated, session, navigate]);

  const persistDraft = useCallback(
    (
      nextAnswers: Record<string, StudentAnswerValue>,
      nextVisited: string[],
      nextMarked: string[],
      nextIdx: number
    ) => {
      if (!attempt || !session) return;
      const spent = Math.max(0, attempt.durationSeconds - secondsRemaining);
      saveLocalAttemptDraft(session.user.uid, {
        attemptId: attempt.id,
        answers: nextAnswers,
        visitedIds: nextVisited,
        markedForReviewIds: nextMarked,
        currentQuestionIndex: nextIdx,
        timeSpentSeconds: spent,
        questionTimeSeconds: {},
        updatedAtMs: Date.now(),
      });
      void autosaveAttemptApi(session, attempt.id, {
        answers: nextAnswers,
        visitedIds: nextVisited,
        markedForReviewIds: nextMarked,
        currentQuestionIndex: nextIdx,
        timeSpentSeconds: spent,
      }).catch(() => {});
    },
    [attempt, session, secondsRemaining]
  );

  const handleFinalSubmit = useCallback(
    async (isAuto: boolean) => {
      if (!attempt || !session || submitting) return;
      setSubmitting(true);
      try {
        const spent = Math.max(1, attempt.durationSeconds - secondsRemaining);
        await submitAttemptApi(session, attempt.id, {
          answers,
          timeSpentSeconds: spent,
          autoSubmitted: isAuto,
        });
        clearLocalAttemptDraft(session.user.uid, attempt.id);
        await refreshAssessmentData();
        navigate(`/exam-results/${attempt.id}`, { replace: true });
      } catch (err) {
        setStartError(err instanceof Error ? err.message : 'Submission failed.');
        setSubmitting(false);
      }
    },
    [attempt, session, submitting, secondsRemaining, answers, refreshAssessmentData, navigate]
  );

  // Live countdown timer & zero-time auto-submit
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.floor((attempt.expiresAtServerMs - Date.now()) / 1000));
      setSecondsRemaining(rem);
      if (rem === 0 && !autoSubmitFiredRef.current) {
        autoSubmitFiredRef.current = true;
        void handleFinalSubmit(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, handleFinalSubmit]);

  const handleStartPresetQuiz = async (quizId: string) => {
    if (!isAuthenticated || !session) {
      navigate('/login?next=/quiz');
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const res = await startAssessmentAttemptApi(session, {
        kind: 'quiz',
        configId: quizId,
        forceNew: false,
      });
      await refreshAssessmentData();
      navigate(`/quiz/play/${res.attempt.id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Unable to start quiz.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartCustomQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !session) {
      navigate('/login?next=/quiz');
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const res = await startAssessmentAttemptApi(session, {
        kind: 'quiz',
        forceNew: true,
        customQuiz: {
          examTrack: builderTrack,
          quizType: builderType,
          subjectId: builderSubject,
          chapterId: builderChapter,
          difficulty: builderDifficulty,
          questionCount: builderCount,
          durationMinutes: builderDuration,
          title: {
            en: `${builderTrack.toUpperCase()} Timed Quiz (${builderCount} Questions)`,
            hi: `${builderTrack.toUpperCase()} समयबद्ध क्विज़ (${builderCount} प्रश्न)`,
          },
        },
      });
      await refreshAssessmentData();
      navigate(`/quiz/play/${res.attempt.id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'No questions matched custom builder filters.');
    } finally {
      setStarting(false);
    }
  };

  const updateAnswer = (qId: string, val: StudentAnswerValue) => {
    const nextAnswers = { ...answers, [qId]: val };
    const nextVisited = visitedIds.includes(qId) ? visitedIds : [...visitedIds, qId];
    setAnswers(nextAnswers);
    setVisitedIds(nextVisited);
    persistDraft(nextAnswers, nextVisited, markedIds, currentIdx);
  };

  const goToIndex = (targetIdx: number) => {
    const clamped = Math.max(0, Math.min(questions.length - 1, targetIdx));
    const qId = questions[clamped]?.id;
    const nextVisited = qId && !visitedIds.includes(qId) ? [...visitedIds, qId] : visitedIds;
    setCurrentIdx(clamped);
    setVisitedIds(nextVisited);
    persistDraft(answers, nextVisited, markedIds, clamped);
  };

  const toggleMarkReview = (qId: string) => {
    const nextMarked = markedIds.includes(qId)
      ? markedIds.filter((id) => id !== qId)
      : [...markedIds, qId];
    setMarkedIds(nextMarked);
    persistDraft(answers, visitedIds, nextMarked, currentIdx);
  };

  const clearResponse = (qId: string) => {
    const nextAnswers = { ...answers };
    delete nextAnswers[qId];
    setAnswers(nextAnswers);
    persistDraft(nextAnswers, visitedIds, markedIds, currentIdx);
  };

  // Summary counts for Submit Modal
  const summaryCounts = useMemo(() => {
    let answered = 0;
    questions.forEach((q) => {
      if (isStudentAnswerProvided(q.questionType, answers[q.id])) answered += 1;
    });
    return {
      total: questions.length,
      answered,
      unanswered: questions.length - answered,
      marked: markedIds.length,
    };
  }, [questions, answers, markedIds]);

  // ---------------------------------------------------------------------------
  // Active Quiz Runner View
  // ---------------------------------------------------------------------------
  if (attemptId) {
    if (!isAuthenticated) {
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Please sign in to resume your saved timed quiz.
          </p>
          <Link
            to={`/login?next=/quiz/play/${attemptId}`}
            className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white"
          >
            Sign In
          </Link>
        </section>
      );
    }

    if (loadingRunner || !attempt) {
      return (
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      );
    }

    const currentQ = questions[currentIdx];

    return (
      <div className="space-y-5">
        {/* Top Timer & Mode Bar */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {attempt.examTrack.toUpperCase()} · Timed Quiz
            </p>
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {attempt.title[displayLang]}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span aria-live="polite">{formatCountdown(secondsRemaining)}</span>
            </div>

            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                  viewMode === 'single'
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Single</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                  viewMode === 'all'
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span>All</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDisplayLang((l) => (l === 'en' ? 'hi' : 'en'))}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              {displayLang === 'en' ? 'हिन्दी' : 'EN'}
            </button>

            <button
              type="button"
              onClick={() => setSubmitModalOpen(true)}
              className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Submit Quiz
            </button>
          </div>
        </section>

        {/* Single-Question vs All-Questions View */}
        {viewMode === 'all' ? (
          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <section
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  <span>Question {qIndex + 1} of {questions.length}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleMarkReview(q.id)}
                      className={`rounded-md px-2 py-1 text-xs ${
                        markedIds.includes(q.id)
                          ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {markedIds.includes(q.id) ? '★ Marked Review' : 'Mark Review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => clearResponse(q.id)}
                      className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <QuestionRenderer
                  question={q}
                  language={displayLang}
                  value={answers[q.id]}
                  onChange={(val) => updateAnswer(q.id, val)}
                  optionSeed={attempt.optionSeed}
                  shuffleOptions
                />
              </section>
            ))}
          </div>
        ) : (
          currentQ && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 lg:col-span-9 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                    Question {currentIdx + 1} of {questions.length}
                  </span>
                  {markedIds.includes(currentQ.id) && (
                    <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                      ★ Marked for Review
                    </span>
                  )}
                </div>

                <QuestionRenderer
                  question={currentQ}
                  language={displayLang}
                  value={answers[currentQ.id]}
                  onChange={(val) => updateAnswer(currentQ.id, val)}
                  optionSeed={attempt.optionSeed}
                  shuffleOptions
                />

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleMarkReview(currentQ.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 text-xs font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                    >
                      <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{markedIds.includes(currentQ.id) ? 'Unmark Review' : 'Mark for Review'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => clearResponse(currentQ.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Clear Response</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentIdx === 0}
                      onClick={() => goToIndex(currentIdx - 1)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Prev</span>
                    </button>
                    {currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => goToIndex(currentIdx + 1)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <span>Next</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSubmitModalOpen(true)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <span>Review & Submit</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <aside className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-3 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Quiz Navigator
                </h2>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const ans = isStudentAnswerProvided(q.questionType, answers[q.id]);
                    const rev = markedIds.includes(q.id);
                    const active = idx === currentIdx;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToIndex(idx)}
                        aria-label={`Jump to question ${idx + 1}`}
                        className={`h-9 rounded-lg border font-mono text-xs font-bold transition-colors ${
                          active ? 'ring-2 ring-blue-600 ring-offset-1 ' : ''
                        }${
                          ans && rev
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : rev
                            ? 'border-violet-600 bg-violet-600 text-white'
                            : ans
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Autosave active · Reload-safe draft recovery enabled.
                </p>
              </aside>
            </div>
          )
        )}

        {/* Submit Confirmation Modal */}
        {submitModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-submit-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 id="quiz-submit-modal-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Confirm Quiz Submission
              </h2>
              <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                <p>Total: <strong>{summaryCounts.total}</strong></p>
                <p>Answered: <strong className="text-emerald-600">{summaryCounts.answered}</strong></p>
                <p>Unanswered: <strong className="text-rose-600">{summaryCounts.unanswered}</strong></p>
                <p>Marked Review: <strong className="text-violet-600">{summaryCounts.marked}</strong></p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Continue Quiz
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleFinalSubmit(false)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{submitting ? 'Submitting...' : 'Submit & Score'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Quiz Presets & Custom Builder Lobby
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/practice-tests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{displayLang === 'hi' ? 'अभ्यास केंद्र पर लौटें' : 'Back to Practice & Tests Hub'}</span>
        </Link>
      </div>

      {startError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{startError}</span>
        </div>
      )}

      {/* Curated Timed Quizzes */}
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {displayLang === 'hi' ? 'क्विज़ इंजन (समयबद्ध अभ्यास)' : 'Quiz Engine & Curated Sprints'}
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Daily, chapter, subject, and revision timed quizzes with automatic scoring and draft autosave.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((qz) => (
            <article
              key={qz.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {qz.examTrack.toUpperCase()} · {qz.quizType.replace('_', ' ').toUpperCase()}
                </p>
                <h2 className="mt-1.5 font-display text-base font-bold text-slate-900 dark:text-white">
                  {qz.title[displayLang]}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {qz.description[displayLang]}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {qz.questionCount} Qs · {qz.durationMinutes} min
                </span>
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => void handleStartPresetQuiz(qz.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isAuthenticated ? 'Start Quiz' : 'Sign In to Start'}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Custom Quiz Builder */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Custom Quiz Builder
          </h2>
        </div>

        <form onSubmit={(e) => void handleStartCustomQuiz(e)} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Exam Track</label>
            <select
              value={builderTrack}
              onChange={(e) => {
                setBuilderTrack(e.target.value as ExamTrack);
                setBuilderSubject('all');
                setBuilderChapter('all');
              }}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="up-board-12">UP Board Class 12</option>
              <option value="jee-main">JEE Main</option>
              <option value="jee-advanced">JEE Advanced</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject</label>
            <select
              value={builderSubject}
              onChange={(e) => {
                setBuilderSubject(e.target.value);
                setBuilderChapter('all');
              }}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">All Track Subjects (Mixed)</option>
              {builderSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name[displayLang]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chapter</label>
            <select
              value={builderChapter}
              disabled={builderSubject === 'all'}
              onChange={(e) => setBuilderChapter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">All Chapters</option>
              {builderChapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.order}. {ch.title[displayLang]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quiz Type</label>
            <select
              value={builderType}
              onChange={(e) => setBuilderType(e.target.value as QuizCategory)}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="custom_quiz">Custom Quiz</option>
              <option value="chapter_quiz">Chapter Quiz</option>
              <option value="topic_quiz">Topic Quiz</option>
              <option value="subject_quiz">Subject Quiz</option>
              <option value="revision_quiz">Revision Quiz</option>
              <option value="mixed_quiz">Mixed Quiz</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Difficulty</label>
            <select
              value={builderDifficulty}
              onChange={(e) => setBuilderDifficulty(e.target.value as DifficultyLevel | 'all')}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">Balanced Mix</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Questions</label>
              <input
                type="number"
                min={1}
                max={30}
                value={builderCount}
                onChange={(e) => setBuilderCount(Math.max(1, Math.min(30, Number(e.target.value) || 5)))}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Minutes</label>
              <input
                type="number"
                min={5}
                max={180}
                value={builderDuration}
                onChange={(e) => setBuilderDuration(Math.max(5, Math.min(180, Number(e.target.value) || 15)))}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={starting}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>{starting ? 'Starting Quiz...' : 'Launch Custom Timed Quiz'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default QuizEnginePage;
