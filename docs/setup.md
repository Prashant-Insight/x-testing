# Setup Document

## Prerequisites

- Node.js 20 or newer is recommended.
- npm is required for dependency installation and scripts.

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the Vite URL shown in the terminal.

## Run Validation

```bash
npm run compile
npm run lint
npm test
npm run security:audit
```

## Playwright Browser Setup

On first use, install the Chromium browser used by the E2E test suite:

```bash
npx playwright install chromium
```

## Troubleshooting

- If `npm test` fails because a browser is missing, run `npx playwright install chromium` and retry.
- If port `4173` is busy during E2E tests, stop the process using that port and rerun `npm run test:e2e`.
- If local notes look stale, use the dashboard reset button or clear site data in the browser.
