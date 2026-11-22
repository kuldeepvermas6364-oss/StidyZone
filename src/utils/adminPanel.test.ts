import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum/index.ts';
import type { AdminUserRecord, StudentAdminView } from '../types/admin.ts';
import { findDuplicateMaterial, predictPdfCategorization } from './adminBulkCategorizer.ts';
import {
  buildStudentsCsvExport,
  escapeSafeCsvCell,
  findCurriculumDependencies,
  hasAdminPermission,
  parseSuperAdminEmailAllowlist,
  sanitizeStudentForAdminExport,
} from './adminRbac.ts';

test('Super Admin has all permissions including admin role & system settings management', () => {
  const superAdmin: AdminUserRecord = {
    uid: 'adm-super-1',
    email: 'did78994@gmail.com',
    displayName: 'Super Admin',
    role: 'super_admin',
    permissions: [],
    active: true,
    grantedByUid: 'bootstrap',
    grantedAt: '2026-11-22T00:00:00Z',
    updatedAt: '2026-11-22T00:00:00Z',
  };

  assert.equal(hasAdminPermission(superAdmin, undefined, true), true);
  assert.equal(hasAdminPermission(superAdmin, 'manage_curriculum', false), true);
  assert.equal(hasAdminPermission(superAdmin, 'export_students', false), true);
});

test('Content Admin is restricted by assigned permissions and blocked from Super Admin operations', () => {
  const contentAdmin: AdminUserRecord = {
    uid: 'adm-content-1',
    email: 'editor@prepzone.edu',
    displayName: 'Content Editor',
    role: 'content_admin',
    permissions: ['view_dashboard', 'manage_materials', 'bulk_upload'],
    active: true,
    grantedByUid: 'adm-super-1',
    grantedAt: '2026-11-22T00:00:00Z',
    updatedAt: '2026-11-22T00:00:00Z',
  };

  assert.equal(hasAdminPermission(contentAdmin, 'manage_materials', false), true);
  assert.equal(hasAdminPermission(contentAdmin, 'bulk_upload', false), true);
  assert.equal(hasAdminPermission(contentAdmin, 'export_students', false), false);
  assert.equal(hasAdminPermission(contentAdmin, 'view_dashboard', true), false);

  const disabledAdmin = { ...contentAdmin, active: false };
  assert.equal(hasAdminPermission(disabledAdmin, 'manage_materials', false), false);
  assert.equal(hasAdminPermission(null, 'view_dashboard', false), false);
});

test('Student export sanitizer strips passwordHash/secrets and prevents CSV formula injection', () => {
  const dirtyStudent = {
    uid: 'stu-1',
    email: 'aarav@example.com',
    displayName: '=cmd|"/c calc"!A0',
    primaryExam: 'jee-main',
    studyMedium: 'bilingual',
    preferredLanguage: 'en',
    provider: 'local-foundation',
    emailVerified: false,
    disabled: false,
    createdAt: '2026-11-22T00:00:00Z',
    lastActiveAt: '2026-11-22T00:00:00Z',
    attemptsCount: 2,
    submittedMockCount: 1,
    practiceCount: 15,
    overallAccuracyPercent: 78,
    aiRequestsToday: 4,
    passwordHash: 'fnv1a_deadbeef',
    secretToken: 'should_not_leak',
  } as unknown as StudentAdminView & Record<string, unknown>;

  const clean = sanitizeStudentForAdminExport(dirtyStudent);
  assert.equal('passwordHash' in clean, false);
  assert.equal('secretToken' in clean, false);
  assert.equal(escapeSafeCsvCell('=1+1'), "'=1+1");

  const csv = buildStudentsCsvExport([dirtyStudent]);
  assert.equal(csv.includes('fnv1a_deadbeef'), false);
  assert.equal(csv.includes('should_not_leak'), false);
  assert.equal(csv.includes("'=cmd"), true);
});

test('Smart PDF auto-categorizer produces preview-only predictions requiring admin confirmation', () => {
  const pred1 = predictPdfCategorization(
    'JEE_Main_2025-26_Physics_Ch1_Electrostatics_Formula_Sheet.pdf',
    ALL_CURRICULUM_SUBJECTS
  );
  assert.equal(pred1.examTrack, 'jee-main');
  assert.equal(pred1.academicSession, '2025-26');
  assert.equal(pred1.materialType, 'formula_sheet');
  assert.equal(pred1.subjectId.includes('physics'), true);
  assert.equal(pred1.autoCategorized, true);
  assert.equal(pred1.requiresConfirmation, true);

  const pred2 = predictPdfCategorization(
    'UP_Board_Class_12_रसायन_विज्ञान_अध्याय_नोट्स_Hindi.pdf',
    ALL_CURRICULUM_SUBJECTS
  );
  assert.equal(pred2.examTrack, 'up-board-12');
  assert.equal(pred2.language, 'hi');
});

test('Duplicate material and curriculum dependency detectors identify collisions safely', () => {
  const dup = findDuplicateMaterial(
    { filename: 'up12-physics-ch1-electrostatics-notes.pdf', sha256: 'abc' },
    [
      {
        id: 'm1',
        storagePath: 'up12-physics-ch1-electrostatics-notes.pdf',
        title: { en: 'Notes', hi: 'नोट्स' },
      },
    ]
  );
  assert.equal(dup.isDuplicate, true);
  assert.equal(dup.existingId, 'm1');

  const deps = findCurriculumDependencies({
    targetType: 'subject',
    targetId: 'up12-physics',
    materials: [{ id: 'm1', subjectId: 'up12-physics', title: { en: 'A', hi: 'A' } }],
    questionIdsAndRefs: [{ id: 'q1', subjectId: 'up12-physics', chapterId: 'up12-phy-c1' }],
  });
  assert.equal(deps.hasDependencies, true);
  assert.equal(deps.linkedMaterialsCount, 1);
  assert.equal(deps.linkedQuestionsCount, 1);

  const allowlist = parseSuperAdminEmailAllowlist('did78994@gmail.com, other@prepzone.edu');
  assert.equal(allowlist.has('did78994@gmail.com'), true);
  assert.equal(allowlist.has('other@prepzone.edu'), true);
});
