# Security Policy

## Supported versions

This project is deployed as a browser application backed by a same-origin serverless
Worker. Only the latest release and the current `main` branch receive security fixes.

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
- The key is held only in JavaScript memory for the current page. The application does
  not put it in local storage, session storage, cookies, URLs, or exported planner data.
- When the user invokes an AI feature, the browser sends the key in an HTTPS JSON request
  to this application's **same-origin Worker**. The Worker keeps it only for that request
  and forwards it to Google's Gemini API in the `x-goog-api-key` request header. The
  application does not intentionally log or persist the key.
- The key input is cleared immediately after submission, page lifecycle boundaries clear
  the in-memory copy, AI responses are checked for accidental key reflection, and the
  page is served with a nonce-based Content Security Policy and defensive browser headers.
- Exported schedule JSON is **key-free by design**; this is covered by tests.
- No API key is ever committed to this repository. If you believe a key has leaked into
  the history, report it through the private channel above.

These controls substantially reduce accidental disclosure, but **cannot guarantee zero risk**.
A compromised device, malicious browser extensions, a vulnerability that executes
code in the active page, the hosting infrastructure, or the AI provider can still observe
data at their respective trust boundaries. Users should restrict and rotate their Gemini
keys according to Google's guidance and should not reuse unrelated credentials.

### User data

- Schedule data lives in the browser's local storage on the user's own device. There is
  no user account and no server-side profile.
- Uploaded screenshots and planning prompts are **not persisted by this application**.
  AI inputs pass through the same-origin Worker and are sent to the AI provider for the
  requested operation; provider-side handling is governed by that provider's terms.
- Clearing site data, switching browsers, or switching devices produces a fresh, empty
  workspace. There is no cross-device sync.

### Course data

- Course information is read from the university's public course endpoints. The project
  neither scrapes authenticated pages nor stores credentials for any university system.

### What is out of scope

- Security of the user's device, browser profile, browser extensions, hosting
  infrastructure, and the AI provider.
- Availability or correctness of the upstream university course endpoints.
- Course-selection outcomes. This tool assists planning; it does not register courses and
  makes no guarantee that a validated plan will be enrollable.
