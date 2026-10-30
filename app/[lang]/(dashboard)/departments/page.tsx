import Link from "next/link";
import { Building2, Users, Briefcase, ChevronRight, LayoutGrid } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listDepartments } from "@/features/departments/queries";
import { Badge } from "@/components/ui/badge";

export default async function DepartmentsPage() {
  const session = await requirePermission("VIEW_DEPARTMENTS");
  const canManage = can(session.user.role, "MANAGE_DEPARTMENTS");
  const departments = await listDepartments();

  const active = departments.filter((d) => d.isActive).length;
  const inactive = departments.length - active;
  const totalPositions = departments.reduce((s, d) => s + d._count.positions, 0);
  const totalEmployees = departments.reduce((s, d) => s + d._count.employees, 0);

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700/10 text-brand-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Departments</h2>
            <p className="mt-0.5 text-sm text-ink-900/55">
              {canManage
                ? "View, edit, and manage the Union's official department structure and positions."
                : "The Union's official department and position structure."}
            </p>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700/8 px-3 py-1 font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-700" />
            {active} Active
          </span>
          {inactive > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1 font-medium text-ink-900/50">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-900/25" />
              {inactive} Inactive
            </span>
          )}
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      {departments.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Building2, label: "Total Departments", value: departments.length },
            { icon: LayoutGrid, label: "Active Departments", value: active },
            { icon: Briefcase, label: "Total Positions", value: totalPositions },
            { icon: Users, label: "Total Employees", value: totalEmployees },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col gap-1 rounded-xl border border-ink-900/8 bg-white px-4 py-3 shadow-sm shadow-ink-900/[0.02]"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-900/45">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className="font-display text-2xl font-semibold text-ink-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {departments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-900/15 bg-sand-50 py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700/8 text-brand-700">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="font-medium text-ink-900">No departments yet</p>
          <p className="mt-1 text-sm text-ink-900/50">Department structure will appear here once configured.</p>
        </div>
      )}

      {/* ── Department card grid ─────────────────────────────────────────── */}
      {departments.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <Link
              key={dept.id}
              href={`/departments/${dept.id}`}
              className={[
                "group relative flex flex-col overflow-hidden rounded-2xl border bg-white",
                "shadow-sm shadow-ink-900/[0.03]",
                "transition-all duration-200",
                dept.isActive
                  ? "border-ink-900/8 hover:border-brand-700/25 hover:shadow-lg hover:shadow-brand-700/[0.08] hover:-translate-y-0.5"
                  : "border-ink-900/6 opacity-75 hover:opacity-90 hover:border-ink-900/15 hover:shadow-md hover:-translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/50 focus-visible:ring-offset-2",
              ].join(" ")}
            >
              {/* Top accent strip */}
              <div
                className={[
                  "h-1 w-full transition-all duration-200",
                  dept.isActive
                    ? "bg-gradient-to-r from-brand-700 to-brand-700/60 group-hover:to-brand-700"
                    : "bg-gradient-to-r from-ink-900/15 to-ink-900/5",
                ].join(" ")}
              />

              {/* Card body */}
              <div className="flex flex-1 flex-col gap-4 px-5 py-4">

                {/* Icon + name row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={[
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
                        dept.isActive
                          ? "bg-brand-700/8 text-brand-700 group-hover:bg-brand-700/12"
                          : "bg-ink-900/6 text-ink-900/40",
                      ].join(" ")}
                    >
                      <Building2 className="h-4.5 w-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
                    </div>
                    <div className="min-w-0">
                      <h3
                        className={[
                          "font-display text-[0.9375rem] font-semibold leading-tight transition-colors duration-150",
                          dept.isActive
                            ? "text-ink-900 group-hover:text-brand-700"
                            : "text-ink-900/60",
                        ].join(" ")}
                      >
                        {dept.name}
                      </h3>
                      {dept.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-900/45">
                          {dept.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs italic text-ink-900/25">No description</p>
                      )}
                    </div>
                  </div>
                  <Badge tone={dept.isActive ? "success" : "neutral"} className="shrink-0 mt-0.5">
                    {dept.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Divider */}
                <div className="h-px bg-ink-900/[0.055]" />

                {/* Stat row */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-ink-900/55">
                    <Briefcase className="h-3.5 w-3.5 text-ink-900/35" />
                    <span className="font-semibold text-ink-900">{dept._count.positions}</span>
                    {dept._count.positions === 1 ? "Position" : "Positions"}
                  </div>
                  <div className="h-3 w-px bg-ink-900/12" />
                  <div className="flex items-center gap-1.5 text-xs text-ink-900/55">
                    <Users className="h-3.5 w-3.5 text-ink-900/35" />
                    <span className="font-semibold text-ink-900">{dept._count.employees}</span>
                    {dept._count.employees === 1 ? "Employee" : "Employees"}
                  </div>
                </div>
              </div>

              {/* Footer CTA */}
              <div
                className={[
                  "flex items-center justify-between border-t px-5 py-2.5 transition-colors duration-200",
                  dept.isActive
                    ? "border-ink-900/6 bg-sand-50/70 group-hover:bg-brand-700/[0.03]"
                    : "border-ink-900/5 bg-sand-50/40",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-xs font-medium transition-all duration-150",
                    dept.isActive
                      ? "text-brand-700 opacity-0 group-hover:opacity-100"
                      : "text-ink-900/35 opacity-0 group-hover:opacity-100",
                  ].join(" ")}
                >
                  {canManage ? "View & manage" : "View details"}
                </span>
                <ChevronRight
                  className={[
                    "h-4 w-4 transition-all duration-150",
                    dept.isActive
                      ? "text-ink-900/25 group-hover:translate-x-0.5 group-hover:text-brand-700"
                      : "text-ink-900/20 group-hover:translate-x-0.5 group-hover:text-ink-900/40",
                  ].join(" ")}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
