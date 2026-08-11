# Security Policy

## Supported versions

This project is deployed as a static web application. Only the latest release and the
current `main` branch receive security fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

1. Preferred: open a private report through GitHub Security Advisories on this
   repository (Security → Report a vulnerability).
2. Alternative: email the maintainer at the address on the commits in this repository.

Please include what you were doing, what happened, and a way to reproduce it. You will
get an acknowledgement within 7 days. If a fix is needed, the maintainer will agree a
disclosure timeline with you before publishing.

## Threat model and security boundaries

This application is a browser-side planner with a small serverless helper for course
search and AI calls. The security boundaries below are intentional and tested.

### API keys

- AI features use a **user-supplied Gemini API key** (bring-your-own-key).
- The key is held in the current browser session only. It is not written to disk by the
  application, not sent anywhere except the AI provider, and not included in any export.
- Exported schedule JSON is **key-free by design**; this is covered by tests.
- No API key is ever committed to this repository. If you believe a key has leaked into
  the history, report it through the private channel above.

### User data

- Schedule data lives in the browser's local storage on the user's own device. There is
  no user account and no server-side profile.
- Uploaded screenshots and planning prompts are **not persisted** server-side. They are
  passed through for the duration of the request and discarded.
- Clearing site data, switching browsers, or switching devices produces a fresh, empty
  workspace. There is no cross-device sync.

### Course data

- Course information is read from the university's public course endpoints. The project
  neither scrapes authenticated pages nor stores credentials for any university system.

### What is out of scope

- The security of the user's own Gemini API key once it leaves the browser for the AI
  provider.
- Availability or correctness of the upstream university course endpoints.
- Course-selection outcomes. This tool assists planning; it does not register courses and
  makes no guarantee that a validated plan will be enrollable.
