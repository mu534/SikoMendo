"use client";

import React from "react";
import type { Role } from "@/lib/permissions";

export default function RoleGate({
  allowedRoles,
  userRole,
  children,
}: {
  allowedRoles: Role[] | string[];
  userRole?: string | null;
  children: React.ReactNode;
}) {
  if (!userRole) return null;
  if (allowedRoles.includes(userRole as Role)) return <>{children}</>;
  return null;
}
