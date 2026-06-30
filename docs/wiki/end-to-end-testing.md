# End-to-End Testing Wiki

## Goals

The E2E suite verifies that the dashboard works from a user perspective, not only from isolated functions.

## Current Coverage

- Dashboard page loads and key sections are visible.
- Checklist completion updates the readiness score.
- Analyst notes persist after reload.
- Report generation safely displays text input.
- Theme switching updates the page theme.

## Recommended Manual Scenarios

- Complete all checklist items and confirm the score reaches 100%.
- Generate a report with no notes and with detailed notes.
- Use keyboard navigation to reach checklist items, textarea, and buttons.
- Test the page at mobile and desktop viewport widths.
- Reset the checklist and confirm stored state is cleared.

## Quality Gate

A release should not be considered ready until automated checks pass and the readiness checklist is reviewed by a human.
