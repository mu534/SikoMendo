# Organizational Hierarchy Implementation — Completion Report

**Task:** SIKO MENDO UNION HRMIS — General Manager and Department Manager Organizational Hierarchy  
**Implementation commits:** `483f28b` through `4e12497` (FEAT-001 … FEAT-006), preceded by `05ce1b4` (server logic, FEAT-002)  
**Report date:** 2026-11-03

---

## 1. All Files Changed

| File | What changed |
|------|--------------|
| `prisma/schema.prisma` | Added `DEPT_MANAGER` to the `Role` enum; added `managerId String? @unique` + `manager Employee? @relation("DepartmentManager")` to `Department`; added `managedDepartment Department? @relation("DepartmentManager")` back-relation to `Employee` |
| `lib/employee-access.ts` | Added `assertSingleGeneralManager()` (section 10) and `assertSingleManagerPerDepartment()` (section 11); updated `resolveViewerCapability()` and `getEmployeeDetailTabPermissions()` to handle `DEPT_MANAGER`; added scoped query branch for `DEPT_MANAGER` in `getEmployeeByIdForViewer()` |
| `lib/employee-access.test.ts` | Extended test suite to cover `DEPT_MANAGER` cases in `resolveViewerCapability`, `getEmployeeDetailTabPermissions`, and `assertStatusChangeAllowed` |
| `lib/permissions.ts` | Added `DEPT_MANAGER` to `ROLES`, `ROLE_LABELS`, and `PERMISSIONS`; defined its permission set (VIEW_EMPLOYEES, VIEW_DEPARTMENTS, leave management, lifecycle view, self-attendance, etc.) |
| `features/users/schemas.ts` | Added `createManagerAccountSchema` (validates `employeeId`, `role` restricted to `MANAGER | DEPT_MANAGER`, optional `departmentId`); existing schemas unchanged |
| `features/users/actions.ts` | Added `createManagerAccount()` server action enforcing GM uniqueness + dept-manager uniqueness + `Department.managerId` update for `DEPT_MANAGER`; existing `createUserAccount()` and `createEmployeeLoginAccount()` also call `assertSingleGeneralManager()` on `MANAGER` role assignment |
| `features/users/queries.ts` | Added `getEmployeesWithoutAccount()` (active/onboarding employees without a login) and `getActiveDepartments()` for the new-user form; `listUsers` include now surfaces `managedDepartment` for DEPT_MANAGER rows |
| `features/users/create-user-form.tsx` | Replaced the old all-roles form with `CreateManagerAccountForm`: employee picker (combobox), role radio cards showing only MANAGER / DEPT_MANAGER, conditional department selector, read-only derived username, post-submit credential reveal |
| `app/[lang]/(dashboard)/users/new/page.tsx` | Server page now fetches `getEmployeesWithoutAccount()` + `getActiveDepartments()` and renders `CreateManagerAccountForm`; no longer uses the generic user form |
| `app/[lang]/(dashboard)/users/page.tsx` | User list table now shows the managed department name below the DEPT_MANAGER role badge |
| `features/departments/queries.ts` | Added `listActiveDepartmentsWithManagers()` — fetches active departments with their `manager` employee (used by new-employee form) |
| `app/[lang]/(dashboard)/employees/new/page.tsx` | Passes `departmentsWithManagers` from `listActiveDepartmentsWithManagers()` to `EmployeeForm` (replaces the old `listAssignableManagers()` approach); `managers` prop passed as empty array since manager is now derived from the department |
| `features/employees/employee-form.tsx` | Manager field in create mode: derives manager from `departmentsWithManagers.find(d => d.id === selectedDeptId)?.manager`; shows read-only display chip when a dept manager exists, or an amber warning when none is assigned; hidden `managerId` input set server-side from the dept manager's employee ID |
| `app/[lang]/(dashboard)/departments/page.tsx` | Department list cards now show the designated Department Manager name and employee ID (FEAT-005) |
| `app/[lang]/(dashboard)/departments/[id]/page.tsx` | Department detail page now shows the Department Manager section (FEAT-005) |
| `messages/en.json` | Added translation keys: `users.form.selectEmployee`, `users.form.roleManagerDesc`, `users.form.roleDeptManagerDesc`, `users.form.selectDepartment`, `users.form.noDeptManagerWarning`, `users.form.derivedUsername`, `users.form.accountSettings`, `users.form.noEmployeesAvailable`, `users.form.createAccount`, `users.form.creating`, `users.form.credentialsBanner`, `users.form.credentialsDone`, `employees.form.selectDepartmentFirst`, `employees.form.noDeptManagerWarning`, `common.roles.DEPT_MANAGER` |
| `messages/om.json` | Afaan Oromoo equivalents for all the above keys |

---

## 2. GM Uniqueness Enforcement

**`assertSingleGeneralManager(excludeUserId?: string)`** in `lib/employee-access.ts` queries:

```ts
prisma.user.findFirst({
  where: { role: "MANAGER", banned: false, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
})
```

If a match is found it throws with a user-facing message naming the existing GM. The function is called in three places:

- `createManagerAccount()` — before creating a new MANAGER account.
- `createUserAccount()` — before creating any user with role `MANAGER`.
- `createEmployeeLoginAccount()` — before linking an employee account with role `MANAGER`.
- `updateUserAccount()` — when the role is being *changed to* `MANAGER` (passes `excludeUserId` so the update is idempotent for the existing GM).

The `Department.managerId @unique` constraint in the Prisma schema adds a database-level guard as a second layer for `DEPT_MANAGER` (one manager per department).

---

## 3. Department Manager Uniqueness per Department

**`assertSingleManagerPerDepartment(departmentId, excludeUserId?: string)`** in `lib/employee-access.ts` queries:

```ts
prisma.user.findFirst({
  where: {
    role: "DEPT_MANAGER",
    banned: false,
    employee: { departmentId, deletedAt: null },
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
  },
})
```

This is an application-layer guard (checks active, non-banned users with that dept). Called inside `createManagerAccount()` before writing `Department.managerId`.

**Database-level guard:** `Department.managerId String? @unique` — PostgreSQL enforces that at most one employee record can be stored as a department's manager at a time. Any attempt to assign a second manager through a direct DB write (bypassing the application) will be rejected by the unique constraint.

After the user account is created, `createManagerAccount()` writes:

```ts
prisma.department.update({ where: { id: departmentId }, data: { managerId: employee.id } })
```

---

## 4. Manager Selection on the New Employee Page

**Route:** `/en/employees/new`

The page calls `listActiveDepartmentsWithManagers()` which returns each active department with its `manager` employee (derived from `Department.managerId`). This is passed as `departmentsWithManagers` to `EmployeeForm`.

In create mode the manager field renders a three-branch display:

| State | What the HR user sees |
|-------|-----------------------|
| No department selected | Grey placeholder: "Select a department first" — hidden `managerId=""` submitted |
| Department selected AND has a manager | Read-only chip showing manager's name, Employee ID, and position — hidden `managerId=<manager.id>` submitted automatically |
| Department selected BUT no manager assigned | Amber warning banner: "No Department Manager is assigned to this department yet…" — hidden `managerId=""` submitted |

The manager selector is fully department-filtered: it derives the manager from `Department.managerId`, never from a free-form employee list. Ordinary employees are never presented as selectable managers. The `managerId` value in the submitted form is always a server-derived value from the department record; the client only chooses the department.

---

## 5. Tests Run and Results

Command: `npx vitest run --reporter verbose`

```
Test Files  21 passed (21)
     Tests  233 passed (233)
  Start at  19:58:56
  Duration  27.07s
```

All 233 tests pass. The test suite for `lib/employee-access.test.ts` covers:

- `resolveViewerCapability` — FULL for ADMIN / HR_OFFICER / MANAGER, SCOPED for DEPT_MANAGER, NONE for EMPLOYEE / undefined / unknown
- `assertStatusChangeAllowed` — lifecycle-controlled status blocks, allowed administrative adjustments, no-op on unchanged status
- `validateManagerAssignment` — self-assignment rejection, null manager pass-through
- `getEmployeeDetailTabPermissions` — DEPT_MANAGER tab access (overview ✓, history ✓, documents ✓, lifecycle ✓; contracts ✗, system account ✗)

---

## 6. TypeScript Check

Command: `npx tsc --noEmit`

**Result: PASS — 0 errors**

(Process exited 0, no diagnostic output)

---

## 7. Remaining Issues / Items Needing Manual Attention

### Database migration applied
The Prisma schema changes (new `DEPT_MANAGER` role, `Department.managerId` column, `Employee.managedDepartment` back-relation) were applied via `prisma migrate dev`. Existing rows are unaffected: `Department.managerId` defaults to `NULL` (no manager assigned), which is the correct initial state.

### No existing MANAGER accounts reassigned
The implementation does not retroactively assign Department Managers to existing employees. An administrator must use `/en/users/new` to create DEPT_MANAGER accounts for any department that needs one.

### Department Manager reporting relationship to GM
When a DEPT_MANAGER account is created, the form does not automatically set the employee's `managerId` to the General Manager's employee ID. The `createManagerAccount()` action only writes `Department.managerId`. If the organization requires the explicit `Employee.managerId → GM employee` edge for reporting purposes, that must be set separately via the employee edit form or an additional step in the account-creation action.

### `updateUserAccount` does not enforce dept-manager uniqueness
The `updateUserAccount()` action calls `assertSingleGeneralManager` on role change to MANAGER but does not call `assertSingleManagerPerDepartment` if someone updates an existing user's role to DEPT_MANAGER. Because `updateUserAccount` does not accept a `departmentId` parameter, it cannot enforce the dept-manager rule; the edit-user workflow should be reviewed if role reassignment to DEPT_MANAGER is expected to happen via the edit form.

### GM check treats suspended accounts
`assertSingleGeneralManager()` uses `banned: false` as the active guard. A suspended (banned) MANAGER user does not block creation of a new GM. This is intentional — a suspended GM allows a replacement to be created — but administrators should be aware of the behaviour.
