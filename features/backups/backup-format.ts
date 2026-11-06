/**
 * features/backups/backup-format.ts
 *
 * Pure functions for encrypting and decrypting database backup files.
 * No DB access, no network calls — fully unit-testable.
 *
 * Encrypted container binary layout:
 *   offset  0: magic "SMHR" (4 bytes ASCII) — Siko Mendo HRIS
 *   offset  4: version 0x02 (1 byte)
 *   offset  5: reserved 0x00 0x00 0x00 (3 bytes)
 *   offset  8: iv (12 bytes, random per backup) — AES-256-GCM nonce
 *   offset 20: authTag (16 bytes) — GCM auth tag
 *   offset 36: ciphertext (rest)
 *
 * Plaintext layout:
 *   [uint64 big-endian: dumpLength (8 bytes)][dumpBytes][manifestJSON utf-8]
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export const MAGIC = Buffer.from("SMHR", "ascii"); // 4 bytes
export const FORMAT_VERSION = 0x02;
const HEADER_SIZE = 36; // magic(4) + version(1) + reserved(3) + iv(12) + authTag(16)
const IV_SIZE = 12;
const _AUTH_TAG_SIZE = 16; // kept for documentation; used implicitly by GCM

export interface DecryptedBackup {
  dumpBuffer: Buffer;
  manifestJson: string;
}

export interface BackupManifest {
  generatedAt: string;
  appVersion: string;
  assets: Array<{ publicId: string; resourceType: string; refTable: string }>;
}

/**
 * Validates the binary header of an encrypted backup file.
 * Throws on magic mismatch or unsupported version.
 */
export function validateHeader(buf: Buffer): void {
  if (buf.length < HEADER_SIZE) {
    throw new Error("File is too small to be a valid backup.");
  }
  const magic = buf.subarray(0, 4).toString("ascii");
  if (magic !== "SMHR") {
    throw new Error("Not a valid backup file: missing SMHR magic header.");
  }
  const version = buf[4];
  if (version !== FORMAT_VERSION) {
    throw new Error(
      `Unsupported backup format version ${version}. Only version ${FORMAT_VERSION} is supported.`
    );
  }
}

/**
 * Encrypts a pg_dump buffer and a JSON manifest into the SMHR/v2 container.
 *
 * @param dumpBuffer   Raw bytes from pg_dump (custom format).
 * @param manifestJson Stringified JSON asset manifest.
 * @param keyHex       64-character hex-encoded 32-byte AES key.
 * @returns Encrypted container buffer.
 */
export function encryptBackup(
  dumpBuffer: Buffer,
  manifestJson: string,
  keyHex: string
): Buffer {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }

  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  // Build plaintext: [uint64 dumpLength][dumpBytes][manifestJson]
  const dumpLenBuf = Buffer.alloc(8);
  // Write as big-endian 64-bit using two 32-bit parts (JS safe integer range)
  dumpLenBuf.writeUInt32BE(Math.floor(dumpBuffer.length / 0x100000000), 0);
  dumpLenBuf.writeUInt32BE(dumpBuffer.length >>> 0, 4);

  const manifestBuf = Buffer.from(manifestJson, "utf8");
  const plaintext = Buffer.concat([dumpLenBuf, dumpBuffer, manifestBuf]);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Assemble container
  const reserved = Buffer.alloc(3, 0x00);
  const versionBuf = Buffer.alloc(1, FORMAT_VERSION);

  return Buffer.concat([MAGIC, versionBuf, reserved, iv, authTag, ciphertext]);
}

/**
 * Decrypts an SMHR/v2 container. Validates the header, GCM auth tag, and
 * splits the plaintext into dump buffer and manifest JSON.
 *
 * @throws If magic is wrong, version is unsupported, or GCM tag is invalid.
 */
export function decryptBackup(encryptedBuffer: Buffer, keyHex: string): DecryptedBackup {
  validateHeader(encryptedBuffer);

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }

  const iv      = encryptedBuffer.subarray(8, 20);
  const authTag = encryptedBuffer.subarray(20, 36);
  const ciphertext = encryptedBuffer.subarray(HEADER_SIZE);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Backup is corrupted or the encryption key is wrong.");
  }

  // Parse plaintext: [uint64 dumpLength][dumpBytes][manifestJson]
  if (plaintext.length < 8) {
    throw new Error("Decrypted content is too short — backup is corrupt.");
  }

  const dumpLenHi = plaintext.readUInt32BE(0);
  const dumpLenLo = plaintext.readUInt32BE(4);
  const dumpLength = dumpLenHi * 0x100000000 + dumpLenLo;

  if (plaintext.length < 8 + dumpLength) {
    throw new Error("Decrypted content length mismatch — backup is corrupt.");
  }

  const dumpBuffer  = plaintext.subarray(8, 8 + dumpLength);
  const manifestBuf = plaintext.subarray(8 + dumpLength);
  const manifestJson = manifestBuf.toString("utf8");

  return { dumpBuffer, manifestJson };
}

/**
 * Parses and validates the manifest JSON embedded in a backup.
 */
export function parseManifest(manifestJson: string): BackupManifest {
  try {
    const parsed = JSON.parse(manifestJson) as BackupManifest;
    if (!parsed.generatedAt || !Array.isArray(parsed.assets)) {
      throw new Error("Invalid manifest structure.");
    }
    return parsed;
  } catch {
    throw new Error("Backup manifest is invalid or corrupt.");
  }
}
