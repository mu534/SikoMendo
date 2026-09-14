import {
  FileText,
  Shield,
  Briefcase,
  GraduationCap,
  Folder,
  Download,
  Eye,
  Trash2,
} from "lucide-react";
import { formatDate, formatBytes } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DocumentUploadForm } from "./document-upload-form";
import { getSignedFileUrl } from "@/lib/cloudinary";
import { deleteEmployeeDocument } from "./actions";
import type { Document } from "@prisma/client";

type DocumentGroup = {
  key: string;
  label: string;
  icon: React.ElementType;
  types: string[];
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    key: "identity",
    label: "Identity Documents",
    icon: Shield,
    types: ["ID_DOCUMENT"],
  },
  {
    key: "employment",
    label: "Employment",
    icon: Briefcase,
    types: ["CONTRACT"],
  },
  {
    key: "education",
    label: "Education & Certificates",
    icon: GraduationCap,
    types: ["CERTIFICATE", "RESUME"],
  },
  {
    key: "other",
    label: "Other",
    icon: Folder,
    types: ["OTHER"],
  },
];

const TYPE_LABEL: Record<string, string> = {
  ID_DOCUMENT: "ID Document",
  CONTRACT:    "Contract",
  CERTIFICATE: "Certificate",
  RESUME:      "Resume / CV",
  OTHER:       "Other",
};

function DocumentCard({
  doc,
  canManage,
  employeeId,
}: {
  doc: Document;
  canManage: boolean;
  employeeId: string;
}) {
  const isImage = doc.mimeType.startsWith("image/");
  const isPdf   = doc.mimeType === "application/pdf";
  const resourceType: "image" | "raw" =
    doc.fileResourceType === "image" ? "image" : "raw";
  const signedUrl = getSignedFileUrl(doc.fileKey, resourceType);

  const ext = doc.fileName.split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 bg-white px-4 py-3">
      {/* Icon / thumbnail */}
      <div className="flex min-w-0 items-center gap-3">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{doc.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-900/40">
            <span className="rounded bg-ink-900/6 px-1 py-0.5 font-mono text-[10px]">{ext}</span>
            <span>{formatBytes(doc.fileSize)}</span>
            <span>·</span>
            <span>{formatDate(doc.createdAt)}</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {(isImage || isPdf) && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Preview"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-900/40 hover:bg-brand-50 hover:text-brand-700 transition-colors"
            aria-label={`Preview ${doc.title}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
        <a
          href={signedUrl}
          download={doc.fileName}
          target="_blank"
          rel="noopener noreferrer"
          title="Download"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-900/40 hover:bg-ink-900/5 hover:text-ink-900 transition-colors"
          aria-label={`Download ${doc.title}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </a>
        {canManage && (
          <form
            action={async () => {
              "use server";
              await deleteEmployeeDocument(doc.id, employeeId);
            }}
          >
            <ConfirmSubmitButton
              confirmMessage={`Remove "${doc.title}" from this employee's record? This action cannot be undone.`}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-ink-900/30 hover:text-red-600"
              aria-label={`Delete ${doc.title}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </li>
  );
}

export function DocumentsPanel({
  employeeId,
  documents,
  canManage,
}: {
  employeeId: string;
  documents: Document[];
  canManage: boolean;
}) {
  if (documents.length === 0 && !canManage) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="No documents"
        description="No HR documents have been added for this employee."
      />
    );
  }

  return (
    <div className="space-y-5">
      {DOCUMENT_GROUPS.map((group) => {
        const groupDocs = documents.filter((d) => group.types.includes(d.type));
        if (groupDocs.length === 0 && !canManage) return null;

        const GroupIcon = group.icon;

        return (
          <div key={group.key}>
            {/* Group heading */}
            <div className="mb-2.5 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                <GroupIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-900/50">
                {group.label}
              </h4>
              {groupDocs.length > 0 && (
                <span className="rounded-full bg-ink-900/6 px-1.5 py-0.5 text-[10px] font-medium text-ink-900/50">
                  {groupDocs.length}
                </span>
              )}
            </div>

            {groupDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-900/12 px-4 py-3">
                <p className="text-xs text-ink-900/35">No {group.label.toLowerCase()} uploaded.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {groupDocs.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    canManage={canManage}
                    employeeId={employeeId}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {/* Upload form */}
      {canManage && (
        <div className="border-t border-ink-900/8 pt-4">
          <DocumentUploadForm employeeId={employeeId} />
        </div>
      )}
    </div>
  );
}
