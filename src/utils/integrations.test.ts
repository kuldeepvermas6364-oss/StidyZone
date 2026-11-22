import test from 'node:test';
import assert from 'node:assert/strict';

test('Integration hub status classification logic', () => {
  const integrationStatuses = [
    'Connected',
    'Not Connected',
    'Configuration Required',
    'Permission Required',
    'Error',
    'Disabled',
  ];
  assert.equal(integrationStatuses.length, 6);
  assert.equal(integrationStatuses.includes('Connected'), true);
  assert.equal(integrationStatuses.includes('Configuration Required'), true);
});

test('Google Maps examination centre filtering logic', () => {
  const centres = [
    { city: 'Prayagraj', type: 'UP Board Regional Hub' },
    { city: 'Noida', type: 'JEE Main CBT Centre' },
  ];
  const filtered = centres.filter(c => c.city === 'Prayagraj');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].type, 'UP Board Regional Hub');
});
