"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/field";

export function PhotoInput({ name, currentName, currentUrl }: { name: string; currentName: string; currentUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div>
      <Label>Profile photo</Label>
      <div className="flex items-center gap-4">
        <Avatar name={currentName} imageUrl={preview ?? currentUrl} size="lg" />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 bg-white px-3.5 py-2 text-sm font-medium text-ink-900 hover:bg-sand-100">
          <Camera className="h-4 w-4" />
          {currentUrl || preview ? "Change photo" : "Upload photo"}
          <input
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
      </div>
      <p className="mt-1.5 text-xs text-ink-900/45">JPG, PNG or WEBP. Stored on Cloudinary.</p>
    </div>
  );
}
