import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Prevent Turbopack from bundling these server-side packages —
  // they use Node.js internals and must be required at runtime.
  serverExternalPackages: ["better-auth", "@prisma/client", "@prisma/adapter-pg", "pg", "jspdf", "jspdf-autotable", "exceljs"],
};

export default withNextIntl(nextConfig);
