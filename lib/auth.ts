import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, userAc } from "better-auth/plugins/admin/access";
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { env } from "@/lib/env";

// better-auth's admin plugin checks the "user:create" (and similar) permissions
// against a role table that, by default, only has entries for the literal
// strings "admin" and "user". Our Role enum uses "ADMIN", "HR_OFFICER",
// "MANAGER", "EMPLOYEE", so without this custom access-control map, that
// lookup always misses and every admin action gets silently denied — even
// for our own ADMIN role. Defining the roles explicitly (keyed by our real
// enum values) fixes that. Only ADMIN gets the plugin's built-in admin
// permission set; the other roles get none, matching MANAGE_USERS being
// ADMIN-only in lib/permissions.ts.
const ac = createAccessControl({ ...defaultStatements });
const adminAcRole = ac.newRole({ ...adminAc.statements });
const staffAcRole = ac.newRole({ ...userAc.statements });

export const auth = betterAuth({
  appName: "Siko Mendo Union HRMIS",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Email+password is kept enabled because better-auth requires it for
  // account creation via auth.api.createUser. We never expose email-based
  // sign-in in the UI — only username-based sign-in is shown.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },

  user: {
    additionalFields: {
      role: {
        type: [...ROLES] as unknown as string[],
        input: false,
        defaultValue: "EMPLOYEE",
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,   // 7 days
    updateAge: 60 * 60 * 24,        // refresh once per day of activity
  },

  plugins: [
    username({
      // Only lowercase letters, digits, dots, hyphens, underscores allowed.
      usernameValidator: (u) => /^[a-z0-9._-]+$/.test(u),
      minUsernameLength: 3,
      maxUsernameLength: 40,
    }),
    admin({
      ac,
      roles: {
        ADMIN: adminAcRole,
        HR_OFFICER: staffAcRole,
        MANAGER: staffAcRole,
        EMPLOYEE: staffAcRole,
      },
      defaultRole: "EMPLOYEE",
      adminRoles: ["ADMIN"],
      defaultBanReason: "Account disabled by an Administrator.",
    }),
    nextCookies(), // must stay last: lets Server Actions set auth cookies
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
