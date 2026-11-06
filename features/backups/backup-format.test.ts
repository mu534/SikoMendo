/**
 * Unit tests for features/backups/backup-format.ts
 *
 * All tests run in pure Node.js — no DB, no network, no Next.js runtime.
 * Covers:
 *   1. Encrypt→decrypt round-trip produces identical plaintext
 *   2. Tampered ciphertext (flip a byte) is rejected by GCM integrity check
 *   3. Wrong magic header is rejected
 *   4. Valid SMHR/v2 buffer passes validateHeader
 *   5. parseManifest splits dump vs manifest correctly
 *   6. Wrong-format version is rejected
 *   7. Key length validation (non-32-byte key)
 */

import { describe, it, expect } from "vitest";
import {
  encryptBackup,
  decryptBackup,
  validateHeader,
  parseManifest,
  MAGIC,
  FORMAT_VERSION,
} from "./backup-format";

// 32-byte AES-256 key as 64-char hex
const TEST_KEY = "a".repeat(64); // 64 hex chars = 32 bytes

const SAMPLE_DUMP = Buffer.from("pg_dump_custom_format_bytes_here_12345");
const SAMPLE_MANIFEST = JSON.stringify({
  generatedAt: "2025-01-01T00:00:00.000Z",
  appVersion: "test",
  assets: [
    { publicId: "siko-mendo/employees/photo-1", resourceType: "image", refTable: "employee" },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. validateHeader
// ─────────────────────────────────────────────────────────────────────────────

describe("validateHeader", () => {
  it("accepts a valid SMHR/v2 buffer", () => {
    const encrypted = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    expect(() => validateHeader(encrypted)).not.toThrow();
  });

  it("rejects a buffer with wrong magic (not SMHR)", () => {
    const buf = Buffer.alloc(40);
    buf.write("WXYZ", 0, "ascii"); // wrong magic
    buf[4] = FORMAT_VERSION;
    expect(() => validateHeader(buf)).toThrow(/missing SMHR magic header/);
  });

  it("rejects an unsupported version byte", () => {
    const buf = Buffer.alloc(40);
    MAGIC.copy(buf, 0);
    buf[4] = 0x01; // old v1
    expect(() => validateHeader(buf)).toThrow(/Unsupported backup format version 1/);
  });

  it("rejects a buffer too small to be a valid backup", () => {
    const buf = Buffer.alloc(10);
    MAGIC.copy(buf, 0);
    buf[4] = FORMAT_VERSION;
    expect(() => validateHeader(buf)).toThrow(/too small/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Encrypt → decrypt round-trip
// ─────────────────────────────────────────────────────────────────────────────

describe("encryptBackup / decryptBackup round-trip", () => {
  it("produces identical dump bytes after round-trip", () => {
    const encrypted = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    const { dumpBuffer } = decryptBackup(encrypted, TEST_KEY);
    expect(dumpBuffer).toEqual(SAMPLE_DUMP);
  });

  it("produces identical manifest JSON after round-trip", () => {
    const encrypted = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    const { manifestJson } = decryptBackup(encrypted, TEST_KEY);
    expect(manifestJson).toBe(SAMPLE_MANIFEST);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const enc1 = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    const enc2 = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    // The IVs at offset 8..20 differ because randomBytes is called each time
    expect(enc1.subarray(8, 20).equals(enc2.subarray(8, 20))).toBe(false);
  });

  it("rejects decryption with a different key", () => {
    const encrypted = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    const WRONG_KEY = "b".repeat(64);
    expect(() => decryptBackup(encrypted, WRONG_KEY)).toThrow(
      /corrupted or the encryption key is wrong/
    );
  });

  it("works correctly with an empty dump buffer", () => {
    const emptyDump = Buffer.alloc(0);
    const encrypted = encryptBackup(emptyDump, SAMPLE_MANIFEST, TEST_KEY);
    const { dumpBuffer, manifestJson } = decryptBackup(encrypted, TEST_KEY);
    expect(dumpBuffer.length).toBe(0);
    expect(manifestJson).toBe(SAMPLE_MANIFEST);
  });

  it("works correctly with a large dump buffer (1 MB)", () => {
    const largeDump = Buffer.alloc(1024 * 1024, 0xab);
    const encrypted = encryptBackup(largeDump, SAMPLE_MANIFEST, TEST_KEY);
    const { dumpBuffer } = decryptBackup(encrypted, TEST_KEY);
    expect(dumpBuffer.equals(largeDump)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tampered ciphertext rejected by GCM auth tag
// ─────────────────────────────────────────────────────────────────────────────

describe("tamper detection", () => {
  it("flipping a single byte in the ciphertext is rejected by GCM auth tag", () => {
    const encrypted = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    // Header is 36 bytes; flip byte at offset 40 (inside ciphertext)
    const tampered = Buffer.from(encrypted);
    tampered[40] ^= 0xff;
    expect(() => decryptBackup(tampered, TEST_KEY)).toThrow(
      /corrupted or the encryption key is wrong/
    );
  });

  it("flipping the auth tag byte at offset 20 is rejected", () => {
    const encrypted = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    const tampered = Buffer.from(encrypted);
    tampered[20] ^= 0x01; // flip first auth-tag byte
    expect(() => decryptBackup(tampered, TEST_KEY)).toThrow(
      /corrupted or the encryption key is wrong/
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. parseManifest
// ─────────────────────────────────────────────────────────────────────────────

describe("parseManifest", () => {
  it("parses a valid manifest JSON string", () => {
    const manifest = parseManifest(SAMPLE_MANIFEST);
    expect(manifest.generatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0].publicId).toBe("siko-mendo/employees/photo-1");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseManifest("not json at all")).toThrow(/invalid or corrupt/);
  });

  it("throws on missing required fields", () => {
    expect(() => parseManifest('{"foo": "bar"}')).toThrow(/invalid/i);
  });

  it("accepts a manifest with an empty assets array", () => {
    const m = JSON.stringify({ generatedAt: new Date().toISOString(), appVersion: "1", assets: [] });
    const parsed = parseManifest(m);
    expect(parsed.assets).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Key length validation
// ─────────────────────────────────────────────────────────────────────────────

describe("key validation", () => {
  it("throws encryptBackup when key is not 64 hex chars", () => {
    expect(() => encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, "tooshort")).toThrow(
      /64-character hex string/
    );
  });

  it("throws decryptBackup when key is not 64 hex chars", () => {
    const encrypted = encryptBackup(SAMPLE_DUMP, SAMPLE_MANIFEST, TEST_KEY);
    expect(() => decryptBackup(encrypted, "notakey")).toThrow(/64-character hex string/);
  });
});
