# Security Risk Analysis Wiki

## Risk Model

Risks are classified from likelihood and impact values on a 1 to 5 scale.

- `Critical`: score of 16 or higher.
- `High`: score from 9 to 15.
- `Medium`: score from 4 to 8.
- `Low`: score below 4.

## Current Controls

- User-entered report content is written with `textContent`.
- Notes are capped at 800 characters.
- The app avoids external network calls.
- npm audit is available through `npm run security:audit`.
- E2E tests include a script-like input case to confirm text display behavior.

## Secure Usage Guidance

- Do not put secrets, tokens, passwords, or customer data in analyst notes.
- Review dependency updates before merging.
- Keep generated reports out of public channels if they contain sensitive release context.
- Treat browser storage as convenience state, not secure storage.

## Future Hardening Ideas

- Add Content Security Policy headers when the app is deployed behind a server.
- Add automated accessibility checks to the E2E suite.
- Add signed release artifacts if reports become compliance evidence.
