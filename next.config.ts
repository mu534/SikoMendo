import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack from bundling these server-side packages —
  // they use Node.js internals and must be required at runtime.
  serverExternalPackages: ["better-auth", "@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
