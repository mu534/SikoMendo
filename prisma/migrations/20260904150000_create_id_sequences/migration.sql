-- Create PostgreSQL sequences for business-facing ID generation.
-- These sequences were referenced in application code but never created
-- by a prior migration, causing "relation does not exist" at runtime.
--
-- IF NOT EXISTS means this is safe to re-run.
-- GREATEST(..., 1) ensures setval never receives 0 (out-of-bounds).

-- employee_id_seq  → EMP-0001, EMP-0002, …
CREATE SEQUENCE IF NOT EXISTS employee_id_seq
  START 1 INCREMENT 1 MINVALUE 1 NO MAXVALUE CACHE 1;

SELECT setval(
  'employee_id_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(CAST(SUBSTRING("employeeId" FROM 5) AS BIGINT))
       FROM "employee"
       WHERE "employeeId" ~ '^EMP-[0-9]+$'),
      0
    ),
    1
  )
);

-- leave_request_id_seq  → LR-0001, LR-0002, …
CREATE SEQUENCE IF NOT EXISTS leave_request_id_seq
  START 1 INCREMENT 1 MINVALUE 1 NO MAXVALUE CACHE 1;

SELECT setval(
  'leave_request_id_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(CAST(SUBSTRING("leaveId" FROM 4) AS BIGINT))
       FROM "leave_request"
       WHERE "leaveId" ~ '^LR-[0-9]+$'),
      0
    ),
    1
  )
);

-- cooperative_id_seq  → COOP-001, COOP-002, …
CREATE SEQUENCE IF NOT EXISTS cooperative_id_seq
  START 1 INCREMENT 1 MINVALUE 1 NO MAXVALUE CACHE 1;

SELECT setval(
  'cooperative_id_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(CAST(SUBSTRING("cooperativeId" FROM 6) AS BIGINT))
       FROM "cooperative"
       WHERE "cooperativeId" ~ '^COOP-[0-9]+$'),
      0
    ),
    1
  )
);
