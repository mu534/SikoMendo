"use client";

import { Button } from "@/components/ui/button";

export function ReloadButton({ label }: { label: string }) {
  return (
    <Button variant="primary" className="mt-6" onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
