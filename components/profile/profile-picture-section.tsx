"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Camera, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/profile/image-crop-dialog";
import { applyExifOrientation } from "@/lib/crop-utils";
import { validatePhotoFile } from "@/lib/file-limits";
import { updateProfilePicture, removeProfilePicture } from "@/features/profile/actions";

// ── Props ──────────────────────────────────────────────────────────────────────

interface ProfilePictureSectionProps {
  currentImageUrl?: string | null;
  userName: string;
  updatedAt?: Date | string | null;
}

// ── Inline feedback helpers ───────────────────────────────────────────────────

function SuccessAlert({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      {message}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
    >
      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      {message}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProfilePictureSection({
  currentImageUrl,
  userName,
  updatedAt,
}: ProfilePictureSectionProps) {
  const t = useTranslations("profile");
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // The URL shown in the avatar — updated optimistically on upload/remove
  const [displayUrl, setDisplayUrl] = useState<string | null>(currentImageUrl ?? null);
  // Version for cache-busting — refresh after successful upload
  const [version, setVersion] = useState<string | number | null>(
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : updatedAt
        ? new Date(updatedAt).getTime()
        : null
  );

  // Crop dialog state
  const [cropOpen, setCropOpen] = useState(false);
  const [correctedObjectUrl, setCorrectedObjectUrl] = useState<string | null>(null);

  // Inline feedback
  const [fileError, setFileError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Remove confirmation
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const [isPending, startTransition] = useTransition();

  function clearFeedback() {
    setFileError(null);
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  // ── File picker ────────────────────────────────────────────────────────────

  function openFilePicker() {
    clearFeedback();
    setConfirmingRemove(false);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input so selecting the same file again triggers onChange
    e.target.value = "";
    if (!file) return;

    // Client-side validation
    const validationError = validatePhotoFile(file);
    if (validationError) {
      // Map lib error messages to i18n keys when possible
      if (validationError.includes("large") || validationError.includes("size")) {
        setFileError(t("fileTooLarge"));
      } else {
        setFileError(t("invalidFileType"));
      }
      return;
    }

    setFileError(null);

    // Correct EXIF orientation before showing in crop dialog
    const oriented = await applyExifOrientation(file);
    // Revoke any previous object URL to avoid memory leaks
    if (correctedObjectUrl) URL.revokeObjectURL(correctedObjectUrl);
    setCorrectedObjectUrl(oriented);
    setCropOpen(true);
  }

  // ── Crop save ──────────────────────────────────────────────────────────────

  function handleCropCancel() {
    setCropOpen(false);
    if (correctedObjectUrl) {
      URL.revokeObjectURL(correctedObjectUrl);
      setCorrectedObjectUrl(null);
    }
  }

  function handleCropSave(blob: Blob) {
    setCropOpen(false);
    if (correctedObjectUrl) {
      URL.revokeObjectURL(correctedObjectUrl);
      setCorrectedObjectUrl(null);
    }

    // Optimistic update — show cropped blob immediately
    const optimisticUrl = URL.createObjectURL(blob);
    const previousUrl = displayUrl;
    setDisplayUrl(optimisticUrl);
    clearFeedback();

    const formData = new FormData();
    formData.append("image", blob, "profile.jpg");

    startTransition(async () => {
      const result = await updateProfilePicture(formData);
      URL.revokeObjectURL(optimisticUrl);

      if (result.success) {
        setDisplayUrl(result.data.imageUrl);
        setVersion(Date.now());
        setSuccessMsg(t("uploadSuccess"));
        router.refresh();
      } else {
        // Revert on failure
        setDisplayUrl(previousUrl);
        setErrorMsg(t("uploadError"));
      }
    });
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  function handleRemoveClick() {
    clearFeedback();
    setConfirmingRemove(true);
  }

  function handleRemoveCancel() {
    setConfirmingRemove(false);
  }

  function handleRemoveConfirm() {
    setConfirmingRemove(false);
    clearFeedback();

    startTransition(async () => {
      const result = await removeProfilePicture();
      if (result.success) {
        setDisplayUrl(null);
        setVersion(null);
        setSuccessMsg(t("removeSuccess"));
        router.refresh();
      } else {
        setErrorMsg(t("removeError"));
      }
    });
  }

  const hasPhoto = Boolean(displayUrl);

  return (
    <div className="space-y-4">
      {/* ── Avatar with camera overlay ───────────────────────────────── */}
      <div className="flex items-start gap-6">
        {/* Avatar + overlay */}
        <div className="relative shrink-0">
          <Avatar
            name={userName}
            imageUrl={displayUrl}
            size="xl"
            version={version ?? undefined}
          />

          {/* Camera overlay button */}
          <button
            type="button"
            aria-label={t("changePhoto")}
            onClick={openFilePicker}
            disabled={isPending}
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-white shadow-md transition hover:bg-brand-800 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Controls column */}
        <div className="flex min-w-0 flex-col gap-3 pt-1">
          <div>
            <p className="text-sm font-semibold text-ink-900">{t("profilePicture")}</p>
            <p className="mt-0.5 text-xs text-ink-900/50">{t("uploadHint")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Upload / Change button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openFilePicker}
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("uploading")}
                </span>
              ) : hasPhoto ? (
                t("changePhoto")
              ) : (
                t("uploadPhoto")
              )}
            </Button>

            {/* Remove button — shown only when a photo exists */}
            {hasPhoto && !confirmingRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveClick}
                disabled={isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {t("removePhoto")}
              </Button>
            )}
          </div>

          {/* Remove confirmation inline prompt */}
          {confirmingRemove && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">{t("confirmRemove")}</p>
              <p className="mt-0.5 text-xs text-red-700">{t("confirmRemoveDescription")}</p>
              <div className="mt-2.5 flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleRemoveConfirm}
                  disabled={isPending}
                >
                  {t("removePhoto")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCancel}
                  disabled={isPending}
                >
                  {t("cancelCrop")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Feedback messages ─────────────────────────────────────────── */}
      {fileError && <ErrorAlert message={fileError} />}
      {successMsg && <SuccessAlert message={successMsg} />}
      {errorMsg && <ErrorAlert message={errorMsg} />}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Crop dialog */}
      {correctedObjectUrl && (
        <ImageCropDialog
          open={cropOpen}
          imageSrc={correctedObjectUrl}
          onCancel={handleCropCancel}
          onSave={handleCropSave}
        />
      )}
    </div>
  );
}
