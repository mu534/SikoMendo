"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Copy, Download, Printer, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CredentialsReveal({
  employeeId,
  username,
  password,
}: {
  employeeId: string;
  username: string;
  password: string;
}) {
  const router = useRouter();
  const t = useTranslations("users");
  const tC = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const credentialsText = `${t("form.username")}: ${username}\n${t("form.password")}: ${password}`;

  function handleCopy() {
    navigator.clipboard.writeText(credentialsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([credentialsText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${username}-credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const win = window.open("", "_blank", "width=500,height=400");
    if (!win) return;
    win.document.write(`<html><head><title>${t("form.password")}</title></head><body style="font-family:sans-serif;padding:2rem;line-height:1.6;"><h2>${t("title")}</h2><p><strong>${t("form.username")}:</strong> ${username}</p><p><strong>${t("form.password")}:</strong> ${password}</p></body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <Card className="max-w-xl p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-ink-900">{t("form.createAccount")}</h3>
          <p className="text-sm text-ink-900/60">{t("description")}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">{t("form.username")}</p>
          <p className="font-mono text-base text-ink-900">{username}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">{t("form.password")}</p>
          <p className="font-mono text-base text-ink-900">{password}</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2.5 text-xs text-ink-900/70">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
        <p>{t("actions.resetPassword")}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-900/8 pt-5">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          {copied ? tC("confirm") : tC("save")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
          {tC("save")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" />
          {tC("submit")}
        </Button>
        <Button type="button" className="ml-auto" onClick={() => router.push(`/employees/${employeeId}`)}>
          {tC("next")}
        </Button>
      </div>
    </Card>
  );
}
