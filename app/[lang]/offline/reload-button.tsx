"use client";

import { Button } from "@/components/ui/button";

export function ReloadButton() {
  return (
    <Button variant="primary" className="mt-6" onClick={() => window.location.reload()}>
      Try again
    </Button>
  );
}
