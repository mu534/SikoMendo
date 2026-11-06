import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { listBackups } from "@/features/backups/queries";
import { BackupRestoreManager } from "@/features/backups/components/backup-restore-manager";

export default async function BackupRestorePage() {
  await requirePermission("MANAGE_BACKUP_RESTORE");
  const t = await getTranslations("backupRestore");
  const backups = await listBackups();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-ink-900/60">{t("description")}</p>
      </div>
      <BackupRestoreManager backups={backups} />
    </div>
  );
}
