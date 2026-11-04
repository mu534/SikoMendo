import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { getUserById } from "@/features/users/queries";
import { roleLabel } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EditUserForm } from "./EditUserForm";
import { AccountSecurityPanel } from "@/features/users/account-security-panel";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { deleteUserAccount } from "@/features/users/actions";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const session = await requirePermission("MANAGE_USERS");
  const { lang, id } = await params;
  const t = await getTranslations("users");
  const tC = await getTranslations("common");

  const user = await getUserById(id);
  if (!user) notFound();

  const isSelf = user.id === session.user.id;
  const emp = user.employee;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <Avatar name={user.name} imageUrl={user.image} size="lg" />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-ink-900">{user.name}</h2>
          {user.username && (
            <p className="mt-0.5 text-sm text-ink-900/50">@{user.username}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{roleLabel(user.role)}</Badge>
            {user.banned
              ? <Badge tone="warning">{tC("inactive")}</Badge>
              : <Badge tone="success">{tC("active")}</Badge>}
            {user.mustChangePassword && (
              <Badge tone="warning">{t("form.password")}</Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs text-ink-900/45">
            {t("columns.created")}: {formatDate(user.createdAt)}
          </p>

          {emp ? (
            <p className="mt-1 text-sm text-ink-900/60">
              {t("columns.linkedEmployee")}:{" "}
              <Link
                href={`/${lang}/employees/${emp.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {emp.firstName} {emp.lastName} ({emp.employeeId})
              </Link>
              {emp.deletedAt && (
                <span className="ml-1.5 text-xs text-ink-900/40">({tC("archive")})</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-ink-900/40">{t("form.selectEmployee")}</p>
          )}
        </div>
      </div>

      <Card className="p-6">
        <h3 className="mb-5 border-b border-ink-900/8 pb-4 font-display text-base font-semibold text-ink-900">
          {t("title")}
        </h3>
        <EditUserForm
          user={{
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            image: user.image,
          }}
        />
      </Card>

      {!isSelf && (
        <AccountSecurityPanel
          userId={user.id}
          isSuspended={user.banned}
          mustChangePassword={user.mustChangePassword}
        />
      )}

      {!isSelf && user.role !== "ADMIN" && (
        <Card className="border-red-200 p-6">
          <h3 className="mb-2 font-semibold text-red-700">{t("dangerZone")}</h3>
          <p className="mb-4 text-sm text-ink-900/60">{t("deleteWarning")}</p>
          <form
            action={async () => {
              "use server";
              await deleteUserAccount(user.id);
            }}
          >
            <ConfirmSubmitButton
              variant="danger"
              size="sm"
              confirmTitle="Delete account?"
              confirmMessage={`Delete the account for ${user.name}? This cannot be undone. Their employee HR record will be preserved.`}
            >
              {t("actions.delete")}
            </ConfirmSubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
