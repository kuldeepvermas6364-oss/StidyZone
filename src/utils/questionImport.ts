import type {
  DifficultyLevel,
  FullQuestionRecord,
  QuestionImportBatch,
  QuestionImportMapping,
  QuestionImportPreviewResult,
  QuestionImportRowError,
  QuestionOption,
  QuestionSourceType,
  QuestionType,
} from '../types/assessment';
import type { ExamTrack } from '../types/database';

const VALID_TRACKS = new Set<ExamTrack>(['up-board-12', 'jee-main', 'jee-advanced']);
const VALID_DIFFICULTIES = new Set<DifficultyLevel>(['easy', 'medium', 'hard']);
const VALID_TYPES = new Set<QuestionType>([
  'mcq_single',
  'mcq_multi',
  'numerical',
  'integer',
  'fill_blank',
  'true_false',
  'assertion_reason',
  'match_following',
  'short_answer',
  'long_answer',
  'subjective_descriptive',
]);
const VALID_SOURCES = new Set<QuestionSourceType>([
  'prepzone_curated',
  'official_pattern_sample',
  'verified_pyq',
]);

/**
 * RFC-4180 compliant CSV parser handling quoted fields, escaped double-quotes (""), and CRLF/LF newlines.
 */
export function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseOptionsCell(rawEn: string | undefined, rawHi: string | undefined): QuestionOption[] | undefined {
  if (!rawEn || rawEn.trim().length === 0) return undefined;
  const partsEn = rawEn.split('|').map((s) => s.trim()).filter(Boolean);
  const partsHi = (rawHi ?? '').split('|').map((s) => s.trim());
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  return partsEn.slice(0, 6).map((txt, idx) => ({
    id: labels[idx] ?? String(idx + 1),
    label: labels[idx] ?? String(idx + 1),
    text: {
      en: txt,
      hi: partsHi[idx] && partsHi[idx].length > 0 ? partsHi[idx] : txt,
    },
  }));
}

export function validateAndMapImportObjects(
  rawObjects: readonly Record<string, unknown>[],
  mapping: QuestionImportMapping,
  existingQuestions: readonly Pick<FullQuestionRecord, 'id' | 'prompt'>[],
  batchId = `batch-${Date.now()}`
): QuestionImportPreviewResult {
  const rowErrors: QuestionImportRowError[] = [];
  const validQuestions: FullQuestionRecord[] = [];
  const duplicateIds: string[] = [];
  const duplicatePrompts: Array<{ rowNumber: number; existingId: string; promptEn: string }> = [];

  const existingIds = new Set(existingQuestions.map((q) => q.id));
  const existingPrompts = new Map(existingQuestions.map((q) => [normalizePrompt(q.prompt.en), q.id]));
  const seenIdsInBatch = new Set<string>();
  const seenPromptsInBatch = new Map<string, string>();

  rawObjects.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const readCol = (mappedCol: string | undefined, fallbackKey: string): string => {
      const col = mappedCol?.trim() || fallbackKey;
      const v = raw[col] ?? raw[fallbackKey];
      return v === undefined || v === null ? '' : String(v).trim();
    };

    const rawId = readCol(mapping.id, 'id') || `qb-imp-${batchId}-${rowNumber}`;
    const cleanId = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
    const examTrack = readCol(mapping.examTrack, 'examTrack') as ExamTrack;
    const academicSession = readCol(mapping.academicSession, 'academicSession') || '2025-26';
    const classLevelRaw = readCol(mapping.classLevel, 'classLevel');
    const classLevel: 'class-12' | 'entrance-ug' =
      classLevelRaw === 'class-12' || examTrack === 'up-board-12' ? 'class-12' : 'entrance-ug';
    const subjectId = readCol(mapping.subjectId, 'subjectId');
    const chapterId = readCol(mapping.chapterId, 'chapterId');
    const topicId = readCol(mapping.topicId, 'topicId') || `${chapterId}-t1`;
    const questionType = readCol(mapping.questionType, 'questionType') as QuestionType;
    const difficulty = (readCol(mapping.difficulty, 'difficulty') || 'medium') as DifficultyLevel;
    const promptEn = readCol(mapping.promptEn, 'promptEn');
    const promptHi = readCol(mapping.promptHi, 'promptHi') || promptEn;
    const optionsEn = readCol(mapping.optionsEn, 'optionsEn');
    const optionsHi = readCol(mapping.optionsHi, 'optionsHi');
    const correctAnswer = readCol(mapping.correctAnswer, 'correctAnswer');
    const explanationEn =
      readCol(mapping.explanationEn, 'explanationEn') || 'Verified imported solution.';
    const explanationHi = readCol(mapping.explanationHi, 'explanationHi') || explanationEn;
    const marksRaw = Number(readCol(mapping.marks, 'marks') || (examTrack === 'up-board-12' ? '1' : '4'));
    const negRaw = Number(readCol(mapping.negativeMarks, 'negativeMarks') || '0');
    const sourceRaw = (readCol(mapping.sourceType, 'sourceType') || 'prepzone_curated') as QuestionSourceType;
    const yearRaw = readCol(mapping.academicYear, 'academicYear');

    let hasError = false;
    const fail = (field: string, message: string) => {
      hasError = true;
      rowErrors.push({ rowNumber, field, message });
    };

    if (!VALID_TRACKS.has(examTrack)) {
      fail('examTrack', `Invalid examTrack "${examTrack}". Expected up-board-12, jee-main, or jee-advanced.`);
    }
    if (!subjectId) fail('subjectId', 'subjectId is required.');
    if (!chapterId) fail('chapterId', 'chapterId is required.');
    if (!VALID_TYPES.has(questionType)) {
      fail('questionType', `Invalid questionType "${questionType}".`);
    }
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      fail('difficulty', `Invalid difficulty "${difficulty}". Expected easy, medium, or hard.`);
    }
    if (!promptEn || promptEn.length < 4) {
      fail('promptEn', 'English question prompt (at least 4 chars) is required.');
    }
    if (!Number.isFinite(marksRaw) || marksRaw < 0 || marksRaw > 20) {
      fail('marks', 'marks must be between 0 and 20.');
    }
    if (!Number.isFinite(negRaw) || negRaw < 0 || negRaw > 10) {
      fail('negativeMarks', 'negativeMarks must be between 0 and 10.');
    }

    const sourceType: QuestionSourceType = VALID_SOURCES.has(sourceRaw) ? sourceRaw : 'prepzone_curated';
    const options = parseOptionsCell(optionsEn, optionsHi);

    if (
      (questionType === 'mcq_single' || questionType === 'mcq_multi' || questionType === 'assertion_reason') &&
      (!options || options.length < 2)
    ) {
      fail('optionsEn', 'Objective MCQs require at least 2 pipe-separated options (A|B|C|D).');
    }

    // Build answerKey per questionType
    const answerKey: FullQuestionRecord['answerKey'] = {
      questionId: cleanId,
      explanation: { en: explanationEn, hi: explanationHi },
      solutionSteps: [{ en: explanationEn, hi: explanationHi }],
    };

    if (questionType === 'mcq_single' || questionType === 'assertion_reason') {
      if (!correctAnswer) fail('correctAnswer', 'Correct option ID (e.g. A) is required.');
      else answerKey.correctOptionIds = [correctAnswer.toUpperCase()];
    } else if (questionType === 'mcq_multi') {
      const list = correctAnswer
        .split(/[,|]/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (list.length === 0) fail('correctAnswer', 'Comma-separated option IDs (e.g. A,C) required.');
      else answerKey.correctOptionIds = list;
    } else if (questionType === 'numerical') {
      const n = Number(correctAnswer);
      if (!correctAnswer || !Number.isFinite(n)) fail('correctAnswer', 'Valid numeric answer required.');
      else {
        answerKey.correctNumeric = n;
        answerKey.numericTolerance = 0.02;
      }
    } else if (questionType === 'integer') {
      const n = Number(correctAnswer);
      if (!correctAnswer || !Number.isInteger(n)) fail('correctAnswer', 'Valid integer answer required.');
      else answerKey.correctInteger = n;
    } else if (questionType === 'true_false') {
      const low = correctAnswer.toLowerCase();
      if (low === 'true' || low === 't' || low === '1') answerKey.correctBool = true;
      else if (low === 'false' || low === 'f' || low === '0') answerKey.correctBool = false;
      else fail('correctAnswer', 'Expected "true" or "false".');
    } else if (questionType === 'fill_blank') {
      const syns = correctAnswer.split('|').map((s) => s.trim()).filter(Boolean);
      if (syns.length === 0) fail('correctAnswer', 'At least one acceptable blank answer is required.');
      else answerKey.correctTextAnswers = syns;
    } else if (questionType === 'match_following') {
      const pairs = correctAnswer.split(',').map((s) => s.trim()).filter(Boolean);
      const map: Record<string, string> = {};
      for (const pair of pairs) {
        const [l, r] = pair.split(/[-:]/).map((s) => s.trim());
        if (l && r) map[l] = r;
      }
      if (Object.keys(map).length === 0) fail('correctAnswer', 'Expected mapping like A-2,B-1.');
      else answerKey.correctMatchMap = map;
    } else {
      answerKey.rubric = { en: explanationEn, hi: explanationHi };
    }

    // Duplicate detection
    if (existingIds.has(cleanId) || seenIdsInBatch.has(cleanId)) {
      duplicateIds.push(cleanId);
    }
    const normPrompt = normalizePrompt(promptEn);
    const existingPromptId = existingPrompts.get(normPrompt) ?? seenPromptsInBatch.get(normPrompt);
    if (normPrompt && existingPromptId) {
      duplicatePrompts.push({ rowNumber, existingId: existingPromptId, promptEn });
    }

    if (hasError) return;

    seenIdsInBatch.add(cleanId);
    if (normPrompt) seenPromptsInBatch.set(normPrompt, cleanId);

    const nowIso = new Date().toISOString();
    const record: FullQuestionRecord = {
      id: cleanId,
      examTrack,
      academicSession,
      classLevel,
      subjectId,
      chapterId,
      topicId,
      questionType,
      difficulty,
      prompt: { en: promptEn, hi: promptHi },
      options,
      marks: marksRaw,
      negativeMarks: negRaw,
      partialMarking: questionType === 'mcq_multi',
      sourceType,
      sourceLabel: {
        en: sourceType === 'official_pattern_sample' ? 'Imported Pattern Sample' : 'Imported Question',
        hi: 'आयातित प्रश्न',
      },
      academicYear: yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : undefined,
      verificationStatus: 'awaiting_verification',
      isPublished: true,
      importBatchId: batchId,
      createdAt: nowIso,
      updatedAt: nowIso,
      answerKey,
    };

    validQuestions.push(record);
  });

  return {
    totalRows: rawObjects.length,
    validQuestions,
    rowErrors,
    duplicateIds,
    duplicatePrompts,
  };
}

export function gridRowsToObjects(rows: readonly (readonly unknown[])[]): {
  headers: string[];
  objects: Record<string, unknown>[];
} {
  if (rows.length === 0) return { headers: [], objects: [] };
  const headers = rows[0].map((c) => String(c ?? '').trim()).filter(Boolean);
  const objects: Record<string, unknown>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((cell) => String(cell ?? '').trim().length === 0)) continue;
    const obj: Record<string, unknown> = {};
    rows[0].forEach((headerCell, colIdx) => {
      const key = String(headerCell ?? '').trim();
      if (key) obj[key] = r[colIdx] ?? '';
    });
    objects.push(obj);
  }
  return { headers, objects };
}

export function applyImportRollback(
  questions: readonly FullQuestionRecord[],
  batch: QuestionImportBatch
): FullQuestionRecord[] {
  const idSet = new Set(batch.questionIds);
  return questions.filter((q) => q.importBatchId !== batch.batchId && !idSet.has(q.id));
}
