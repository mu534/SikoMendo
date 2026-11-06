/**
 * features/backups/upload-token-store.ts
 *
 * Module-level in-memory store for upload-restore tokens.
 * NOT a "use server" file — sync exports are allowed here.
 * Assumes single-instance deployment (as documented in design.md §5.11).
 */
import { deleteTempFile } from "./pg-tools";

export interface UploadEntry {
  tmpPath: string;
  details: BackupDetails;
  expiresAt: number;
}

export interface BackupDetails {
  backupId: string;
  filename: string;
  formatVersion: number;
  createdAt: string;
  sizeBytes: number;
  tableCount: number;
  assetCount: number;
  source: "MANUAL" | "SAFETY" | "UPLOAD";
}

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const uploadTokenStore = new Map<string, UploadEntry>();

function sweepExpiredTokens() {
  const now = Date.now();
  for (const [token, entry] of uploadTokenStore.entries()) {
    if (entry.expiresAt < now) {
      deleteTempFile(entry.tmpPath).catch(() => {});
      uploadTokenStore.delete(token);
    }
  }
}

// Sweep every 5 minutes
setInterval(sweepExpiredTokens, 5 * 60 * 1000).unref?.();

/**
 * Stores a validated upload entry and returns a short-lived token.
 */
export function storeUploadEntry(tmpPath: string, details: BackupDetails): string {
  sweepExpiredTokens();
  const token = crypto.randomUUID();
  uploadTokenStore.set(token, {
    tmpPath,
    details,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

/**
 * Retrieves an upload entry by token. Returns null if expired or not found.
 */
export function getUploadEntry(token: string): UploadEntry | null {
  const entry = uploadTokenStore.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) {
      deleteTempFile(entry.tmpPath).catch(() => {});
      uploadTokenStore.delete(token);
    }
    return null;
  }
  return entry;
}

/**
 * Removes an entry from the store (call after a successful restore).
 */
export function removeUploadEntry(token: string): void {
  uploadTokenStore.delete(token);
}
