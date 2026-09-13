# Siko Mendo HRIS

A comprehensive Human Resources Management Information System (HRIS) built for the Siko Mendo Union. This full-stack web application manages employee records, attendance tracking, leave management, cooperative oversight, and organizational reporting — all with role-based access control and audit logging.

## Table of Contents

- [What This Is](#what-this-is)
- [Key Features](#key-features)
- [Stack](#stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [One-Command Setup](#one-command-setup)
  - [Manual Setup](#manual-setup)
- [Development](#development)
  - [Scripts](#scripts)
  - [Testing](#testing)
  - [Code Quality](#code-quality)
- [Architecture](#architecture)
  - [Authentication & Authorization](#authentication--authorization)
  - [Database](#database)
  - [File Storage](#file-storage)
  - [Security](#security)
- [Features in Detail](#features-in-detail)
- [API Routes](#api-routes)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## What This Is

**Siko Mendo HRIS** is a modern, role-based employee management system designed specifically for the Siko Mendo Union and its member cooperatives in Ethiopia. It provides comprehensive HR capabilities including:

- **Employee Management**: Complete employee records with profile pictures, employment contracts, and history
- **Attendance Tracking**: Real-time check-in/check-out with policy-driven status classification
- **Leave Management**: Submit, approve, and track various leave types with entitlement management
- **Cooperative Oversight**: Register and monitor member cooperatives with financial tracking
- **Reporting & Analytics**: Generate PDF/CSV reports with role-based filtering
- **Lifecycle Management**: Onboarding and offboarding workflows
- **Audit Logging**: Complete audit trail of all system actions for compliance
- **Multi-role RBAC**: Granular permissions for Admin, HR Officer, Manager, and Employee roles

---

## Key Features

### 🔐 Authentication & Authorization
- Username/password authentication via Better Auth
- Session-based auth with HTTP-only cookies (7-day expiry)
- First-login forced password change
- Role-based access control (RBAC) with granular per-action permissions
- Account suspension (ban/unban) with immediate session revocation
- Audit logging of all user actions

### 👥 Employee Management
- Full CRUD with soft deletes (`deletedAt`)
- Extended info: education, emergency contacts, employment history
- Profile image uploads via Cloudinary
- Employment history (append-only for audit integrity)
- Manager-subordinate hierarchy
- Employment status lifecycle: `ONBOARDING → ACTIVE → ON_LEAVE → RESIGNED / RETIRED / TERMINATED`

### 📅 Attendance Tracking
- Self check-in/check-out (all roles via My Attendance)
- Policy-driven status: `PRESENT`, `LATE`, `HALF_DAY`, `ABSENT`, `EXCUSED`, `ON_LEAVE`
- Configurable work start time, grace period, and half-day threshold
- Admin-only management view (record/correct attendance for other employees)
- Read-only monitoring for HR Officers and Managers
- Leave integration: approved leave auto-creates `ON_LEAVE` records

### 🏖️ Leave Management
- Types: `ANNUAL`, `SICK`, `EMERGENCY`, `MATERNITY`, `PATERNITY`, `UNPAID`
- Configurable entitlements per leave type (org-wide defaults)
- Inclusive calendar-day counting (weekends included by default)
- Manager-only approval routing
- Leave notifications (submission, approval, rejection)
- Leave cancellation removes linked attendance records

### 🏢 Cooperative Management
- Register cooperatives with full registration and financial details
- Share tracking (count, price, total value — auto-calculated)
- Member demographics (male/female counts with cross-field validation)
- Location (district, kebele) and contact info
- Soft delete / restore

### 📊 Reporting & Analytics
- **Types**: Employee Directory, Attendance Summary, Cooperative Listing, Headcount, Audit Log, Leave Summary
- **Formats**: PDF (jsPDF) and CSV (plain RFC 4180)
- Role-scoped report generation (Manager sees only subordinates)
- Cloudinary-stored reports with short-lived signed download URLs

### ✅ Lifecycle Management
- **Onboarding**: HR-tracked checklist computed from real data (contracts, documents, user account)
- **Offboarding**: Reason-tracked departure workflow with user account deactivation
- Audit log entries at each lifecycle stage

### 🔍 Audit Logging
- Append-only `AuditLog` table
- Every server action logs: actor, entity, entity ID, before/after changes, timestamp
- Filterable audit log page (Admin only)

### 🔔 Notifications
- In-app notifications for account events, leave decisions, and lifecycle milestones
- Notification bell in sidebar with unread count

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.9 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL 16+ via Prisma 7 |
| Auth | Better Auth 1.6.22 (username + session) |
| File Storage | Cloudinary (images, documents, reports) |
| Validation | Zod 4 |
| Testing | Vitest 4 |
| Linting | ESLint 9 |
| CI | GitHub Actions |

---

## Project Structure

```
siko-mendo-hris/
├── app/
│   ├── (auth)/                   # Public auth pages (sign-in, force-password-change)
│   ├── (dashboard)/              # Protected app pages (require session)
│   │   ├── dashboard/            # Analytics overview
│   │   ├── employees/            # Employee CRUD + lifecycle sub-pages
│   │   ├── attendance/           # Sub-routes: mine, management, monitoring, team, policy
│   │   ├── leave/                # Leave requests + policy
│   │   ├── cooperatives/         # Cooperative management
│   │   ├── departments/          # Department & position management
│   │   ├── reports/              # Report generation + history
│   │   ├── audit-log/            # Audit trail viewer
│   │   ├── users/                # User account management
│   │   ├── settings/             # Organisation + security settings
│   │   ├── my-documents/         # Employee document self-service
│   │   └── profile/              # User profile
│   └── api/
│       ├── auth/[...all]/        # Better Auth catch-all
│       ├── health/               # GET /api/health — DB + migration status
│       ├── reports/[id]/         # Authenticated report download proxy
│       └── settings/backup/[id]/ # Backup file download proxy
│
├── features/                     # Feature-scoped business logic
│   ├── attendance/
│   │   ├── actions.ts            # Admin-only attendance mutations
│   │   ├── admin-actions.ts      # Admin check-in/out for other employees
│   │   ├── self-actions.ts       # Self check-in/out (all roles)
│   │   ├── policy-actions.ts     # Attendance policy CRUD
│   │   ├── policy-queries.ts     # Load active policy
│   │   ├── queries.ts            # Daily register, history, stats
│   │   ├── schemas.ts            # Zod validation
│   │   └── *.tsx                 # UI panels and components
│   ├── cooperatives/
│   │   ├── form-sections/        # Extracted form section components (+ tests)
│   │   ├── cooperative-form.tsx  # Orchestrator form (~120 LOC)
│   │   └── schemas.test.ts       # ✅ Validation tests
│   ├── employees/                # Employee CRUD, bulk import, system accounts
│   ├── leave/
│   │   ├── actions.ts            # Submit, cancel, decide leave + attendance sync
│   │   └── schemas.test.ts       # ✅ Day-count math + validation tests
│   ├── lifecycle/                # Onboarding + offboarding workflows
│   ├── reports/                  # PDF/CSV builders
│   └── ...
│
├── lib/
│   ├── env.ts                    # Zod env validation (throws on missing vars)
│   ├── permissions.ts            # RBAC: roles, actions, can() helper
│   │   └── permissions.test.ts   # ✅ RBAC matrix tests
│   ├── attendance-policy.ts      # Policy engine: evaluateCheckInStatus()
│   │   └── attendance-policy.test.ts # ✅ 35 policy engine tests
│   ├── attendance-date.ts        # Org-local timezone helpers (EAT = UTC+3)
│   ├── credentials.ts            # Secure temp password generation
│   │   └── credentials.test.ts   # ✅ Generation + complexity tests
│   ├── ethiopian-calendar.ts     # Gregorian ↔ Ethiopian calendar conversion
│   │   └── ethiopian-calendar.test.ts # ✅ Conversion tests
│   ├── session.ts                # requireSession / requirePermission helpers
│   ├── action-utils.ts           # withPermission() wrapper for server actions
│   ├── cloudinary.ts             # Upload, signed URL generation, delete
│   ├── notifications.ts          # createNotification() helper
│   └── prisma.ts                 # Prisma client singleton
│
├── components/
│   ├── ui/                       # Custom component library (no shadcn/Radix)
│   └── dashboard/                # Sidebar, shell, nav config
│
├── prisma/
│   ├── schema.prisma             # 30+ model schema
│   ├── migrations/               # Migration history
│   └── seed.ts                   # Idempotent org structure seed
│
├── scripts/
│   ├── db-health-check.ts        # Verify DB connectivity + schema integrity
│   ├── validate-env.ts           # Validate all required env vars
│   ├── health-check.ts           # Call /api/health from CLI
│   ├── dev-setup.ts              # One-command dev environment setup
│   ├── dev-clean.ts              # Reset local dev state (DB + .next)
│   ├── pre-deploy-check.ts       # Full pre-deploy validation checklist
│   ├── promote-admin.ts          # Promote existing user to ADMIN
│   ├── reset-admin-password.ts   # Reset admin password
│   └── patch-better-auth.js      # Postinstall: remove dev-source exports
│
├── test/
│   └── server-only-stub.ts       # Vitest alias for Next.js server-only guard
│
├── .github/workflows/ci.yml      # Two-job CI: lint/test + build with Postgres
├── .env.example                  # Required env var template
├── vitest.config.ts              # Vitest config with @/ alias
├── TESTING.md                    # Testing guide and conventions
└── AGENTS.md                     # Notes for AI coding agents
```

---

## Getting Started

### Prerequisites

- **Node.js 22+**
- **PostgreSQL 16+** running locally
- **Cloudinary account** (free tier is sufficient)
- **Git**

### One-Command Setup

```bash
git clone https://github.com/mu534/SikoMendo.git
cd siko-mendo-hris
npm run dev:setup
```

This will:
1. Copy `.env.example` → `.env.local` and stop so you can fill in your credentials
2. On subsequent runs: install deps, generate Prisma client, run migrations, seed data

### Manual Setup

**1. Clone and install**
```bash
git clone https://github.com/mu534/SikoMendo.git
cd siko-mendo-hris
npm ci
```

**2. Configure environment**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/siko_mendo_hris"

# App URL (must match where the app runs)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BETTER_AUTH_URL="http://localhost:3000"

# Better Auth — generate with: openssl rand -hex 32
BETTER_AUTH_SECRET="your-32-character-minimum-secret-key"

# Cloudinary (cloud.cloudinary.com → Dashboard)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

**3. Set up the database**
```bash
# Create database (if it doesn't exist)
createdb siko_mendo_hris

# Run all migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed org structure (departments + positions)
npx prisma db seed
```

**4. Create the first admin account**

Sign up through the app, then promote the user:
```bash
npx tsx scripts/promote-admin.ts <username>
```

**5. Run the development server**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Development

### Scripts

```bash
# ── Dev ──────────────────────────────────────────────────
npm run dev               # Start development server
npm run dev:setup         # One-command local setup (first time)
npm run dev:clean         # Reset local dev state (DB reset + .next deleted)

# ── Build & Start ────────────────────────────────────────
npm run build             # Production build
npm start                 # Start production server

# ── Quality ──────────────────────────────────────────────
npm run lint              # ESLint
npx tsc --noEmit          # TypeScript type check

# ── Tests ────────────────────────────────────────────────
npm test                  # Run all unit tests (once)
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report

# ── Ops & Validation ────────────────────────────────────
npm run env:validate      # Validate all required env vars
npm run db:health         # Check DB connectivity + migration status
npm run db:seed           # Re-run the org structure seed
npm run health:check      # Call /api/health endpoint (app must be running)

# ── Prisma ───────────────────────────────────────────────
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma migrate dev    # Create + apply a new migration (dev only)
npx prisma migrate deploy # Apply pending migrations (production)
npx prisma studio         # Open Prisma web UI
npx prisma db seed        # Seed database
```

### Testing

Uses **Vitest** for pure unit tests (no database, no browser required).

**Current coverage — 13 test files, 113 tests:**

| File | What it tests |
|---|---|
| `lib/permissions.test.ts` | RBAC matrix — every role × action |
| `lib/credentials.test.ts` | Password generation strength and uniqueness |
| `lib/ethiopian-calendar.test.ts` | Gregorian ↔ Ethiopian calendar conversion |
| `lib/attendance-policy.test.ts` | Policy engine: PRESENT/LATE/HALF_DAY classification |
| `lib/attendance-policy.test.ts` | Working-day detection, policy row normalisation |
| `features/leave/schemas.test.ts` | Day-count math, leave request/decision validation |
| `features/cooperatives/schemas.test.ts` | Member count cross-field validation |
| `features/cooperatives/form-utils.test.ts` | `toDateInputValue()` edge cases |
| `features/cooperatives/form-sections/BasicInformationSection.test.ts` | Date formatting, isActive mapping |
| `features/cooperatives/form-sections/AddressInformationSection.test.ts` | Field fallbacks |
| `features/cooperatives/form-sections/RegistrationDetailsSection.test.ts` | Share value calculation |
| `features/cooperatives/form-sections/MembershipSection.test.ts` | Member mismatch detection |
| `features/cooperatives/form-sections/CapitalSection.test.ts` | Capital calculation |
| `features/cooperatives/form-sections/ContactSection.test.ts` | Optional field fallbacks |

**What requires a real database (not covered by unit tests):**
- Server action integration (Prisma mutations)
- Authentication flows
- File uploads

See [TESTING.md](./TESTING.md) for conventions and guidance.

### Code Quality

```bash
npm run lint          # Must pass before merging
npx tsc --noEmit      # Zero TypeScript errors required
npm test              # All tests must pass
```

---

## Architecture

### Authentication & Authorization

**Better Auth** handles session management:
- Username/password with bcryptjs hashing (min 8 chars)
- Sessions stored server-side, delivered via HTTP-only cookies (7-day expiry)
- `mustChangePassword` flag forces new accounts to set their own password on first login
- Account ban/unban mechanism for suspension

**RBAC** (`lib/permissions.ts`):
- 4 roles: `ADMIN`, `HR_OFFICER`, `MANAGER`, `EMPLOYEE`
- Explicit permission arrays per role — no implicit inheritance
- `can(role, action)` pure function used in both pages and server actions
- `withPermission(session, action, handler)` in `lib/action-utils.ts` wraps every mutation
- `requirePermission(action)` at page level redirects unauthorised users to `/dashboard`

**Role capabilities summary:**

| Capability | ADMIN | HR_OFFICER | MANAGER | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|
| Manage users/roles | ✅ | — | — | — |
| Manage employees | ✅ | ✅ | — | — |
| View all employees | ✅ | ✅ | ✅ | — |
| Manage others' attendance | ✅ | — | — | — |
| View all attendance | ✅ | ✅ | ✅ | — |
| Self attendance | ✅ | ✅ | ✅ | ✅ |
| Configure attendance policy | ✅ | — | ✅ | — |
| Approve/reject leave | — | — | ✅ | — |
| View all leave | — | ✅ | ✅ | — |
| Manage cooperatives | ✅ | ✅ | — | — |
| Generate reports | ✅ | ✅ | ✅ | — |
| View audit log | ✅ | — | — | — |
| Manage settings | ✅ | — | — | — |

### Database

**PostgreSQL + Prisma ORM:**

Key design decisions:
- **Append-only tables**: `EmploymentHistory`, `Contract` — never edited, only appended
- **Soft deletes**: `Employee`, `Cooperative`, `Document` use `deletedAt: DateTime?`
- **Unique constraints**: `@@unique([employeeId, date])` on `Attendance` (one record per employee per day)
- **Singleton pattern**: `OrgSettings`, `AttendancePolicy` use `id = "singleton"`
- **Timezone**: Attendance dates stored as `@db.Date` (midnight UTC = org-local date in EAT UTC+3)

### File Storage

**Cloudinary** stores all binary assets:
- Employee profile images: `siko-mendo/employees`
- HR documents: `siko-mendo/documents` (authenticated delivery)
- Generated reports: `siko-mendo/reports` (authenticated delivery)

Authenticated assets are served via short-lived signed URLs (5-minute expiry) generated fresh on every page load — the raw Cloudinary URL returns 401.

Downloads are proxied through Next.js API routes (`/api/reports/[id]`, `/api/settings/backup/[id]`) to set correct `Content-Disposition` headers.

### Security

- **Env validation**: Zod schema at startup (`lib/env.ts`) — app refuses to start with missing vars
- **Input validation**: Every server action validates input with Zod before touching the database
- **Parameterised queries**: Prisma ORM — no raw SQL string interpolation
- **CSRF protection**: Server Actions use Next.js's built-in origin verification
- **Password security**: bcryptjs hashing; temp passwords generated with `crypto.randomBytes`
- **Dependency security**: `npm overrides` pins `fast-uri`, `browserslist`, `brace-expansion` to patched versions
- **No permanent deletion**: Soft deletes only through normal HR workflows (Admin can restore)
- **Self-attendance security**: Employee ID is always derived from the authenticated session — never trusted from client input

---

## Features in Detail

### Attendance Policy Engine

The policy engine (`lib/attendance-policy.ts`) determines attendance status from check-in time:

```
Work start: 08:00
Grace period: 15 min  →  08:00–08:15 = PRESENT
                          08:16+      = LATE
Half-day threshold: 120 min →  08:16–10:15 = LATE
                               10:16+       = HALF_DAY
```

Status is calculated **at check-in time** and stored permanently. Changing the policy later does **not** recalculate historical records.

### Leave ↔ Attendance Integration

When a manager approves a leave request:
- `ON_LEAVE` attendance records are created for each day in the leave range (`skipDuplicates: true`)
- Self check-in is blocked on approved leave days

When a leave request is cancelled after approval:
- The `ON_LEAVE` attendance records are removed
- Normal attendance processing resumes for those dates

Both operations run in a `prisma.$transaction` to prevent inconsistent state.

### Ethiopian Calendar

The application displays dates in both Gregorian and Ethiopian calendar formats using a pure-function conversion library (`lib/ethiopian-calendar.ts`). The conversion uses Julian Day Number as an intermediate, verified against the Ethiopian Millennium anchor (Meskerem 1, 2000 E.C. = September 12, 2007 Gregorian).

---

## API Routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/[...all]` | ANY | — | Better Auth handler |
| `/api/health` | GET | — | App health status (DB, migrations) |
| `/api/reports/[id]` | GET | Session | Download report file with correct headers |
| `/api/settings/backup/[id]` | GET | ADMIN | Download backup file |

### `GET /api/health`

Returns system health. Used by uptime monitors and CI post-deploy checks.

```json
{
  "status": "ok",
  "checks": {
    "database": { "ok": true, "latencyMs": 4 },
    "migrations": { "ok": true, "message": "12 migration(s) applied" }
  },
  "timestamp": "2026-09-13T18:00:00.000Z"
}
```

HTTP 200 = `ok` or `degraded` · HTTP 503 = `down`

---

## Deployment

### Requirements
- Node.js 22+
- PostgreSQL 16+ (managed: Railway, Supabase, RDS, etc.)
- Cloudinary account

### Environment Variables

All variables from `.env.example` are required. Validate before deploying:

```bash
npm run env:validate
```

### Build & Start

```bash
npm run build
npm start
```

### Pre-Deploy Checklist

```bash
npm run predeploy
```

Runs: env validation → TypeScript check → lint → unit tests → migration status.

### CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) has two jobs:

**Job 1 — `lint-typecheck-test`** (no database needed):
- ESLint
- `tsc --noEmit`
- Vitest unit tests
- `npm audit --audit-level=critical`

**Job 2 — `build`** (depends on Job 1):
- Spins up `postgres:16-alpine` as a service
- Validates environment variables
- Runs `prisma migrate deploy`
- Runs `npm run db:health`
- Runs `npm run build`
- Seeds org structure

### Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
```

Run migrations before starting:
```bash
docker exec <container> npx prisma migrate deploy
```

---

## Contributing

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Follow the existing feature-based structure (`features/<domain>/`)
3. Write tests for any business logic (policy engines, validators, calculators)
4. One focused commit per change — pair tests with the feature in the same commit
5. Conventional commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`
6. Run the full quality suite before opening a PR:
   ```bash
   npm run lint && npx tsc --noEmit && npm test
   ```

### Commit Convention

Each commit should be independently testable:

```
feat: extract MembershipSection with member-mismatch tests
fix: lowercase employee username on account creation
test: add attendance policy engine coverage (35 tests)
chore: pin fast-uri >=3.1.6 to fix GHSA-7p8r-x3mc-p8w7
```

---

## License

Proprietary software for Siko Mendo Union. All rights reserved.

---

**Last Updated**: September 2026
**Version**: 0.1.0
**Tests**: 113 passing across 13 files
**Status**: Active Development
