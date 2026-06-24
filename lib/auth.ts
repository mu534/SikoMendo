import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { env } from "@/lib/env";

export const auth = betterAuth({
  appName: "Siko Mendo Union HRMIS",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },

  // The HRMIS has no public sign-up flow — accounts are provisioned by an
  // Administrator (see features/users). Role lives on the user record and
  // drives every permission check in lib/permissions.ts.
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
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },

  // Gives Administrators built-in account lifecycle tools (create user,
  // change role, ban/unban, reset password, force sign-out) without us
  // having to hand-roll session/password management.
  plugins: [
    admin({
      defaultRole: "EMPLOYEE",
      adminRoles: ["ADMIN"],
      defaultBanReason: "Account disabled by an Administrator.",
    }),
    nextCookies(), // must stay last: lets Server Actions set auth cookies
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
