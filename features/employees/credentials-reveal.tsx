"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [copied, setCopied] = useState(false);

  const credentialsText = `Siko Mendo Union HRMIS — Login Credentials\nUsername: ${username}\nTemporary Password: ${password}\n\nYou will be required to set a new password the first time you sign in.`;

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
    win.document.write(`
      <html>
        <head><title>Login Credentials</title></head>
        <body style="font-family: sans-serif; padding: 2rem; line-height: 1.6;">
          <h2>Siko Mendo Union HRMIS</h2>
          <p><strong>Username:</strong> ${username}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p style="color: #666; font-size: 0.9em;">This password must be changed on first login.</p>
        </body>
      </html>
    `);
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
          <h3 className="font-display text-base font-semibold text-ink-900">Employee account created</h3>
          <p className="text-sm text-ink-900/60">Share these credentials with the employee securely.</p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Username</p>
          <p className="font-mono text-base text-ink-900">{username}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Temporary Password</p>
          <p className="font-mono text-base text-ink-900">{password}</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2.5 text-xs text-ink-900/70">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
        <p>
          This password is shown only once and cannot be retrieved again. If lost, an Admin can reset it from
          the Users page. The employee will be required to set a new password on first login.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-900/8 pt-5">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
        <Button type="button" className="ml-auto" onClick={() => router.push(`/employees/${employeeId}`)}>
          Continue to employee record
        </Button>
      </div>
    </Card>
  );
}
