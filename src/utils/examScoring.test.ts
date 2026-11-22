import test from 'node:test';
import assert from 'node:assert/strict';
import { CURATED_QUESTION_BANK } from '../data/assessments/questionBankCatalog';
import type { FullQuestionRecord, PracticeHistoryEntry } from '../types/assessment';
import {
  evaluateSingleQuestion,
  getSeededOptions,
  scoreAssessmentAttempt,
  seededShuffle,
  validateAttemptSubmissionWindow,
} from './examScoring';
import {
  applyImportRollback,
  gridRowsToObjects,
  parseCsvToRows,
  validateAndMapImportObjects,
} from './questionImport';
import { computeStudentAnalytics } from './weakTopics';

function findByType(qType: FullQuestionRecord['questionType']): FullQuestionRecord {
  const found = CURATED_QUESTION_BANK.find((q) => q.questionType === qType);
  assert.ok(found, `Expected curated question for type ${qType}`);
  return found;
}

test('evaluates all 11 question formats accurately including negative marks and self-review', () => {
  // 1. mcq_single
  const mcqSingle = findByType('mcq_single');
  const sCorrect = evaluateSingleQuestion(mcqSingle, {
    selectedOptionIds: mcqSingle.answerKey.correctOptionIds,
  });
  assert.equal(sCorrect.status, 'correct');
  assert.equal(sCorrect.awardedMarks, mcqSingle.marks);

  const wrongOpt = mcqSingle.options?.find((o) => !mcqSingle.answerKey.correctOptionIds?.includes(o.id))?.id ?? 'Z';
  const sWrong = evaluateSingleQuestion(mcqSingle, { selectedOptionIds: [wrongOpt] });
  assert.equal(sWrong.status, 'incorrect');
  assert.equal(sWrong.awardedMarks, -mcqSingle.negativeMarks);

  // 2. mcq_multi (exact + partial + wrong option penalty)
  const mcqMulti = findByType('mcq_multi');
  const expectedMulti = mcqMulti.answerKey.correctOptionIds ?? [];
  assert.ok(expectedMulti.length >= 2);
  const mFull = evaluateSingleQuestion(mcqMulti, { selectedOptionIds: expectedMulti });
  assert.equal(mFull.status, 'correct');
  assert.equal(mFull.awardedMarks, mcqMulti.marks);

  const mPartial = evaluateSingleQuestion(mcqMulti, { selectedOptionIds: [expectedMulti[0]] });
  assert.equal(mPartial.status, 'partial');
  assert.ok(mPartial.awardedMarks > 0 && mPartial.awardedMarks < mcqMulti.marks);

  const badOpt = mcqMulti.options?.find((o) => !expectedMulti.includes(o.id))?.id ?? 'Z';
  const mBad = evaluateSingleQuestion(mcqMulti, { selectedOptionIds: [expectedMulti[0], badOpt] });
  assert.equal(mBad.status, 'incorrect');
  assert.equal(mBad.awardedMarks, -mcqMulti.negativeMarks);

  // 3. numerical (tolerance)
  const numQ = findByType('numerical');
  const numTarget = numQ.answerKey.correctNumeric ?? 0;
  assert.equal(evaluateSingleQuestion(numQ, { numericValue: String(numTarget) }).status, 'correct');
  assert.equal(evaluateSingleQuestion(numQ, { numericValue: String(numTarget + 999) }).status, 'incorrect');

  // 4. integer (rejects decimal)
  const intQ = findByType('integer');
  const intTarget = intQ.answerKey.correctInteger ?? 0;
  assert.equal(evaluateSingleQuestion(intQ, { numericValue: String(intTarget) }).status, 'correct');
  assert.equal(evaluateSingleQuestion(intQ, { numericValue: `${intTarget}.5` }).status, 'incorrect');

  // 5. fill_blank
  const fillQ = findByType('fill_blank');
  const fillVal = fillQ.answerKey.correctTextAnswers?.[0] ?? '';
  assert.equal(evaluateSingleQuestion(fillQ, { textValue: fillVal }).status, 'correct');

  // 6. true_false
  const tfQ = findByType('true_false');
  assert.equal(evaluateSingleQuestion(tfQ, { booleanValue: tfQ.answerKey.correctBool }).status, 'correct');
  assert.equal(evaluateSingleQuestion(tfQ, { booleanValue: !tfQ.answerKey.correctBool }).status, 'incorrect');

  // 7. assertion_reason
  const arQ = findByType('assertion_reason');
  assert.equal(
    evaluateSingleQuestion(arQ, { selectedOptionIds: arQ.answerKey.correctOptionIds }).status,
    'correct'
  );

  // 8. match_following
  const matchQ = findByType('match_following');
  assert.equal(
    evaluateSingleQuestion(matchQ, { matchMapping: matchQ.answerKey.correctMatchMap }).status,
    'correct'
  );

  // 9, 10, 11. short_answer, long_answer, subjective_descriptive
  for (const sType of ['short_answer', 'long_answer', 'subjective_descriptive'] as const) {
    const subjQ = findByType(sType);
    const pending = evaluateSingleQuestion(subjQ, { textValue: 'Student written derivation steps' });
    assert.equal(pending.status, 'pending_review');
    assert.equal(pending.awardedMarks, 0);

    const selfEval = evaluateSingleQuestion(subjQ, {
      textValue: 'Student written derivation steps',
      selfEvaluatedMarks: 999, // clamped to maxMarks
    });
    assert.equal(selfEval.status, 'self_evaluated');
    assert.equal(selfEval.awardedMarks, subjQ.marks);
  }
});

test('scoreAssessmentAttempt aggregates subject, chapter, topic, and unanswered metrics cleanly', () => {
  const qs = CURATED_QUESTION_BANK.slice(0, 3);
  const ans = {
    [qs[0].id]: { selectedOptionIds: qs[0].answerKey.correctOptionIds },
    // qs[1] unanswered
    // qs[2] wrong if numeric
  };
  const summary = scoreAssessmentAttempt(qs, ans, 120);
  assert.equal(summary.totalQuestions, 3);
  assert.equal(summary.correctCount, 1);
  assert.equal(summary.unansweredCount, 2);
  assert.ok(summary.subjectBreakdown.length >= 1);
  assert.ok(summary.chapterBreakdown.length >= 1);
});

test('validateAttemptSubmissionWindow guards submission timing and grace window', () => {
  const now = 1_700_000_000_000;
  const attempt = { startedAtServerMs: now, expiresAtServerMs: now + 600_000 };

  const inTime = validateAttemptSubmissionWindow(attempt, now + 300_000, 90_000);
  assert.equal(inTime.allowed, true);
  assert.equal(inTime.lateFlag, false);

  const inGrace = validateAttemptSubmissionWindow(attempt, now + 650_000, 90_000);
  assert.equal(inGrace.allowed, true);
  assert.equal(inGrace.lateFlag, true);

  const expired = validateAttemptSubmissionWindow(attempt, now + 720_000, 90_000);
  assert.equal(expired.allowed, false);
});

test('seededShuffle and getSeededOptions are deterministic across reloads', () => {
  const arr = [1, 2, 3, 4, 5];
  assert.deepEqual(seededShuffle(arr, 4242), seededShuffle(arr, 4242));

  const mcq = findByType('mcq_single');
  const first = getSeededOptions(mcq, 1009, true).map((o) => o.id);
  const second = getSeededOptions(mcq, 1009, true).map((o) => o.id);
  assert.deepEqual(first, second);
});

test('computeStudentAnalytics produces zero-states cleanly and detects weak/improving topics from real logs', () => {
  const empty = computeStudentAnalytics([], []);
  assert.equal(empty.overallAccuracyPercent, 0);
  assert.equal(empty.weakTopics.length, 0);

  const history: PracticeHistoryEntry[] = [
    {
      id: 'p1',
      uid: 'u1',
      questionId: 'q1',
      examTrack: 'jee-main',
      subjectId: 'jeemain-physics',
      chapterId: 'jm-phy-ch1',
      topicId: 't-weak',
      questionType: 'mcq_single',
      difficulty: 'medium',
      isCorrect: false,
      status: 'incorrect',
      awardedMarks: -1,
      maxMarks: 4,
      studentAnswer: {},
      markedForRevision: false,
      savedDifficult: false,
      attemptedAt: '2026-11-20T10:00:00.000Z',
    },
    {
      id: 'p2',
      uid: 'u1',
      questionId: 'q2',
      examTrack: 'jee-main',
      subjectId: 'jeemain-physics',
      chapterId: 'jm-phy-ch1',
      topicId: 't-weak',
      questionType: 'mcq_single',
      difficulty: 'medium',
      isCorrect: false,
      status: 'incorrect',
      awardedMarks: -1,
      maxMarks: 4,
      studentAnswer: {},
      markedForRevision: false,
      savedDifficult: false,
      attemptedAt: '2026-11-20T10:05:00.000Z',
    },
    {
      id: 'p3',
      uid: 'u1',
      questionId: 'q3',
      examTrack: 'jee-main',
      subjectId: 'jeemain-maths',
      chapterId: 'jm-math-ch1',
      topicId: 't-improve',
      questionType: 'numerical',
      difficulty: 'easy',
      isCorrect: false,
      status: 'incorrect',
      awardedMarks: 0,
      maxMarks: 4,
      studentAnswer: {},
      markedForRevision: false,
      savedDifficult: false,
      attemptedAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'p4',
      uid: 'u1',
      questionId: 'q4',
      examTrack: 'jee-main',
      subjectId: 'jeemain-maths',
      chapterId: 'jm-math-ch1',
      topicId: 't-improve',
      questionType: 'numerical',
      difficulty: 'easy',
      isCorrect: true,
      status: 'correct',
      awardedMarks: 4,
      maxMarks: 4,
      studentAnswer: {},
      markedForRevision: false,
      savedDifficult: false,
      attemptedAt: '2026-11-21T09:00:00.000Z',
    },
  ];

  const stats = computeStudentAnalytics(history, []);
  assert.equal(stats.weakTopics.length, 1);
  assert.equal(stats.weakTopics[0].topicId, 't-weak');
  assert.equal(stats.improvingTopics.length, 1);
  assert.equal(stats.improvingTopics[0].topicId, 't-improve');
});

test('CSV parser, import schema validator, duplicate detector, and batch rollback work end-to-end', () => {
  const csv = [
    'id,examTrack,subjectId,chapterId,questionType,difficulty,promptEn,optionsEn,correctAnswer,marks,negativeMarks',
    'qb-test-1,jee-main,jeemain-physics,jm-phy-ch1,mcq_single,easy,"Find speed if $d=10\\text{ m}, t=2\\text{ s}$","5 m/s|10 m/s|20 m/s|2 m/s",A,4,1',
    'qb-test-bad,invalid-exam,,jm-phy-ch1,mcq_single,easy,"Bad row",A|B,A,4,1',
  ].join('\n');

  const rows = parseCsvToRows(csv);
  const { objects } = gridRowsToObjects(rows);
  assert.equal(objects.length, 2);

  const preview = validateAndMapImportObjects(
    objects,
    {
      id: 'id',
      examTrack: 'examTrack',
      subjectId: 'subjectId',
      chapterId: 'chapterId',
      questionType: 'questionType',
      difficulty: 'difficulty',
      promptEn: 'promptEn',
      optionsEn: 'optionsEn',
      correctAnswer: 'correctAnswer',
      marks: 'marks',
      negativeMarks: 'negativeMarks',
    },
    [],
    'batch-test-1'
  );

  assert.equal(preview.validQuestions.length, 1);
  assert.ok(preview.rowErrors.length >= 1);

  const rolled = applyImportRollback(preview.validQuestions, {
    batchId: 'batch-test-1',
    importedAt: new Date().toISOString(),
    importedByUid: 'u1',
    sourceKind: 'csv',
    questionIds: ['qb-test-1'],
    count: 1,
  });
  assert.equal(rolled.length, 0);
});
