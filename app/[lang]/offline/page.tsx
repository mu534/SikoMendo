import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ReloadButton } from "./reload-button";

export default async function OfflinePage() {
  const t = await getTranslations("offline");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sand-50 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <WifiOff className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-semibold text-ink-900">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-900/60">{t("description")}</p>
      <ReloadButton label={t("reload")} />
    </div>
  );
}
