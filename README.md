# Siko Mendo HRIS

A comprehensive Human Resources Management Information System (HRIS) built for the Siko Mendo Union. This full-stack web application manages employee records, attendance tracking, leave management, cooperative oversight, and organizational reporting—all with role-based access control and audit logging.

## Table of Contents

- [What This Is](#what-this-is)
- [Key Features](#key-features)
- [Stack](#stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
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
- [API & Server Actions](#api--server-actions)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## What This Is

**Siko Mendo HRIS** is a modern, role-based employee management system designed specifically for the Siko Mendo Union and its member cooperatives in Ethiopia. It provides comprehensive HR capabilities including:

- **Employee Management**: Complete employee records with profile pictures, education history, and employment contracts
- **Attendance Tracking**: Real-time check-in/check-out with policy-driven status classification
- **Leave Management**: Submit, approve, and track various leave types with entitlement management
- **Cooperative Oversight**: Register and monitor member cooperatives with financial tracking
- **Reporting & Analytics**: Generate PDF/CSV reports with role-based filtering
- **Lifecycle Management**: Onboarding and offboarding workflows for employee lifecycle tracking
- **Audit Logging**: Complete audit trail of all system actions for compliance
- **Multi-role RBAC**: Hierarchical permissions for Admin, HR Officer, Manager, and Employee roles

---

## Key Features

### 🔐 Authentication & Authorization
- **Better Auth integration** for secure username/password authentication
- **Session-based auth** with secure cookies
- **First-login password change** enforcement
- **Role-based access control (RBAC)** with granular permissions per role
- **Audit logging** of user actions for compliance

### 👥 Employee Management
- Create, read, update employee records
- Store extended information: education, emergency contacts, employment history
- Profile image uploads via Cloudinary
- Employment history tracking (append-only for audit trail)
- Manager-subordinate relationship hierarchies
- Employment status lifecycle (ONBOARDING → ACTIVE → ON_LEAVE → RESIGNED/RETIRED/TERMINATED)

### 📅 Attendance Tracking
- Check-in/check-out recording with timestamps
- Policy-driven status classification (PRESENT, LATE, HALF_DAY, ABSENT, EXCUSED, ON_LEAVE)
- Configurable grace periods and half-day thresholds
- Org-wide attendance policy management
- Read-only attendance monitor for managers and HR officers
- Support for non-standard working days

### 🏖️ Leave Management
- Multiple leave types: ANNUAL, SICK, EMERGENCY, MATERNITY, PATERNITY, UNPAID
- Configurable entitlements per leave type
- Day-count math with inclusive calendar days (weekends not excluded by default)
- Submit leave requests with optional supporting documents
- Manager-only leave approval routing
- Leave history and status tracking
- Notifications for submission, approval, and rejection

### 🏢 Cooperative Management
- Register member cooperatives with full details
- Track financial metrics: registration fees, shares, assets
- Demographics: male/female member counts with validation
- Location tracking (district, kebele)
- Contact management per cooperative

### 📊 Reporting & Analytics
- **Report Types**: Employee Directory, Attendance Summary, Cooperative Listing, Headcount, Audit Log, Leave Summary
- **Formats**: PDF and CSV export
- **Access Control**: Role-based report visibility
- **Dashboard Analytics**: Aggregated metrics by role

### 📄 Document Management
- Upload and store employee documents (contracts, ID, certificates, etc.)
- Cloudinary integration for file storage and signed URLs
- Document type classification
- Soft delete support

### ✅ Lifecycle Management
- **Onboarding**: Track new employee onboarding progress
- **Offboarding**: Document employee departures with reason tracking
- Dynamic checklist completion based on actual data

### 🔍 Audit Logging
- Append-only audit trail of all system actions
- Before/after snapshots of data changes
- IP address and user tracking

### 🔔 Notifications
- Account creation, password reset, and lifecycle event notifications
- Leave submission/approval/rejection alerts
- Contract expiration and missing document alerts

---

## Stack

### Frontend & Runtime
- **Framework**: Next.js 16.2.9 (App Router with React 19.2.4)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + PostCSS

### Backend & Services
- **Database**: PostgreSQL via Prisma 7.8.0
- **Auth**: Better Auth 1.6.20 (username/password + session management)
- **File Storage**: Cloudinary (images, documents, reports)
- **Crypto**: bcryptjs 3.0.3 (password hashing)

### UI & Validation
- **React Hook Form 7.0.0** (form state management)
- **Zod 4.4.3** (schema validation)
- **Recharts 3.10.1** (data visualization)
- **Lucide React 1.21.0** (icons)

### Testing & Quality
- **Vitest 4.1.11** (unit tests)
- **ESLint 9** (code linting)
- **TypeScript** (type safety)

---

## Project Structure

```
SikoMendo/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Public auth pages
│   ├── (protected)/             # Protected app pages
│   │   ├── dashboard/           # Analytics & overview
│   │   ├── employees/           # Employee management
│   │   ├── attendance/          # Attendance tracking
│   │   ├── leave/               # Leave requests
│   │   ├── cooperatives/        # Cooperative oversight
│   │   ├── reports/             # Report generation
│   │   ├── documents/           # Document management
│   │   ├── settings/            # Organization settings
│   │   ├── audit-logs/          # Audit trail
│   │   └── profile/             # User profile
│   └── api/                     # API routes
│
├── components/                   # Reusable React components
│   ├── common/                  # Generic UI components
│   ├── forms/                   # Form components
│   ├── tables/                  # Data tables
│   ├── charts/                  # Visualizations
│   └── navigation/              # Navigation components
│
├── features/                    # Feature-specific business logic
│   ├── employees/               # Employee CRUD & validation
│   ├── attendance/              # Attendance logic
│   ├── leave/                   # Leave request handling
│   │   ├── schemas.test.ts      # ✅ Unit tests
│   │   └── ...
│   ├── cooperatives/            # Cooperative management
│   │   ├── schemas.test.ts      # ✅ Validation tests
│   │   └── ...
│   ├── reports/                 # Report generation
│   ├── auth/                    # Authentication flows
│   ├── onboarding/              # Lifecycle: onboarding
│   ├── offboarding/             # Lifecycle: offboarding
│   └── ...
│
├── lib/                         # Shared utilities
│   ├── env.ts                   # Environment validation
│   ├── session.ts               # Session & user context
│   ├── permissions.ts           # RBAC definitions
│   │   └── permissions.test.ts  # ✅ RBAC tests
│   ├── credentials.ts           # Password generation
│   │   └── credentials.test.ts  # ✅ Generation tests
│   ├── cloudinary.ts            # File operations
│   ├── db.ts                    # Prisma client
│   └── ...
│
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Migration history
│   └── seed.ts                  # Seed script
│
├── public/                      # Static assets
├── scripts/                     # Utility scripts
├── test/                        # Test utilities
│
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions: lint, typecheck, test
│
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript config
├── next.config.ts               # Next.js config
├── vitest.config.ts             # Vitest config
├── TESTING.md                   # Testing guide
├── AGENTS.md                    # Notes for AI agents
└── README.md                    # This file
```

### How It Fits Together

**Request Flow:**
1. Public pages (`/sign-in`) bypass authentication
2. Protected pages check for valid session cookie via middleware
3. Server Actions handle mutations (validate, execute, log, notify)
4. API routes handle webhooks and file uploads
5. Cloudinary stores files and serves signed URLs

**Data Flow:**
- Employees link to departments, positions, managers
- Attendance: check-in/out → policy classification → monthly reports
- Leave: submit → manager approval → status update → notification
- Documents: upload → Cloudinary → Prisma record → signed URL delivery

---

## Getting Started

### Prerequisites

- Node.js 22+ (or Node 20 with `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true`)
- npm or yarn
- PostgreSQL 12+
- Git
- Cloudinary account (free tier)

### Installation

```bash
# Clone the repository
git clone https://github.com/mu534/SikoMendo.git
cd SikoMendo

# Install dependencies
npm ci
```

### Environment Setup

1. **Create `.env.local`**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in variables:**
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/sikomendo_dev"
   BETTER_AUTH_SECRET="your-secret-key-min-32-chars"
   BETTER_AUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   NODE_ENV="development"
   ```

### Database Setup

```bash
# Create database
createdb sikomendo_dev

# Run migrations
npx prisma migrate deploy

# (Optional) Seed sample data
npx prisma db seed

# Generate Prisma client
npx prisma generate
```

### Running Locally

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## Development

### Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type check
npx tsc --noEmit

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Prisma operations
npx prisma generate          # Generate client
npx prisma migrate deploy    # Run migrations
npx prisma migrate dev       # Create new migration
npx prisma studio           # Web UI for database
npx prisma db seed          # Seed data
```

### Testing

Uses **Vitest** for unit testing.

**What's covered:**
- ✅ Leave day-count math (`features/leave/schemas.test.ts`)
- ✅ Cooperative member validation (`features/cooperatives/schemas.test.ts`)
- ✅ RBAC permissions matrix (`lib/permissions.test.ts`)
- ✅ Password generation (`lib/credentials.test.ts`)

**What's NOT covered yet:**
- Database operations (requires test Postgres DB)
- File uploads
- Email notifications

See [TESTING.md](./TESTING.md) for guidelines.

### Code Quality

```bash
# Check lint
npm run lint

# Type check
npx tsc --noEmit
```

---

## Architecture

### Authentication & Authorization

**Better Auth:**
- Username/password login with bcryptjs
- Session-based auth with HTTP-only cookies
- First-login password change enforcement
- User roles: ADMIN, HR_OFFICER, MANAGER, EMPLOYEE

**Middleware (proxy.ts):**
- Protects all routes except `/`, `/sign-in`, `/offline`
- Redirects unauthenticated users to login

**RBAC (lib/permissions.ts):**
- Granular actions per role
- Server actions wrap in `withPermission()` checks
- Audit logging on sensitive operations

### Database

**PostgreSQL + Prisma:**
- 30+ models (employees, attendance, leave, cooperatives, etc.)
- Append-only tables for audit trail (EmploymentHistory, Contract)
- Soft deletes (deletedAt field)
- Relationships: employees → departments, positions, managers
- Enums: Role, EmploymentStatus, LeaveType, DocumentType, etc.

### File Storage

**Cloudinary:**
- Image uploads (profiles, logos)
- Document storage (contracts, certificates)
- PDF/CSV reports
- Signed URLs for authenticated delivery
- API-based deletion

### Security

- Environment validation (Zod)
- HTTP-only secure cookies
- Password hashing (bcryptjs)
- RBAC enforcement
- Audit logging
- Parameterized queries (Prisma)
- Soft deletes (no hard data removal)
- Time-limited signed URLs

---

## Features in Detail

### Employee Management
- CRUD with soft deletes
- Personal, contact, employment fields
- Profile images via Cloudinary
- Employment hierarchy (manager relationships)
- Education and emergency contact tracking

### Attendance
- Manual entry (admin) and self check-in/out
- Policy-driven status (grace period, half-day threshold)
- Org-wide monitoring (HR/Manager read-only)
- Attendance reports by date, employee, department

### Leave Management
- Types: ANNUAL, SICK, EMERGENCY, MATERNITY, PATERNITY, UNPAID
- Day-count math (inclusive calendar days)
- Manager approval routing
- Entitlements per type (org-wide defaults)
- Notifications for submission/approval/rejection

### Cooperatives
- Full registration details
- Financial tracking (fees, shares, assets)
- Member demographics (male/female counts)
- Location info (district, kebele)
- Separate from employee records

### Reporting
- Types: Employee Directory, Attendance, Cooperatives, Headcount, Audit Log, Leave Summary
- Formats: PDF, CSV
- Role-based access
- Cloudinary storage
- Filterable by date, employee, department

### Lifecycle
- **Onboarding**: Track setup progress (contracts, documents, account)
- **Offboarding**: Record departures with reason and last working date
- Dynamic checklists based on actual data

### Audit & Compliance
- Append-only audit log
- User, IP, timestamp, action, before/after snapshots
- Export for compliance

---

## API & Server Actions

**Server Actions** (`features/*/actions.ts`):
- Backend-only mutations
- Zod schema validation
- Permission checks
- Audit logging
- Notifications

**API Routes** (`app/api/*`):
- Public endpoints
- File upload handlers
- Better Auth proxies

---

## Deployment

### Prerequisites
- Managed PostgreSQL (RDS, Heroku, etc.)
- Cloudinary account
- Node.js 22+ hosting

### Build & Run

```bash
npm run build
npm start
```

### Docker
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY .next .next
COPY public public
EXPOSE 3000
CMD ["npm", "start"]
```

### CI/CD
GitHub Actions workflow (`.github/workflows/ci.yml`) runs:
- Linting
- Type checking
- Unit tests

On every push/PR to `main`.

---

## Contributing

1. Create a feature branch from `main`
2. Follow existing code structure
3. Write tests for business logic
4. Run lint and type check
5. Submit PR with clear description

### Standards
- TypeScript strict mode
- ESLint + Tailwind formatting
- Zod for validation
- Vitest for unit tests

---

## License

Proprietary software for Siko Mendo Union. All rights reserved.

---

**Last Updated**: September 2026  
**Version**: 0.1.0  
**Status**: Active Development
