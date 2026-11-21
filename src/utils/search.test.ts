import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_MODULES } from '../config/modules';
import { filterModulesByQuery, type SearchableModuleItem } from './search';

const sampleItems: SearchableModuleItem[] = [
  {
    module: PLATFORM_MODULES[1],
    labelEn: 'UP Board Class 12',
    labelHi: 'यूपी बोर्ड कक्षा 12',
    keywords: ['upmsp', 'board', 'physics', 'chemistry', 'कक्षा 12'],
  },
  {
    module: PLATFORM_MODULES[6],
    labelEn: 'Practice & Mock Tests',
    labelHi: 'अभ्यास व मॉक टेस्ट',
    keywords: ['quiz', 'cbt', 'nta', 'मॉक टेस्ट'],
  },
];

test('matches English module labels and keywords', () => {
  const res = filterModulesByQuery(sampleItems, 'mock');
  assert.equal(res.length, 1);
  assert.equal(res[0].module.id, 'practice-tests');
});

test('matches Hindi module labels and keywords', () => {
  const res = filterModulesByQuery(sampleItems, 'यूपी बोर्ड');
  assert.equal(res.length, 1);
  assert.equal(res[0].module.id, 'up-board-12');
});

test('returns bounded defaults on empty query', () => {
  const res = filterModulesByQuery(sampleItems, '   ');
  assert.equal(res.length, 2);
});
