import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  createSignedMaterialToken,
  hasPdfMagicHeader,
  resolveSafeStoragePath,
  sanitizeDownloadFilename,
  validateMaterialUploadCandidate,
  verifySignedMaterialToken,
} from './storageUtils';

test('resolveSafeStoragePath confines keys strictly inside storage directory', () => {
  const baseDir = path.resolve('/tmp/prepzone-storage');
  const valid = resolveSafeStoragePath(baseDir, 'up12-physics-ch1-electrostatics-notes.pdf');
  assert.equal(valid.startsWith(baseDir + path.sep), true);

  assert.throws(() => resolveSafeStoragePath(baseDir, '../etc/passwd'));
  assert.throws(() => resolveSafeStoragePath(baseDir, 'sub/nested.pdf'));
  assert.throws(() => resolveSafeStoragePath(baseDir, 'malicious.exe'));
});

test('sanitizeDownloadFilename strips unsafe characters and forces .pdf extension', () => {
  assert.equal(
    sanitizeDownloadFilename('UP12: Physics / Ch 1 "Notes"'),
    'UP12-Physics-Ch-1-Notes.pdf'
  );
});

test('validateMaterialUploadCandidate enforces PDF MIME type and max file size', () => {
  const ok = validateMaterialUploadCandidate({
    filename: 'chapter-notes.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 500,
  });
  assert.equal(ok.ok, true);

  const badMime = validateMaterialUploadCandidate({
    filename: 'script.js',
    mimeType: 'application/javascript',
    sizeBytes: 200,
  });
  assert.deepEqual(badMime, { ok: false, reason: 'UNSUPPORTED_MIME_TYPE' });

  const tooBig = validateMaterialUploadCandidate({
    filename: 'huge.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 30 * 1024 * 1024,
  });
  assert.deepEqual(tooBig, { ok: false, reason: 'FILE_TOO_LARGE' });
});

test('signed token verification enforces signature, materialId binding, and expiry', () => {
  const secret = 'test-hmac-secret-key';
  const now = 1_700_000_000_000;
  const token = createSignedMaterialToken(
    { materialId: 'mat-1', mode: 'download', uid: 'user-123' },
    secret,
    120,
    now
  );

  const verified = verifySignedMaterialToken(token, 'mat-1', secret, now + 30_000);
  assert.equal(verified?.uid, 'user-123');
  assert.equal(verified?.mode, 'download');

  assert.equal(verifySignedMaterialToken(token, 'mat-other', secret, now + 30_000), null);
  assert.equal(verifySignedMaterialToken(token, 'mat-1', 'wrong-secret', now + 30_000), null);
  assert.equal(verifySignedMaterialToken(token, 'mat-1', secret, now + 180_000), null);
});

test('hasPdfMagicHeader validates authentic PDF byte headers', () => {
  assert.equal(hasPdfMagicHeader(Buffer.from('%PDF-1.7\n...')), true);
  assert.equal(hasPdfMagicHeader(Buffer.from('<html>not a pdf</html>')), false);
});
