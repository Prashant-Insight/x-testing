import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReport, calculateScore, classifyRisk } from '../../src/readiness.js';

test('calculateScore returns zero for an empty checklist', () => {
  assert.equal(calculateScore([]), 0);
});

test('calculateScore rounds completed scenario percentage', () => {
  assert.equal(
    calculateScore([
      { done: true },
      { done: false },
      { done: true },
    ]),
    67,
  );
});

test('classifyRisk maps likelihood and impact to a readable level', () => {
  assert.equal(classifyRisk({ likelihood: 4, impact: 4 }), 'Critical');
  assert.equal(classifyRisk({ likelihood: 3, impact: 3 }), 'High');
  assert.equal(classifyRisk({ likelihood: 2, impact: 2 }), 'Medium');
  assert.equal(classifyRisk({ likelihood: 1, impact: 1 }), 'Low');
});

test('buildReport includes readiness status and analyst notes', () => {
  const report = buildReport({ score: 80, notes: 'Validated checkout flow', completedScenarios: 4 });

  assert.match(report, /Ready for release review/);
  assert.match(report, /Validated checkout flow/);
  assert.match(report, /Completed Scenarios: 4/);
});
