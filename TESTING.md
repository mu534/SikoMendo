# Testing

This project uses [Vitest](https://vitest.dev) for unit tests.

```
npm test          # run once
npm run test:watch  # watch mode while developing
```

## What's covered right now

Only **pure business logic that doesn't need a database** — the kind of
code where a subtle bug is easy to introduce and easy to miss in review:

- `features/leave/schemas.test.ts` — leave day-count math (inclusive
  calendar days, explicitly *not* excluding weekends — see the test's
  comment if that's ever meant to change) and the submit/decision form
  validation rules.
- `lib/permissions.test.ts` — the manager-only leave approval permission
  matrix. This exists specifically so an accidental edit to
  `lib/permissions.ts` that reintroduces HR or Admin approval authority (or
  breaks HR's read-only oversight) fails a test instead of shipping
  silently.
- `features/cooperatives/schemas.test.ts` — the male + female = total
  members cross-field validation.
- `lib/credentials.test.ts` — the temp password generator: always passes
  the strength policy, never uses visually-ambiguous characters, and
  actually varies between calls.

## What's NOT covered yet

Everything that touches the database — the server actions in
`features/*/actions.ts` (leave submission/approval routing, employee
create/update, RBAC enforcement via `withPermission`, audit logging) isn't
tested yet. That requires either:

1. A real test Postgres database (spun up in CI, migrated, seeded, and
   torn down per run) with Prisma pointed at it, or
2. Mocking the Prisma client, which tends to test the mock more than the
   real behavior for logic this data-dependent.

Option 1 is the more trustworthy path if you want to extend coverage here
— a `docker-compose` Postgres service in the CI workflow, running
`prisma migrate deploy` against it before the test step, is the standard
approach. That's a deliberately separate, bigger piece of work from what's
set up here.

## Adding a new test

Any new pure function (no `prisma` import, no `fetch`, no filesystem)
belongs in `<same-folder>/<same-file-name>.test.ts`, following the existing
files as a pattern. If the function needs `"server-only"`, no extra setup
is needed — `vitest.config.ts` already aliases it to a no-op stub for tests
(it's a Next.js webpack-only guard with nothing to check in plain Node).
