import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { CreateManagerAccountForm } from "@/features/users/create-user-form";
import { getEmployeesWithoutAccount, getActiveDepartments } from "@/features/users/queries";

export default async function NewUserPage() {
  await requirePermission("MANAGE_USERS");
  const t = await getTranslations("users");

  const [employees, departments] = await Promise.all([
    getEmployeesWithoutAccount(),
    getActiveDepartments(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{t("newUser")}</h2>
        <p className="mt-1 text-sm text-ink-900/60">{t("newUserDescription")}</p>
      </div>
      <CreateManagerAccountForm employees={employees} departments={departments} />
    </div>
  );
}
