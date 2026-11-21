import test from 'node:test';
import assert from 'node:assert/strict';
import { getSubjectsForExam } from '../data/curriculum/index.ts';
import { applyChapterStatusUpdate, buildProgressKey, type ProgressMap } from './curriculumProgress.ts';
import { filterChaptersByStatus, searchCurriculum } from './curriculumSearch.ts';

test('Bilingual search matches English and Hindi subjects, chapters, and topics', () => {
  const sciSubjects = getSubjectsForExam('up-board-12', 'science');

  const enHits = searchCurriculum(sciSubjects, 'Electrostatics');
  assert.ok(enHits.length > 0);

  const hiHits = searchCurriculum(sciSubjects, 'किरचॉफ');
  assert.ok(hiHits.some((h) => h.kind === 'chapter' && h.chapter?.id === 'up12-phy-c3'));

  const jeeMain = getSubjectsForExam('jee-main');
  const vernierHits = searchCurriculum(jeeMain, 'Vernier');
  assert.ok(vernierHits.some((h) => h.chapter?.id === 'jeem-phy-u6'));
});

test('filterChaptersByStatus filters by not_started and needs_revision accurately', () => {
  const physics = getSubjectsForExam('up-board-12', 'science').find((s) => s.id === 'up12-physics')!;
  const ch2 = physics.chapters[1];
  const revRecord = applyChapterStatusUpdate({
    uid: 'user-1',
    chapter: ch2,
    status: 'needs_revision',
    nowISO: '2026-11-21T09:00:00Z',
  });

  const map: ProgressMap = {
    [buildProgressKey('up-board-12', physics.id, ch2.id)]: revRecord,
  };

  const revisionOnly = filterChaptersByStatus(physics.chapters, map, 'needs_revision');
  assert.equal(revisionOnly.length, 1);
  assert.equal(revisionOnly[0].id, ch2.id);

  const notStartedOnly = filterChaptersByStatus(physics.chapters, map, 'not_started');
  assert.equal(notStartedOnly.length, physics.chapters.length - 1);
});
