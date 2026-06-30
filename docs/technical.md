# Technical Document

## Overview

The application is a Vite-powered static frontend that helps teams plan end-to-end validation and security review before release. It uses browser APIs only, so it can run locally without a backend service.

## Architecture

- `index.html` provides the root application container and loads the JavaScript entrypoint.
- `src/main.js` mounts the interface, manages state, calculates readiness, and generates reports.
- `src/readiness.js` contains pure scoring, risk classification, and report generation functions.
- `src/risk-data.js` stores testing scenarios and security risk metadata.
- `src/styles.css` contains responsive layout, theme styles, and component styling.
- `tests/unit/app.test.js` covers pure readiness and report logic.
- `tests/e2e/app.spec.js` validates browser behavior with Playwright.

## State Management

The app stores only low-sensitivity data in `localStorage`:

- Checklist completion state.
- Analyst notes.
- Theme preference.

Do not store passwords, tokens, production customer data, regulated data, or secrets in the notes field.

## Security Risk Analysis

| Risk | Severity Driver | Mitigation |
| --- | --- | --- |
| Untrusted input displayed in reports | User-entered notes may include markup-like text | Render report output as text and limit note length |
| Incomplete release coverage | Critical paths may be missed | Track visible checklist score and review scores below 80% |
| Dependency vulnerabilities | Build tooling can become outdated | Run npm audit and review dependency updates |
| Local data exposure | Browser storage is not encrypted | Store only non-sensitive testing notes |

## Testing Strategy

- Unit tests verify deterministic calculation and report behavior.
- E2E tests verify the dashboard loads, checklist updates score, notes persist, and theme switching works.
- Build validation verifies the production bundle compiles.
- Lint validation checks JavaScript consistency and common correctness issues.

## Extensibility

New scenarios can be added to `testScenarios` in `src/risk-data.js`. New risks can be added to `risks` with `title`, `description`, `likelihood`, `impact`, and `mitigation` fields.
