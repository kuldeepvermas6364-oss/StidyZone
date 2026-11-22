import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPdfCitationsFromChunks,
  chunkPdfPages,
  computeRealStudyRecommendations,
  normalizeGeneratedStudyPlan,
  retrieveRelevantPdfChunks,
  validateAndSanitizeAiQuiz,
  validateImageAttachment,
  validatePromptInput,
  validateStudyPlanInputs,
} from './aiTutorEngine.ts';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum/index.ts';
import { computeStudentAnalytics } from './weakTopics.ts';

test('validatePromptInput rejects empty and oversized prompts cleanly', () => {
  const emptyRes = validatePromptInput('   ');
  assert.equal(emptyRes.ok, false);

  const oversized = validatePromptInput('a'.repeat(4500));
  assert.equal(oversized.ok, false);

  const valid = validatePromptInput('  Explain Gauss law derivation for infinite plane sheet.  ');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.prompt, 'Explain Gauss law derivation for infinite plane sheet.');
  }
});

test('validateImageAttachment rejects invalid mime types and oversize payloads', () => {
  const badMime = validateImageAttachment('Zm9v', 'image/svg+xml');
  assert.equal(badMime.ok, false);

  const validPng = validateImageAttachment('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', 'image/png');
  assert.equal(validPng.ok, true);
  if (validPng.ok) {
    assert.equal(validPng.data?.mimeType, 'image/png');
    assert.equal(validPng.data?.base64, 'iVBORw0KGgoAAAANSUhEUg==');
  }
});

test('chunkPdfPages and retrieveRelevantPdfChunks preserve accurate page citations', () => {
  const pages = [
    {
      pageNumber: 1,
      text: 'Coulomb law in vector form describes the electrostatic force between two point charges separated by distance r in vacuum.',
    },
    {
      pageNumber: 2,
      text: "Gauss's law states that the net electric flux through a closed Gaussian surface equals enclosed charge divided by epsilon zero. Electric field near an infinite charged sheet is sigma / (2 epsilon_0).",
    },
    {
      pageNumber: 3,
      text: 'Electrostatic shielding inside a hollow conductor keeps the interior field zero.',
    },
  ];

  const chunks = chunkPdfPages('up12-phy-c1-notes-pdf', pages, 260, 40);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].pageNumber, 1);

  const hits = retrieveRelevantPdfChunks('electric flux closed Gaussian surface infinite charged sheet', chunks, 2);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].chunk.pageNumber, 2);

  const citations = buildPdfCitationsFromChunks('Electrostatics Notes', hits);
  assert.equal(citations[0].pageNumber, 2);
  assert.equal(citations[0].sourceKind, 'pdf');

  const noMatchHits = retrieveRelevantPdfChunks('organic chemistry grignard reagent aldehyde', chunks, 3);
  assert.equal(noMatchHits.length, 0);
});

test('validateAndSanitizeAiQuiz rejects malformed/ungrounded MCQs and forces ai_generated sourceType', () => {
  const rawOutput = {
    questions: [
      {
        questionType: 'mcq_single',
        difficulty: 'medium',
        prompt: {
          en: 'What is the SI unit of electric flux?',
          hi: 'वैद्युत फ्लक्स का SI मात्रक क्या है?',
        },
        options: [
          { id: 'opt-a', label: 'A', text: { en: 'N m^2 C^-1', hi: 'N m^2 C^-1' } },
          { id: 'opt-b', label: 'B', text: { en: 'N C^-1', hi: 'N C^-1' } },
          { id: 'opt-c', label: 'C', text: { en: 'J C^-1', hi: 'J C^-1' } },
          { id: 'opt-d', label: 'D', text: { en: 'C m', hi: 'C m' } },
        ],
        correctOptionId: 'opt-a',
        explanation: {
          en: 'Electric flux phi = E * A has units (N/C) * m^2 = N m^2 C^-1.',
          hi: 'फ्लक्स का मात्रक N m^2 C^-1 होता है।',
        },
        solutionSteps: [{ en: 'Multiply E (N/C) by area (m^2).', hi: 'E और A का गुणनफल।' }],
      },
      {
        // Invalid MCQ: duplicate options and invalid answer key
        questionType: 'mcq_single',
        difficulty: 'easy',
        prompt: { en: 'Invalid duplicate option question', hi: 'अमान्य प्रश्न' },
        options: [
          { id: 'opt-a', label: 'A', text: { en: 'Same', hi: 'Same' } },
          { id: 'opt-b', label: 'B', text: { en: 'Same', hi: 'Same' } },
        ],
        correctOptionId: 'opt-z',
        explanation: { en: 'Missing', hi: 'Missing' },
      },
    ],
  };

  const sanitized = validateAndSanitizeAiQuiz(rawOutput, {
    examTrack: 'up-board-12',
    subjectId: 'up12-physics',
    chapterId: 'up12-phy-c1',
    topicId: 'up12-phy-c1-t1',
    classLevel: 'class-12',
    batchId: 'test-batch',
  });

  assert.equal(sanitized.validQuestions.length, 1);
  assert.equal(sanitized.rejectedCount, 1);
  assert.equal(sanitized.validQuestions[0].sourceType, 'ai_generated');
  assert.equal(sanitized.validQuestions[0].verificationStatus, 'awaiting_verification');
});

test('computeRealStudyRecommendations never fabricates weak metrics on empty student logs', () => {
  const emptyAnalytics = computeStudentAnalytics([], []);
  const upPhysics = ALL_CURRICULUM_SUBJECTS.filter((s) => s.examTrack === 'up-board-12');
  const recs = computeRealStudyRecommendations({
    examTrack: 'up-board-12',
    subjects: upPhysics,
    analytics: emptyAnalytics,
    practiceHistory: [],
    attempts: [],
    progressMap: {},
    language: 'en',
  });

  assert.ok(recs.length > 0);
  assert.ok(recs.every((r) => r.kind === 'starter_guidance'));
  assert.ok(recs.every((r) => r.accuracyPercent === undefined));
});

test('validateStudyPlanInputs and normalizeGeneratedStudyPlan keep generated plans in draft status', () => {
  const bad = validateStudyPlanInputs({
    examTrack: 'jee-main',
    examDateISO: 'invalid-date',
    dailyHours: 25,
    selectedSubjectIds: [],
  });
  assert.equal(bad.ok, false);

  const ok = validateStudyPlanInputs({
    examTrack: 'jee-main',
    examDateISO: '2027-01-22',
    dailyHours: 4.5,
    selectedSubjectIds: ['jeemain-physics', 'jeemain-maths'],
  });
  assert.equal(ok.ok, true);

  const plan = normalizeGeneratedStudyPlan(
    {
      title: 'JEE Main 7-Day Sprint',
      summaryNote: 'Balanced Physics and Calculus schedule.',
      dailyTargets: ['Solve 20 PYQs', 'Revise formulas'],
      weeklySchedule: [
        {
          dayLabel: 'Day 1',
          focusSubject: 'Physics',
          chapterTitle: 'Electrostatics',
          activity: 'Derivations and numericals',
          durationMinutes: 120,
        },
      ],
    },
    {
      id: 'plan-1',
      uid: 'u1',
      examTrack: 'jee-main',
      examDateISO: '2027-01-22',
      dailyHours: 4.5,
      selectedSubjectIds: ['jeemain-physics'],
    }
  );
  assert.equal(plan.status, 'draft');
  assert.equal(plan.weeklySchedule.length, 1);
});
