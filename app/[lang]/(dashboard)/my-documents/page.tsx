import { FileText, Image as ImageIcon, Download, Eye } from "lucide-react";
import { requireSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getSignedFileUrl } from "@/lib/cloudinary";
import { formatDate, formatBytes } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MyDocumentsPage() {
  const session = await requireSession();

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: {
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">My Documents</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Documents HR has uploaded to your employee record. You can view and download these, but not
          delete them.
        </p>
      </div>

      <Card>
        {!employee ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No employee record linked yet"
            description="Ask your HR Officer to link your account to your employee record to see documents here."
          />
        ) : employee.documents.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents yet" />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {employee.documents.map((doc) => {
              const isImage = doc.mimeType.startsWith("image/");
              const isPdf = doc.mimeType === "application/pdf";
              // The Cloudinary resource_type used for signing is NOT the
              // same thing as "is this displayable as an <img> thumbnail" —
              // Cloudinary stores PDFs under resource_type "image" too (it
              // can render PDF pages as thumbnails), so this must come from
              // what was actually recorded at upload time, not from mimeType.
              const cloudinaryResourceType =
                doc.fileResourceType === "image" || doc.fileResourceType === "raw"
                  ? doc.fileResourceType
                  : isImage ? "image" : "raw"; // fallback for docs uploaded before this field existed
              const signedUrl = getSignedFileUrl(doc.fileKey, cloudinaryResourceType);

              return (
                <li key={doc.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
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
                        {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{doc.title}</p>
                      <p className="text-xs text-ink-900/45">
                        {doc.type.replace("_", " ")} · {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    {(isImage || isPdf) && (
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </a>
                    )}
                    <a
                      href={signedUrl}
                      download={doc.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900/60 hover:text-ink-900"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
