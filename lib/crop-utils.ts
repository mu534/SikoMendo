/**
 * Canvas-based crop utilities for the profile picture upload flow.
 *
 * All functions run in the browser only — never import this on the server.
 */

/** The pixel dimensions output by getCroppedImg. */
export const CROP_OUTPUT_SIZE = 512;

/** Area returned by react-easy-crop's onCropComplete callback. */
export interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws the cropped region of `imageSrc` onto a 512×512 canvas and returns a
 * JPEG Blob at 0.92 quality.  The resulting blob is upload-ready.
 */
export async function getCroppedImg(
  imageSrc: string,
  croppedAreaPixels: CroppedAreaPixels
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D canvas context.");

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    CROP_OUTPUT_SIZE,
    CROP_OUTPUT_SIZE
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null."));
      },
      "image/jpeg",
      0.92
    );
  });
}

/**
 * Reads the EXIF Orientation tag from the first 64 KB of a JPEG/WebP file,
 * draws the image onto a canvas with the correct rotation/flip applied, and
 * returns a corrected object URL.
 *
 * For non-JPEG files (PNG, WebP without EXIF) this is a no-op that returns a
 * plain object URL of the original file.
 *
 * The caller is responsible for revoking the returned URL with
 * `URL.revokeObjectURL` when it is no longer needed.
 */
export async function applyExifOrientation(file: File): Promise<string> {
  // Only JPEG may carry EXIF orientation data
  if (!file.type.startsWith("image/jpeg") && !file.type.startsWith("image/jpg")) {
    return URL.createObjectURL(file);
  }

  let orientation = 1;
  try {
    const buffer = await file.slice(0, 65536).arrayBuffer();
    orientation = readExifOrientation(new DataView(buffer));
  } catch {
    // If we can't read EXIF, proceed without correction
  }

  // Orientations 1 and 0 mean "top-left" — no transform needed
  if (orientation <= 1) {
    return URL.createObjectURL(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const { canvas, ctx } = createOrientedCanvas(image, orientation);

    return new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(URL.createObjectURL(blob));
          else reject(new Error("Failed to create oriented image blob."));
        },
        "image/jpeg",
        0.95
      );
    });
  } catch {
    // Return the original URL on any canvas error
    return objectUrl;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Minimal EXIF Orientation reader.
 * Parses only the Orientation tag (0x0112) from the APP1 EXIF segment.
 * Returns 1 (normal) if the tag is not found or the file is not JPEG.
 */
function readExifOrientation(view: DataView): number {
  // JPEG SOI marker
  if (view.getUint16(0) !== 0xffd8) return 1;

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);

    // APP1 marker (0xFFE1) may contain EXIF
    if (marker === 0xffe1) {
      // Check for "Exif\0\0" header
      const exifHeader = view.getUint32(offset + 4);
      if (exifHeader === 0x45786966) {
        // 0x0000 null terminator follows, then TIFF header
        const tiffOffset = offset + 10;
        const isLittleEndian = view.getUint16(tiffOffset) === 0x4949;
        const ifdOffset = tiffOffset + view.getUint32(tiffOffset + 4, isLittleEndian);
        const entryCount = view.getUint16(ifdOffset, isLittleEndian);

        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifdOffset + 2 + i * 12;
          if (entryOffset + 12 > view.byteLength) break;
          const tag = view.getUint16(entryOffset, isLittleEndian);
          if (tag === 0x0112) {
            // Orientation tag — value is a SHORT (2 bytes)
            return view.getUint16(entryOffset + 8, isLittleEndian);
          }
        }
      }
    }

    offset += 2 + length;
  }
  return 1;
}

/**
 * Creates a canvas with the image drawn at the correct rotation/flip for the
 * given EXIF orientation value (1–8).
 */
function createOrientedCanvas(
  image: HTMLImageElement,
  orientation: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // For orientations 5–8 the image is rotated 90°, so swap width/height
  if (orientation >= 5) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }

  // Apply the EXIF transform before drawing
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break;
  }

  ctx.drawImage(image, 0, 0);
  return { canvas, ctx };
}
