import test from 'node:test';
import assert from 'node:assert/strict';
import { getSubjectsForExam } from '../data/curriculum/index.ts';
import {
  applyChapterStatusUpdate,
  applyTopicToggle,
  buildProgressKey,
  computeChapterCompletionPercent,
  computeExamStats,
  computeSubjectStats,
  getRecentlyStudiedChapters,
  type ProgressMap,
} from './curriculumProgress.ts';

test('UP Board streams map distinct subject lists and share canonical Hindi/English/Economics', () => {
  const sci = getSubjectsForExam('up-board-12', 'science');
  const com = getSubjectsForExam('up-board-12', 'commerce');
  const arts = getSubjectsForExam('up-board-12', 'arts');

  assert.equal(sci.some((s) => s.id === 'up12-physics'), true);
  assert.equal(sci.some((s) => s.id === 'up12-accountancy'), false);

  assert.equal(com.some((s) => s.id === 'up12-accountancy'), true);
  assert.equal(com.some((s) => s.id === 'up12-physics'), false);

  assert.equal(arts.some((s) => s.id === 'up12-history'), true);
  assert.equal(arts.some((s) => s.id === 'up12-economics'), true);

  // Canonical IDs shared rather than duplicated
  const comEng = com.find((s) => s.id === 'up12-english');
  const sciEng = sci.find((s) => s.id === 'up12-english');
  assert.equal(comEng, sciEng);
});

test('JEE Main and JEE Advanced syllabi remain strictly separated', () => {
  const jeeMain = getSubjectsForExam('jee-main');
  const jeeAdv = getSubjectsForExam('jee-advanced');

  assert.equal(jeeMain.length, 3);
  assert.equal(jeeAdv.length, 3);
  assert.notEqual(jeeMain[0].id, jeeAdv[0].id);

  const mainChem = jeeMain.find((s) => s.id === 'jeemain-chemistry');
  assert.ok(mainChem && mainChem.removedOrReducedTopics.length > 0);
});

test('Empty progress map yields strictly 0% completion and full remaining count', () => {
  const jeeMain = getSubjectsForExam('jee-main');
  const stats = computeExamStats(jeeMain, {});
  assert.equal(stats.completedChapters, 0);
  assert.equal(stats.completionPercent, 0);
  assert.equal(stats.remainingChapters, stats.totalChapters);
  assert.ok(stats.totalChapters > 0);
});

test('Topic toggling and status transitions update completion percent honestly', () => {
  const physics = getSubjectsForExam('up-board-12', 'science').find((s) => s.id === 'up12-physics')!;
  const ch1 = physics.chapters[0];
  assert.ok(ch1.topics.length >= 2);

  const step1 = applyTopicToggle({
    uid: 'user-1',
    chapter: ch1,
    topicId: ch1.topics[0].id,
    streamId: 'science',
    nowISO: '2026-11-21T08:00:00Z',
  });
  assert.equal(step1.status, 'in_progress');
  assert.equal(
    step1.completionPercent,
    computeChapterCompletionPercent(ch1, [ch1.topics[0].id], 'in_progress')
  );

  const stepComplete = applyChapterStatusUpdate({
    uid: 'user-1',
    chapter: ch1,
    status: 'completed',
    streamId: 'science',
    existing: step1,
    nowISO: '2026-11-21T08:15:00Z',
  });
  assert.equal(stepComplete.status, 'completed');
  assert.equal(stepComplete.completionPercent, 100);
  assert.equal(stepComplete.completedTopicIds.length, ch1.topics.length);

  const map: ProgressMap = {
    [buildProgressKey('up-board-12', physics.id, ch1.id)]: stepComplete,
  };
  const subStats = computeSubjectStats(physics, map);
  assert.equal(subStats.completedChapters, 1);
  assert.equal(subStats.remainingChapters, physics.chapters.length - 1);

  const recent = getRecentlyStudiedChapters(map, [physics], 3);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].chapter.id, ch1.id);
});
