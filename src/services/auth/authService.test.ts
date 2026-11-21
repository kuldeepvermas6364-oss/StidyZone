import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthFoundationError,
  signInWithGoogleFoundation,
  validateEmailFormat,
  validateFullName,
  validatePasswordStrength,
} from './authService';

test('validates registration fields strictly', () => {
  assert.equal(validateFullName('Aarav Verma'), true);
  assert.equal(validateFullName('A'), false);
  assert.equal(validateEmailFormat('student@example.com'), true);
  assert.equal(validateEmailFormat('invalid-email'), false);
  assert.equal(validatePasswordStrength('Pass1234'), true);
  assert.equal(validatePasswordStrength('short'), false);
});

test('Google sign-in explicitly reports unconfigured Firebase state', () => {
  assert.throws(
    () => signInWithGoogleFoundation(),
    (err: unknown) =>
      err instanceof AuthFoundationError && err.code === 'GOOGLE_REQUIRES_FIREBASE'
  );
});
