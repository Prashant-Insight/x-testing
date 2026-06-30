# X Testing Dashboard

X Testing Dashboard is a lightweight, interactive web app for tracking end-to-end testing readiness, security risks, release notes, and generated readiness reports. It was built to turn this repository from a placeholder into a practical quality and security analysis workspace.

## Features

- Interactive end-to-end testing checklist with persistent browser state.
- Live readiness score that updates as scenarios are completed.
- Security risk register with likelihood, impact, severity, and mitigation guidance.
- Analyst notes area with safe text rendering and an exportable release report.
- Responsive, accessible interface with light and dark themes.
- Unit tests, browser-based E2E tests, linting, production build, and npm audit scripts.

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Validation

Run all checks before opening or merging a change:

```bash
npm run compile
npm run lint
npm test
npm run security:audit
```

If Playwright browsers are not installed on a new machine, run:

```bash
npx playwright install chromium
```

## Project Structure

```text
.
├── docs/
│   ├── setup.md
│   ├── technical.md
│   └── wiki/
├── src/
│   ├── main.js
│   ├── readiness.js
│   ├── risk-data.js
│   └── styles.css
├── tests/
│   ├── e2e/
│   └── unit/
├── index.html
├── playwright.config.js
└── eslint.config.js
```

## Security Notes

- User notes are rendered with `textContent`, not executable HTML.
- Browser storage is used only for checklist state, theme, and non-sensitive notes.
- The app does not send user data to any external service.
- Dependency risk is checked with `npm run security:audit`.

## Documentation

- Technical design: `docs/technical.md`
- Setup guide: `docs/setup.md`
- Wiki overview: `docs/wiki/home.md`
- Security analysis: `docs/wiki/security-risk-analysis.md`
- E2E testing strategy: `docs/wiki/end-to-end-testing.md`
- Feature roadmap: `docs/wiki/feature-roadmap.md`
