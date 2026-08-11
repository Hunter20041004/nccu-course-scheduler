# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- README now describes the project as an open-source planning tool rather than a
  portfolio piece, and documents the two patterns the repository is a reference for:
  AI-proposes / local-rules-decide, and bring-your-own-key with nothing persisted
  server-side.

### Added

- `SECURITY.md` documenting the private reporting channel, the API-key and user-data
  boundaries, and what is out of scope.
- This changelog.

## [0.1.0] — 2026-07-27

First tagged release. The application was already deployed and in use at this point; this
tag marks the state of the code at that deployment so it can be referenced and depended
on.

### Added

- **Course workspace.** Every new visitor starts from an empty personal workspace.
  Candidate lists and schedules persist per browser via versioned local storage, with
  migration for older saved data.
- **Official course search.** Search the NCCU 115-1 public course catalogue by course
  name, instructor, or nine-digit course code. No API key required.
- **NCCU period model.** Renders the university's A/B/1–H period grid across Monday to
  Sunday, including asynchronous courses.
- **Eligibility conditions.** Generates checkable conditions from official course
  restrictions, including exclusive audience restrictions, and lets users add their own
  programme, year, double-major, or prerequisite conditions.
- **Conflict and prerequisite checking.** Flags time conflicts and blocked prerequisites
  before a course is committed to the schedule.
- **Internship planning.** Finds open internship windows automatically, or works backwards
  from a fixed number of days and time ranges. Separates confirmed from unconfirmed
  availability rather than over-promising.
- **AI screenshot import.** Reads a screenshot of a candidate course list and turns it
  into structured courses, using a user-supplied Gemini API key.
- **AI plan recommendations with deterministic validation.** Produces up to three
  candidate schedules. Each is checked locally against locked courses, minimum credits,
  internship-day commitments, time conflicts, unoffered courses, and invalid
  asynchronous selections. Plans that fail are discarded, not shown.
- **Undo.** Clearing, deleting, and applying a plan can each be reversed within 15
  seconds.
- **Transfer.** Export and import a key-free schedule JSON to move between devices.
- **Phone wallpaper export.** Renders the schedule as a phone wallpaper image.
- **Mobile-first reading.** Narrow screens default to an agenda view with the full period
  grid still available.
- **Quality gates.** Unit tests, rendered-HTML tests, a live contract test against the
  university course endpoint, and CI on every push.

[Unreleased]: https://github.com/Hunter20041004/nccu-course-scheduler/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Hunter20041004/nccu-course-scheduler/releases/tag/v0.1.0
