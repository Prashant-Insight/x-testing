export function calculateScore(items) {
  if (items.length === 0) {
    return 0;
  }

  const completed = items.filter((item) => item.done).length;
  return Math.round((completed / items.length) * 100);
}

export function classifyRisk({ likelihood, impact }) {
  const score = likelihood * impact;

  if (score >= 16) {
    return 'Critical';
  }

  if (score >= 9) {
    return 'High';
  }

  if (score >= 4) {
    return 'Medium';
  }

  return 'Low';
}

export function buildReport({ score, notes, completedScenarios }) {
  const status = score >= 80 ? 'Ready for release review' : 'Needs more validation before release';

  return [
    'X Testing Readiness Report',
    `Status: ${status}`,
    `Completion Score: ${score}%`,
    `Completed Scenarios: ${completedScenarios}`,
    `Analyst Notes: ${notes || 'No notes added'}`,
  ].join('\n');
}
