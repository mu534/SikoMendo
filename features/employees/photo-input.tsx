"use client";

import { useState } from "react";
import { Camera, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/field";

export function PhotoInput({
  name,
  currentName,
  currentUrl,
}: {
  name: string;
  currentName: string;
  currentUrl?: string | null;
}) {
  // preview: object URL of the newly picked file (not yet saved)
  const [preview, setPreview] = useState<string | null>(null);
  // removed: user clicked "Remove" — clear the existing photo on save
  const [removed, setRemoved] = useState(false);

  const displayUrl = removed ? null : (preview ?? currentUrl ?? null);
  const hasPhoto = displayUrl !== null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setRemoved(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setRemoved(true);
    // Reset the file input so re-selecting the same file fires onChange again
    const input = document.getElementById(`${name}-file`) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  return (
    <div>
      <Label>Profile photo</Label>
      <div className="flex items-center gap-4">
        <Avatar name={currentName} imageUrl={displayUrl} size="lg" />

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 bg-white px-3.5 py-2 text-sm font-medium text-ink-900 hover:bg-sand-100">
            <Camera className="h-4 w-4" />
            {hasPhoto ? "Change photo" : "Upload photo"}
            <input
              id={`${name}-file`}
              type="file"
              name={name}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* Remove button — only shown when a photo is displayed */}
          {hasPhoto && (
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-sm font-medium text-ink-900/60 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove profile photo"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-xs text-ink-900/45">
        JPG, PNG or WebP · max 5 MB · stored on Cloudinary
      </p>

      {/* When the user removes the photo, signal the server via a hidden field.
          The server action checks for this flag and clears profileImageUrl/Key. */}
      {removed && (
        <input type="hidden" name="removePhoto" value="1" />
      )}
    </div>
  );
}
