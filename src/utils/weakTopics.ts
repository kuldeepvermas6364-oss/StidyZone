import type {
  AssessmentAttempt,
  PracticeHistoryEntry,
  QuestionType,
  QuestionTypeDiagnostic,
  StudentPerformanceAnalytics,
  WeakTopicDiagnostic,
} from '../types/assessment';
import type { ExamTrack } from '../types/database';

interface AggregatedEvent {
  questionId: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  topicId: string;
  questionType: QuestionType;
  isCorrect: boolean;
  negativeDeducted: number;
  timestampMs: number;
}

export function computeStudentAnalytics(
  practiceHistory: readonly PracticeHistoryEntry[],
  submittedAttempts: readonly AssessmentAttempt[]
): StudentPerformanceAnalytics {
  const events: AggregatedEvent[] = [];

  for (const p of practiceHistory) {
    events.push({
      questionId: p.questionId,
      examTrack: p.examTrack,
      subjectId: p.subjectId,
      chapterId: p.chapterId,
      topicId: p.topicId,
      questionType: p.questionType,
      isCorrect: p.isCorrect,
      negativeDeducted: p.awardedMarks < 0 ? Math.abs(p.awardedMarks) : 0,
      timestampMs: Date.parse(p.attemptedAt) || 0,
    });
  }

  let quizzesCount = 0;
  let examsCount = 0;
  let scorePercentSum = 0;
  let scoredAttempts = 0;

  for (const attempt of submittedAttempts) {
    if (attempt.status !== 'submitted' || !attempt.result) continue;
    if (attempt.kind === 'quiz') quizzesCount += 1;
    else examsCount += 1;
    scorePercentSum += attempt.result.percentage;
    scoredAttempts += 1;

    for (const qRes of attempt.result.questionResults) {
      if (
        qRes.status === 'unanswered' ||
        qRes.status === 'pending_review'
      ) {
        continue;
      }
      const correct =
        qRes.status === 'correct' ||
        (qRes.status === 'self_evaluated' && qRes.awardedMarks >= qRes.maxMarks * 0.6);
      events.push({
        questionId: qRes.questionId,
        examTrack: attempt.examTrack,
        subjectId: qRes.subjectId,
        chapterId: qRes.chapterId,
        topicId: qRes.topicId,
        questionType: qRes.questionType,
        isCorrect: correct,
        negativeDeducted: qRes.negativeDeducted,
        timestampMs: attempt.submittedAtServerMs ?? attempt.startedAtServerMs,
      });
    }
  }

  events.sort((a, b) => a.timestampMs - b.timestampMs);

  const totalPracticeQuestions = practiceHistory.length;
  const totalGradedEvents = events.length;
  const totalCorrectEvents = events.filter((e) => e.isCorrect).length;
  const overallAccuracyPercent =
    totalGradedEvents > 0 ? Math.round((totalCorrectEvents / totalGradedEvents) * 100) : 0;
  const averageScorePercent =
    scoredAttempts > 0 ? Math.round((scorePercentSum / scoredAttempts) * 10) / 10 : 0;

  // Chapter breakdown
  const chapterAgg = new Map<
    string,
    { chapterId: string; subjectId: string; attempts: number; correct: number }
  >();
  // Topic breakdown
  const topicAgg = new Map<
    string,
    {
      topicId: string;
      chapterId: string;
      subjectId: string;
      examTrack: ExamTrack;
      events: AggregatedEvent[];
      negativeDrag: number;
    }
  >();
  // Question type breakdown
  const typeAgg = new Map<QuestionType, { attempts: number; correct: number }>();

  for (const ev of events) {
    const chKey = `${ev.subjectId}::${ev.chapterId}`;
    const ch = chapterAgg.get(chKey) ?? {
      chapterId: ev.chapterId,
      subjectId: ev.subjectId,
      attempts: 0,
      correct: 0,
    };
    ch.attempts += 1;
    if (ev.isCorrect) ch.correct += 1;
    chapterAgg.set(chKey, ch);

    const tKey = `${ev.chapterId}::${ev.topicId}`;
    const top = topicAgg.get(tKey) ?? {
      topicId: ev.topicId,
      chapterId: ev.chapterId,
      subjectId: ev.subjectId,
      examTrack: ev.examTrack,
      events: [],
      negativeDrag: 0,
    };
    top.events.push(ev);
    top.negativeDrag = Math.round((top.negativeDrag + ev.negativeDeducted) * 100) / 100;
    topicAgg.set(tKey, top);

    const qt = typeAgg.get(ev.questionType) ?? { attempts: 0, correct: 0 };
    qt.attempts += 1;
    if (ev.isCorrect) qt.correct += 1;
    typeAgg.set(ev.questionType, qt);
  }

  const weakChapters = Array.from(chapterAgg.values())
    .map((c) => ({
      ...c,
      accuracyPercent: c.attempts > 0 ? Math.round((c.correct / c.attempts) * 100) : 0,
    }))
    .filter((c) => c.accuracyPercent < 70)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  const weakTopics: WeakTopicDiagnostic[] = [];
  const revisionQueue: WeakTopicDiagnostic[] = [];
  const improvingTopics: WeakTopicDiagnostic[] = [];

  for (const t of topicAgg.values()) {
    const attempts = t.events.length;
    const correct = t.events.filter((e) => e.isCorrect).length;
    const accuracyPercent = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

    // Detect recent improvement: later half accuracy > earlier half accuracy by >= 15%
    let isImproving = false;
    if (attempts >= 2) {
      const mid = Math.floor(attempts / 2);
      const firstHalf = t.events.slice(0, mid);
      const secondHalf = t.events.slice(mid);
      const firstAcc = firstHalf.filter((e) => e.isCorrect).length / firstHalf.length;
      const secondAcc = secondHalf.filter((e) => e.isCorrect).length / secondHalf.length;
      if (secondAcc - firstAcc >= 0.15) {
        isImproving = true;
      }
    }

    let category: WeakTopicDiagnostic['category'] = 'strong';
    if (isImproving && accuracyPercent >= 50) {
      category = 'improving';
    } else if (accuracyPercent < 60) {
      category = 'weak_topic';
    } else if (accuracyPercent < 80 || t.negativeDrag > 0) {
      category = 'needs_revision';
    }

    const entry: WeakTopicDiagnostic = {
      topicId: t.topicId,
      chapterId: t.chapterId,
      subjectId: t.subjectId,
      examTrack: t.examTrack,
      attempts,
      correct,
      accuracyPercent,
      negativeDrag: t.negativeDrag,
      category,
      recommendedPracticeCount: category === 'weak_topic' ? 10 : category === 'needs_revision' ? 5 : 3,
    };

    if (category === 'weak_topic') weakTopics.push(entry);
    else if (category === 'needs_revision') revisionQueue.push(entry);
    else if (category === 'improving') improvingTopics.push(entry);
  }

  weakTopics.sort((a, b) => a.accuracyPercent - b.accuracyPercent);
  revisionQueue.sort((a, b) => a.accuracyPercent - b.accuracyPercent);
  improvingTopics.sort((a, b) => b.accuracyPercent - a.accuracyPercent);

  const frequentlyIncorrectTypes: QuestionTypeDiagnostic[] = Array.from(typeAgg.entries())
    .map(([questionType, st]) => ({
      questionType,
      attempts: st.attempts,
      correct: st.correct,
      accuracyPercent: st.attempts > 0 ? Math.round((st.correct / st.attempts) * 100) : 0,
    }))
    .filter((d) => d.accuracyPercent < 75)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  return {
    totalPracticeQuestions,
    totalQuizzesSubmitted: quizzesCount,
    totalExamsSubmitted: examsCount,
    overallAccuracyPercent,
    averageScorePercent,
    weakChapters,
    weakTopics,
    revisionQueue,
    improvingTopics,
    frequentlyIncorrectTypes,
  };
}
