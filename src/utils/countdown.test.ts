import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExamCountdown,
  clampDailyTargetHours,
  isValidISODateString,
} from './countdown';

test('validates ISO calendar dates strictly', () => {
  assert.equal(isValidISODateString('2027-02-24'), true);
  assert.equal(isValidISODateString('2027-02-29'), false);
  assert.equal(isValidISODateString('not-a-date'), false);
});

test('calculates remaining days, hours, and minutes accurately', () => {
  const now = Date.UTC(2027, 1, 20, 3, 30, 0); // 4 days before 2027-02-24 03:30 UTC
  const result = calculateExamCountdown('2027-02-24', now);
  assert.equal(result.isValid, true);
  assert.equal(result.isPast, false);
  assert.equal(result.days, 4);
  assert.equal(result.hours, 0);
  assert.equal(result.minutes, 0);
});

test('marks elapsed exam dates as past without negative numbers', () => {
  const now = Date.UTC(2027, 2, 1, 10, 0, 0);
  const result = calculateExamCountdown('2027-02-24', now);
  assert.equal(result.isValid, true);
  assert.equal(result.isPast, true);
  assert.equal(result.days, 0);
});

test('clamps daily study target hours within [1, 16] at 0.5h steps', () => {
  assert.equal(clampDailyTargetHours(0), 1);
  assert.equal(clampDailyTargetHours(24), 16);
  assert.equal(clampDailyTargetHours(5.4), 5.5);
  assert.equal(clampDailyTargetHours(Number.NaN), 4);
});
