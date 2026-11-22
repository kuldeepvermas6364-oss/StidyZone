import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EXAM_CONFIGURATIONS, QUIZ_CATALOG } from '../data/assessments/examConfigurations';
import { QUESTION_PUBLIC_CATALOG } from '../data/assessments/questionBankCatalog';
import {
  fetchAnalyticsApi,
  fetchConfigsApi,
  toggleQuestionBookmarkApi,
} from '../services/assessments/assessmentApi';
import type {
  AssessmentAttempt,
  ExamConfiguration,
  PracticeHistoryEntry,
  QuestionBookmarkItem,
  QuestionImportBatch,
  QuizDefinition,
  StudentPerformanceAnalytics,
} from '../types/assessment';
import { computeStudentAnalytics } from '../utils/weakTopics';
import { useAuth } from './AuthContext';

interface AssessmentContextValue {
  examConfigurations: ExamConfiguration[];
  quizzes: QuizDefinition[];
  importBatches: QuestionImportBatch[];
  totalQuestionCount: number;
  analytics: StudentPerformanceAnalytics;
  attempts: AssessmentAttempt[];
  practiceHistory: PracticeHistoryEntry[];
  questionBookmarks: QuestionBookmarkItem[];
  loading: boolean;
  isQuestionTagged: (questionId: string, tag: QuestionBookmarkItem['tag']) => boolean;
  toggleQuestionTag: (questionId: string, tag: QuestionBookmarkItem['tag']) => Promise<boolean>;
  refreshAssessmentData: () => Promise<void>;
}

const EMPTY_ANALYTICS = computeStudentAnalytics([], []);

const AssessmentContext = createContext<AssessmentContextValue | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, session } = useAuth();

  const [examConfigurations, setExamConfigurations] =
    useState<ExamConfiguration[]>(EXAM_CONFIGURATIONS);
  const [quizzes, setQuizzes] = useState<QuizDefinition[]>(QUIZ_CATALOG);
  const [importBatches, setImportBatches] = useState<QuestionImportBatch[]>([]);
  const [totalQuestionCount, setTotalQuestionCount] = useState<number>(
    QUESTION_PUBLIC_CATALOG.length
  );

  const [analytics, setAnalytics] = useState<StudentPerformanceAnalytics>(EMPTY_ANALYTICS);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistoryEntry[]>([]);
  const [questionBookmarks, setQuestionBookmarks] = useState<QuestionBookmarkItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshAssessmentData = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchConfigsApi();
      setExamConfigurations(cfg.examConfigurations);
      setQuizzes(cfg.quizzes);
      setImportBatches(cfg.importBatches);
      setTotalQuestionCount(cfg.totalQuestionCount);

      if (isAuthenticated && session) {
        const res = await fetchAnalyticsApi(session);
        setAnalytics(res.analytics);
        setAttempts(res.attempts);
        setPracticeHistory(res.practiceHistory);
        setQuestionBookmarks(res.questionBookmarks);
      } else {
        setAnalytics(EMPTY_ANALYTICS);
        setAttempts([]);
        setPracticeHistory([]);
        setQuestionBookmarks([]);
      }
    } catch {
      // Keep cached fallback configurations if offline
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, session]);

  useEffect(() => {
    void refreshAssessmentData();
  }, [refreshAssessmentData]);

  const isQuestionTagged = useCallback(
    (questionId: string, tag: QuestionBookmarkItem['tag']) =>
      questionBookmarks.some((b) => b.questionId === questionId && b.tag === tag),
    [questionBookmarks]
  );

  const toggleQuestionTag = useCallback(
    async (questionId: string, tag: QuestionBookmarkItem['tag']): Promise<boolean> => {
      if (!isAuthenticated || !session) return false;
      try {
        const res = await toggleQuestionBookmarkApi(session, { questionId, tag });
        setQuestionBookmarks(res.bookmarks);
        return res.saved;
      } catch {
        return false;
      }
    },
    [isAuthenticated, session]
  );

  const value = useMemo<AssessmentContextValue>(
    () => ({
      examConfigurations,
      quizzes,
      importBatches,
      totalQuestionCount,
      analytics,
      attempts,
      practiceHistory,
      questionBookmarks,
      loading,
      isQuestionTagged,
      toggleQuestionTag,
      refreshAssessmentData,
    }),
    [
      examConfigurations,
      quizzes,
      importBatches,
      totalQuestionCount,
      analytics,
      attempts,
      practiceHistory,
      questionBookmarks,
      loading,
      isQuestionTagged,
      toggleQuestionTag,
      refreshAssessmentData,
    ]
  );

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
};

export function useAssessments(): AssessmentContextValue {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessments must be used inside AssessmentProvider');
  return ctx;
}
