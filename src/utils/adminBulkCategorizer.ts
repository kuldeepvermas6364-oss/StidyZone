import type { SmartCategorizationPrediction } from '../types/admin';
import type { CurriculumSubject, ExamClassLevel, UPBoardStream } from '../types/curriculum';
import type { ExamTrack } from '../types/database';
import type { LibraryMaterial, MaterialLanguage, MaterialType } from '../types/materials';

/**
 * Deterministic Smart Auto-Categorizer for Bulk PDF Upload.
 * Analyses filename and optional extracted PDF snippet to predict Exam Track, Session,
 * Subject, Chapter, Material Type, and Language.
 *
 * Strictly returns a PREVIEW prediction (requiresConfirmation: true); never auto-publishes.
 */
export function predictPdfCategorization(
  filename: string,
  catalogSubjects: readonly CurriculumSubject[],
  textSnippet = ''
): SmartCategorizationPrediction {
  const cleanName = filename.replace(/\.pdf$/i, '').replace(/[_\-.]+/g, ' ').trim();
  const hay = `${cleanName} ${textSnippet}`.toLowerCase();
  const matchedHints: string[] = [];

  // 1. Exam Track detection
  let examTrack: ExamTrack = 'up-board-12';
  let classLevel: ExamClassLevel = 'class-12';

  if (/\bjee[\s_-]*adv(anced)?\b|\biit[\s_-]*jee\b/.test(hay)) {
    examTrack = 'jee-advanced';
    classLevel = 'entrance-ug';
    matchedHints.push('Exam: JEE Advanced');
  } else if (/\bjee[\s_-]*(main|mains)\b|\bnta\b/.test(hay)) {
    examTrack = 'jee-main';
    classLevel = 'entrance-ug';
    matchedHints.push('Exam: JEE Main');
  } else if (/\bup[\s_-]*board\b|\bupmsp\b|\bclass[\s_-]*12\b|\bkaksha[\s_-]*12\b/.test(hay)) {
    examTrack = 'up-board-12';
    classLevel = 'class-12';
    matchedHints.push('Exam: UP Board Class 12');
  }

  // 2. Academic session detection
  const sessionMatch = /\b(202[4-9])[-–/](2[4-9]|202[5-9])\b/.exec(hay);
  const academicSession = sessionMatch
    ? `${sessionMatch[1]}-${sessionMatch[2].slice(-2)}`
    : '2025-26';
  if (sessionMatch) matchedHints.push(`Session: ${academicSession}`);

  // 3. Language detection
  let language: MaterialLanguage = 'en';
  if (/[\u0900-\u097F]/.test(hay) || /\bhindi\b|\bहिन्दी\b|\bहिंदी\b/.test(hay)) {
    language = /\bbilingual\b|\ben[\s_-]*hi\b/.test(hay) ? 'bilingual' : 'hi';
    matchedHints.push(`Language: ${language}`);
  } else if (/\bbilingual\b/.test(hay)) {
    language = 'bilingual';
    matchedHints.push('Language: bilingual');
  }

  // 4. Material Type detection
  let materialType: MaterialType = 'chapter_notes';
  if (/\bncert\b/.test(hay)) materialType = 'ncert_book';
  else if (/\bpyq\b|\bprevious[\s_-]*year\b/.test(hay)) materialType = 'pyq_paper';
  else if (/\bmodel[\s_-]*paper\b/.test(hay)) materialType = 'model_paper';
  else if (/\bsample[\s_-]*paper\b/.test(hay)) materialType = 'sample_paper';
  else if (/\bformula\b|\bsheet\b|\bसूत्र\b/.test(hay)) materialType = 'formula_sheet';
  else if (/\bderivation\b|\bव्युत्पत्ति\b/.test(hay)) materialType = 'derivations';
  else if (/\brevision\b|\bquick[\s_-]*notes\b|\bone[\s_-]*shot\b/.test(hay)) materialType = 'revision_notes';
  else if (/\bimportant[\s_-]*q(uestion)?s?\b|\bimp\b/.test(hay)) materialType = 'important_questions';
  else if (/\bsyllabus\b|\bपाठ्यक्रम\b/.test(hay)) materialType = 'official_syllabus';
  else if (/\bpractical\b|\bviva\b|\blab\b/.test(hay)) materialType = 'practical_guide';
  else if (/\bclass[\s_-]*notes\b/.test(hay)) materialType = 'class_notes';
  matchedHints.push(`Type: ${materialType}`);

  // 5. Subject & Stream matching
  const trackSubjects = catalogSubjects.filter((s) => s.examTrack === examTrack);
  const subjectRules: Array<{ regex: RegExp; slug: string }> = [
    { regex: /\bphysics\b|\bphy\b|\bभौतिक\b|\belectrostatic\b|\boptics\b|\bmagnetism\b/, slug: 'physics' },
    { regex: /\bchemistry\b|\bchem\b|\bरसायन\b|\borganic\b|\binorganic\b|\bphysical chem\b/, slug: 'chemistry' },
    { regex: /\bmath(s|ematics)?\b|\bगणित\b|\bcalculus\b|\bmatrix\b|\bdeterminant\b|\bintegration\b/, slug: 'maths' },
    { regex: /\bbiology\b|\bbio\b|\bजीव\b|\bgenetics\b|\becology\b/, slug: 'biology' },
    { regex: /\baccountancy\b|\baccounts\b|\bलेखा\b/, slug: 'accountancy' },
    { regex: /\bbusiness[\s_-]*studies\b|\bbst\b/, slug: 'business-studies' },
    { regex: /\beconomics\b|\beco\b|\bअर्थशास्त्र\b/, slug: 'economics' },
    { regex: /\bhistory\b|\bइतिहास\b/, slug: 'history' },
    { regex: /\bgeography\b|\bभूगोल\b/, slug: 'geography' },
    { regex: /\bpolitical[\s_-]*science\b|\bcivics\b|\bनागरिक\b/, slug: 'political-science' },
    { regex: /\benglish\b|\bprose\b|\bpoetry\b/, slug: 'english' },
    { regex: /\bhindi\b|\bहिंदी\b|\bगद्य\b|\bकाव्य\b/, slug: 'hindi' },
  ];

  let matchedSubject = trackSubjects[0] ?? catalogSubjects[0];
  let subjectScore = 0;

  for (const rule of subjectRules) {
    if (rule.regex.test(hay)) {
      const candidate = trackSubjects.find((s) => s.id.includes(rule.slug));
      if (candidate) {
        matchedSubject = candidate;
        subjectScore = 2;
        matchedHints.push(`Subject: ${candidate.name.en}`);
        break;
      }
    }
  }

  let streamId: UPBoardStream | undefined;
  if (examTrack === 'up-board-12' && matchedSubject?.streams && matchedSubject.streams.length > 0) {
    streamId = matchedSubject.streams[0];
  }

  // 6. Chapter best-token match within matchedSubject
  let matchedChapterId: string | undefined;
  let bestChapterHits = 0;
  if (matchedSubject) {
    const tokens = hay.split(/\s+/).filter((w) => w.length >= 4);
    for (const ch of matchedSubject.chapters) {
      const chText = `${ch.title.en} ${ch.title.hi}`.toLowerCase();
      let hits = 0;
      for (const tok of tokens) {
        if (chText.includes(tok)) hits += 1;
      }
      // Also match explicit chapter number like ch1 / chapter 2
      const chNumMatch = /\bch(?:apter)?[\s_-]*(\d{1,2})\b/.exec(hay);
      if (chNumMatch && Number(chNumMatch[1]) === ch.unitNumber) {
        hits += 3;
      }
      if (hits > bestChapterHits) {
        bestChapterHits = hits;
        matchedChapterId = ch.id;
      }
    }
    if (matchedChapterId) {
      const chObj = matchedSubject.chapters.find((c) => c.id === matchedChapterId);
      if (chObj) matchedHints.push(`Chapter: ${chObj.title.en}`);
    }
  }

  const confidence: 'high' | 'medium' | 'low' =
    subjectScore >= 2 && bestChapterHits >= 2
      ? 'high'
      : subjectScore >= 2 || matchedHints.length >= 3
      ? 'medium'
      : 'low';

  return {
    examTrack,
    academicSession,
    classLevel,
    streamId,
    subjectId: matchedSubject?.id ?? 'up12-physics',
    chapterId: matchedChapterId,
    materialType,
    language,
    confidence,
    matchedHints,
    autoCategorized: true,
    requiresConfirmation: true,
  };
}

/**
 * Generates clean bilingual title from a raw PDF filename.
 */
export function humanizePdfTitle(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

/**
 * Checks whether an uploaded PDF candidate duplicates an existing material by sha256 or storage filename.
 */
export function findDuplicateMaterial(
  candidate: { filename: string; sha256: string },
  existingMaterials: readonly (Pick<LibraryMaterial, 'id' | 'storagePath' | 'title'> & { sha256?: string })[]
): { isDuplicate: boolean; existingId?: string; reason?: string } {
  const normFile = candidate.filename.trim().toLowerCase();
  for (const m of existingMaterials) {
    if (m.sha256 && candidate.sha256 && m.sha256 === candidate.sha256) {
      return { isDuplicate: true, existingId: m.id, reason: 'Identical PDF SHA-256 checksum already in library.' };
    }
    if (m.storagePath && m.storagePath.toLowerCase() === normFile) {
      return { isDuplicate: true, existingId: m.id, reason: 'Storage filename already registered.' };
    }
  }
  return { isDuplicate: false };
}
