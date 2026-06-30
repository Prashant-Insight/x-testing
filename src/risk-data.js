export const testScenarios = [
  {
    id: 'login-flow',
    label: 'Validate happy-path user journey from landing page to report export',
    category: 'Critical path',
  },
  {
    id: 'responsive-flow',
    label: 'Verify responsive layout and keyboard navigation on mobile and desktop',
    category: 'Accessibility',
  },
  {
    id: 'data-persistence',
    label: 'Confirm checklist and notes persist safely in local storage',
    category: 'State',
  },
  {
    id: 'security-review',
    label: 'Review dependency audit, input handling, and generated report behavior',
    category: 'Security',
  },
  {
    id: 'failure-recovery',
    label: 'Test reset, empty notes, and partial completion edge cases',
    category: 'Resilience',
  },
];

export const risks = [
  {
    title: 'Untrusted input displayed in reports',
    description: 'Analyst notes can include arbitrary text that must never execute as markup or script.',
    likelihood: 2,
    impact: 5,
    mitigation: 'Render user-provided notes with textContent and limit note length to 800 characters.',
  },
  {
    title: 'Incomplete release coverage',
    description: 'A release may proceed without enough end-to-end coverage for critical user paths.',
    likelihood: 4,
    impact: 4,
    mitigation: 'Track a visible readiness score and require review when completion is below 80%.',
  },
  {
    title: 'Dependency vulnerabilities',
    description: 'Outdated packages can introduce build-time or runtime security exposure.',
    likelihood: 3,
    impact: 4,
    mitigation: 'Run npm audit and keep dependency upgrades small, reviewed, and tested.',
  },
  {
    title: 'Local data exposure',
    description: 'Browser storage is convenient but should not contain secrets or regulated data.',
    likelihood: 3,
    impact: 3,
    mitigation: 'Store only checklist state and non-sensitive notes; document this limitation clearly.',
  },
];
