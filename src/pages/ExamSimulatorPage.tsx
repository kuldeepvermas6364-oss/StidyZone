import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Eraser,
  Info,
  LayoutGrid,
  MonitorPlay,
  Play,
  X,
} from 'lucide-react';
import { QuestionRenderer } from '../components/assessments/QuestionRenderer';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';
import {
  autosaveAttemptApi,
  clearLocalAttemptDraft,
  readLocalAttemptDraft,
  saveLocalAttemptDraft,
  startAssessmentAttemptApi,
  submitAttemptApi,
} from '../services/assessments/assessmentApi';
import type {
  AssessmentAttempt,
  ExamConfiguration,
  QuestionPublic,
  StudentAnswerValue,
} from '../types/assessment';
import type { LanguageCode } from '../types/database';
import { isStudentAnswerProvided } from '../utils/examScoring';

type NtaStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_review'
  | 'answered_marked';

function getNtaStatus(
  q: QuestionPublic,
  answers: Record<string, StudentAnswerValue>,
  visitedIds: string[],
  markedIds: string[]
): NtaStatus {
  const answered = isStudentAnswerProvided(q.questionType, answers[q.id]);
  const visited = visitedIds.includes(q.id);
  const marked = markedIds.includes(q.id);

  if (answered && marked) return 'answered_marked';
  if (marked) return 'marked_review';
  if (answered) return 'answered';
  if (visited) return 'not_answered';
  return 'not_visited';
}

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const ExamSimulatorPage: React.FC = () => {
  const { configId } = useParams<{ configId?: string }>();
  const navigate = useNavigate();

  const { language: appLanguage } = useApp();
  const { isAuthenticated, session } = useAuth();
  const { examConfigurations, refreshAssessmentData } = useAssessments();

  const [displayLang, setDisplayLang] = useState<LanguageCode>(appLanguage);
  useEffect(() => {
    setDisplayLang(appLanguage);
  }, [appLanguage]);

  const selectedConfig: ExamConfiguration | undefined = useMemo(
    () => examConfigurations.find((c) => c.id === configId),
    [examConfigurations, configId]
  );

  // Active exam runtime state
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerValue>>({});
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [markedIds, setMarkedIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const [loadingStart, setLoadingStart] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmitRef = useRef(false);

  const beginOrResumeExam = useCallback(
    async (cfg: ExamConfiguration, forceNew = false) => {
      if (!isAuthenticated || !session) {
        navigate(`/login?next=/exam-simulator/${cfg.id}`);
        return;
      }
      setLoadingStart(true);
      setErrorMsg(null);
      autoSubmitRef.current = false;

      try {
        const res = await startAssessmentAttemptApi(session, {
          kind: cfg.mode === 'up_board_descriptive' ? 'up_board_exam' : 'cbt_mock',
          configId: cfg.id,
          forceNew,
        });
        const localDraft = readLocalAttemptDraft(session.user.uid, res.attempt.id);
        const mergedAnswers = localDraft
          ? { ...res.attempt.answers, ...localDraft.answers }
          : res.attempt.answers;
        const mergedVisited = localDraft?.visitedIds?.length
          ? Array.from(new Set([...res.attempt.visitedIds, ...localDraft.visitedIds]))
          : res.attempt.visitedIds;
        const mergedMarked = localDraft?.markedForReviewIds ?? res.attempt.markedForReviewIds;
        const startIdx = localDraft?.currentQuestionIndex ?? res.attempt.currentQuestionIndex ?? 0;

        setAttempt(res.attempt);
        setQuestions(res.questions);
        setAnswers(mergedAnswers);
        setVisitedIds(mergedVisited);
        setMarkedIds(mergedMarked);
        setCurrentIdx(Math.min(Math.max(0, startIdx), Math.max(0, res.questions.length - 1)));
        setSecondsRemaining(Math.max(0, Math.floor((res.attempt.expiresAtServerMs - Date.now()) / 1000)));
        void refreshAssessmentData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to start exam.');
      } finally {
        setLoadingStart(false);
      }
    },
    [isAuthenticated, session, navigate, refreshAssessmentData]
  );

  // Auto-initialize when navigated directly to /exam-simulator/:configId
  useEffect(() => {
    if (!selectedConfig) {
      setAttempt(null);
      return;
    }
    if (attempt?.configId === selectedConfig.id) return;
    if (isAuthenticated && session) {
      void beginOrResumeExam(selectedConfig, false);
    }
  }, [selectedConfig, attempt?.configId, isAuthenticated, session, beginOrResumeExam]);

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

  const handleSubmitExam = useCallback(
    async (autoSubmitted: boolean) => {
      if (!attempt || !session || submitting) return;
      setSubmitting(true);
      try {
        const spent = Math.max(1, attempt.durationSeconds - secondsRemaining);
        await submitAttemptApi(session, attempt.id, {
          answers,
          timeSpentSeconds: spent,
          autoSubmitted,
        });
        clearLocalAttemptDraft(session.user.uid, attempt.id);
        await refreshAssessmentData();
        navigate(`/exam-results/${attempt.id}`, { replace: true });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Submission failed.');
        setSubmitting(false);
      }
    },
    [attempt, session, submitting, secondsRemaining, answers, refreshAssessmentData, navigate]
  );

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.floor((attempt.expiresAtServerMs - Date.now()) / 1000));
      setSecondsRemaining(rem);
      if (rem === 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        void handleSubmitExam(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, handleSubmitExam]);

  const navigateToQuestion = (targetIdx: number) => {
    const clamped = Math.max(0, Math.min(questions.length - 1, targetIdx));
    const qId = questions[clamped]?.id;
    const nextVisited = qId && !visitedIds.includes(qId) ? [...visitedIds, qId] : visitedIds;
    setCurrentIdx(clamped);
    setVisitedIds(nextVisited);
    setMobilePaletteOpen(false);
    persistDraft(answers, nextVisited, markedIds, clamped);
  };

  const updateAnswer = (qId: string, val: StudentAnswerValue) => {
    const nextAnswers = { ...answers, [qId]: val };
    const nextVisited = visitedIds.includes(qId) ? visitedIds : [...visitedIds, qId];
    setAnswers(nextAnswers);
    setVisitedIds(nextVisited);
    persistDraft(nextAnswers, nextVisited, markedIds, currentIdx);
  };

  const handleSaveAndNext = () => {
    const currentQ = questions[currentIdx];
    if (currentQ) {
      // Ensure unmarking if user chose Save & Next explicitly? NTA keeps review if only Mark & Next was clicked, clears or leaves.
      persistDraft(answers, visitedIds, markedIds, currentIdx);
    }
    if (currentIdx < questions.length - 1) {
      navigateToQuestion(currentIdx + 1);
    } else {
      setSubmitModalOpen(true);
    }
  };

  const handleSaveAndMarkForReview = () => {
    const currentQ = questions[currentIdx];
    if (!currentQ) return;
    const nextMarked = markedIds.includes(currentQ.id) ? markedIds : [...markedIds, currentQ.id];
    setMarkedIds(nextMarked);
    persistDraft(answers, visitedIds, nextMarked, currentIdx);
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      const nextQId = questions[nextIdx]?.id;
      const nextVisited = nextQId && !visitedIds.includes(nextQId) ? [...visitedIds, nextQId] : visitedIds;
      setCurrentIdx(nextIdx);
      setVisitedIds(nextVisited);
    }
  };

  const handleClearResponse = () => {
    const currentQ = questions[currentIdx];
    if (!currentQ) return;
    const nextAnswers = { ...answers };
    delete nextAnswers[currentQ.id];
    setAnswers(nextAnswers);
    persistDraft(nextAnswers, visitedIds, markedIds, currentIdx);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<NtaStatus, number> = {
      not_visited: 0,
      not_answered: 0,
      answered: 0,
      marked_review: 0,
      answered_marked: 0,
    };
    questions.forEach((q) => {
      counts[getNtaStatus(q, answers, visitedIds, markedIds)] += 1;
    });
    return counts;
  }, [questions, answers, visitedIds, markedIds]);

  const subjectTabs = useMemo(() => {
    const seen = new Map<string, number>();
    questions.forEach((q, idx) => {
      if (!seen.has(q.subjectId)) seen.set(q.subjectId, idx);
    });
    return Array.from(seen.entries()).map(([subjectId, firstIndex]) => ({
      subjectId,
      firstIndex,
    }));
  }, [questions]);

  // ---------------------------------------------------------------------------
  // 1. Exam Lobby (Selector) when no :configId is chosen
  // ---------------------------------------------------------------------------
  if (!configId || !selectedConfig) {
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            NTA CBT Simulator & UP Board Descriptive Exam Runner
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {displayLang === 'hi' ? 'पूर्ण मॉक टेस्ट व बोर्ड परीक्षा सिम्युलेटर' : 'Exam Simulator & Board Mock Tests'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Choose a configurable JEE Main/Advanced CBT mock paper or a UP Board Class 12 Descriptive+Objective paper.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {examConfigurations.map((cfg) => (
            <article
              key={cfg.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {cfg.examTrack.toUpperCase()} · {cfg.patternBadge[displayLang]}
                </p>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {cfg.title[displayLang]}
                </h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {cfg.subtitle[displayLang]}
                </p>
                <div className="flex flex-wrap gap-3 pt-1 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  <span>{cfg.durationMinutes} Minutes</span>
                  <span>·</span>
                  <span>{cfg.totalMarks} Total Marks</span>
                  <span>·</span>
                  <span>{cfg.questionIds?.length ?? 0} Questions</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <Link
                  to={`/exam-simulator/${cfg.id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {cfg.mode === 'up_board_descriptive'
                      ? displayLang === 'hi'
                        ? 'बोर्ड पेपर शुरू करें'
                        : 'Open Board Exam Interface'
                      : displayLang === 'hi'
                      ? 'CBT सिम्युलेटर शुरू करें'
                      : 'Launch CBT Simulator'}
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // Auth Gate inside Exam Launch
  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <MonitorPlay className="mx-auto h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Sign in to launch {selectedConfig.title[displayLang]}
        </h1>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Timed exams use server-anchored timers, autosave drafts, and secure server-side scoring per student account.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            to={`/login?next=/exam-simulator/${selectedConfig.id}`}
            className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white"
          >
            Sign In & Start
          </Link>
          <Link
            to="/exam-simulator"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Back
          </Link>
        </div>
      </section>
    );
  }

  if (loadingStart || !attempt) {
    return (
      <div className="space-y-4 p-6">
        {errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            {errorMsg}
          </div>
        ) : (
          <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  const PaletteBody = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
          Question Palette ({questions.length})
        </h2>
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {statusCounts.answered}/{questions.length} Answered
        </span>
      </div>

      {/* Explicit Symbol + Text Legend (Accessible, Zero Hue-Only Signaling) */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white font-mono text-[10px] font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            ○
          </span>
          <span className="truncate">Not Visited ({statusCounts.not_visited})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-rose-500 bg-rose-50 font-mono text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            !
          </span>
          <span className="truncate">Not Answered ({statusCounts.not_answered})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 font-mono text-[10px] font-bold text-white">
            ✓
          </span>
          <span className="truncate">Answered ({statusCounts.answered})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-violet-600 font-mono text-[10px] font-bold text-white">
            ★
          </span>
          <span className="truncate">Marked Review ({statusCounts.marked_review})</span>
        </div>
        <div className="col-span-2 flex items-center gap-1.5">
          <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-blue-600 font-mono text-[10px] font-bold text-white">
            ✓★
          </span>
          <span className="truncate">
            Answered & Marked for Review ({statusCounts.answered_marked})
          </span>
        </div>
      </div>

      {/* Question Number Buttons */}
      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, idx) => {
          const st = getNtaStatus(q, answers, visitedIds, markedIds);
          const isCurrent = idx === currentIdx;
          const badge =
            st === 'answered_marked'
              ? '✓★'
              : st === 'answered'
              ? '✓'
              : st === 'marked_review'
              ? '★'
              : st === 'not_answered'
              ? '!'
              : '';
          const styleClass =
            st === 'answered_marked'
              ? 'border-blue-600 bg-blue-600 text-white'
              : st === 'answered'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : st === 'marked_review'
              ? 'border-violet-600 bg-violet-600 text-white'
              : st === 'not_answered'
              ? 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
              : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => navigateToQuestion(idx)}
              aria-label={`Question ${idx + 1} (${st.replace('_', ' ')})`}
              className={`relative flex h-10 flex-col items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors ${
                isCurrent ? 'ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-slate-900 ' : ''
              }${styleClass}`}
            >
              <span>{idx + 1}</span>
              {badge && (
                <span className="text-[9px] leading-none opacity-90" aria-hidden="true">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // 2. Full-Screen Distraction-Free CBT / UP Board Board Paper Runner
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top CBT Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            {selectedConfig.patternBadge[displayLang]}
          </p>
          <h1 className="truncate font-display text-sm font-bold sm:text-base">
            {selectedConfig.title[displayLang]}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm font-bold tabular-nums dark:border-slate-700 dark:bg-slate-800">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span aria-live="polite">{formatHms(secondsRemaining)}</span>
          </div>

          <button
            type="button"
            onClick={() => setDisplayLang((l) => (l === 'en' ? 'hi' : 'en'))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
          >
            {displayLang === 'en' ? 'हिन्दी' : 'EN'}
          </button>

          <button
            type="button"
            onClick={() => setInstructionsOpen(true)}
            aria-label="Exam Instructions"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
          >
            <Info className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span className="hidden sm:inline">Instructions</span>
          </button>

          <button
            type="button"
            onClick={() => setMobilePaletteOpen(true)}
            aria-label="Open Question Palette"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 lg:hidden dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Palette</span>
          </button>

          <button
            type="button"
            onClick={() => setSubmitModalOpen(true)}
            className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Submit Exam
          </button>
        </div>
      </header>

      {/* Subject / Section Navigation Tabs */}
      {subjectTabs.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 whitespace-nowrap">Sections:</span>
          {subjectTabs.map((tab) => {
            const active = currentQuestion?.subjectId === tab.subjectId;
            return (
              <button
                key={tab.subjectId}
                type="button"
                onClick={() => navigateToQuestion(tab.firstIndex)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {tab.subjectId.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Split CBT Area */}
      <div className="flex-1 overflow-hidden lg:grid lg:grid-cols-12">
        {/* Left/Center Question Stage */}
        <main className="h-full overflow-y-auto p-4 sm:p-6 lg:col-span-8 xl:col-span-9">
          {currentQuestion && (
            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  +{currentQuestion.marks}
                  {currentQuestion.negativeMarks > 0
                    ? ` / -${currentQuestion.negativeMarks} Negative`
                    : ' · No Negative Marking'}
                </span>
              </div>

              <QuestionRenderer
                question={currentQuestion}
                language={displayLang}
                value={answers[currentQuestion.id]}
                onChange={(val) => updateAnswer(currentQuestion.id, val)}
                optionSeed={attempt.optionSeed}
                shuffleOptions={selectedConfig.shuffleOptions}
              />

              {/* CBT Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAndMarkForReview}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-3.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                  >
                    <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Save & Mark for Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearResponse}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Eraser className="h-4 w-4" aria-hidden="true" />
                    <span>Clear Response</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentIdx === 0}
                    onClick={() => navigateToQuestion(currentIdx - 1)}
                    className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndNext}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <span>
                      {currentIdx < questions.length - 1 ? 'Save & Next' : 'Save & Review Submit'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Desktop Sticky Right NTA Palette */}
        <aside className="hidden h-full overflow-y-auto border-l border-slate-200 bg-white p-5 lg:col-span-4 lg:block xl:col-span-3 dark:border-slate-800 dark:bg-slate-900">
          {PaletteBody}
        </aside>
      </div>

      {/* Mobile Collapsible Question Palette Drawer */}
      {mobilePaletteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Question Palette"
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 lg:hidden"
        >
          <div className="h-full w-full max-w-xs overflow-y-auto bg-white p-5 space-y-4 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="font-display text-sm font-bold">Question Palette</span>
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                aria-label="Close Question Palette"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {PaletteBody}
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {instructionsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-inst-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 id="exam-inst-title" className="font-display text-base font-bold">
              Exam Instructions & Marking Rules
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
              <li>Duration: {selectedConfig.durationMinutes} minutes · Total Marks: {selectedConfig.totalMarks}.</li>
              <li>Answers autosave locally and to the server on navigation. Reloading resumes automatically.</li>
              <li>Items marked &ldquo;Answered &amp; Marked for Review (✓★)&rdquo; are evaluated if an answer is present.</li>
              <li>The exam submits automatically when the countdown reaches 00:00:00.</li>
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInstructionsOpen(false)}
                className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white"
              >
                Resume Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {submitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cbt-submit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <h2 id="cbt-submit-title" className="font-display text-base font-bold">
                  Submit Final Exam?
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Once submitted, responses are locked and scored on the server.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/40">
              <p>Answered (✓): <strong className="text-emerald-600">{statusCounts.answered}</strong></p>
              <p>Ans &amp; Review (✓★): <strong className="text-blue-600">{statusCounts.answered_marked}</strong></p>
              <p>Not Answered (!): <strong className="text-rose-600">{statusCounts.not_answered}</strong></p>
              <p>Not Visited (○): <strong>{statusCounts.not_visited}</strong></p>
            </div>

            {errorMsg && <p className="text-xs font-semibold text-rose-600">{errorMsg}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Back to Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitExam(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{submitting ? 'Scoring...' : 'Confirm & Submit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSimulatorPage;
