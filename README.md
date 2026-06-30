# x-testing

Repository for testing purposes.

## End-to-end and performance testing

This project uses Playwright to run end-to-end checks and basic browser performance budget assertions.

### Install

```bash
npm install
```

### Run checks

```bash
npm run compile
npm run lint
npm test
```

### Target URL

By default, tests run against a local static site served at `http://127.0.0.1:4173`.
You can set a custom target with `TARGET_URL`:

```bash
TARGET_URL="https://your-site.example" npm test
```

### Performance budgets

The performance test currently enforces:
- `domContentLoaded < 2500ms`
- `loadEventEnd < 4000ms`
- `first-contentful-paint < 2500ms` (when available)
