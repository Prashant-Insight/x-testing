# Security Policy

## Supported Scope

This repository currently contains a static local dashboard. Security review focuses on dependency health, browser-side input handling, generated reports, and safe storage guidance.

## Reporting a Vulnerability

Open a private security advisory or contact the repository owner with:

- A clear description of the issue.
- Steps to reproduce.
- Potential impact.
- Suggested mitigation, if known.

Do not include live secrets, production customer data, or exploit payloads beyond what is necessary to demonstrate the issue safely.

## Local Security Checks

```bash
npm run security:audit
npm run lint
npm test
```
