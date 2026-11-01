import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { CreateUserForm } from "@/features/users/create-user-form";

export default async function NewUserPage() {
  await requirePermission("MANAGE_USERS");
  const t = await getTranslations("users");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{t("newUser")}</h2>
        <p className="mt-1 text-sm text-ink-900/60">{t("description")}</p>
      </div>
      <CreateUserForm />
    </div>
  );
}
