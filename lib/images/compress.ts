// Product image compression, shared by the admin upload (in the browser) and
// the v1 import script (which runs this same code in headless Chromium).
// Output: WebP, longest edge ≤ 1600px, aiming for < 250 KB. Never upscales.

export const MAX_EDGE = 1600;
export const TARGET_BYTES = 250 * 1024;
/** Tried in order until the encoded file fits the target. */
export const QUALITY_STEPS = [0.86, 0.8, 0.74, 0.68, 0.6, 0.5, 0.4] as const;

export type CompressOptions = {
  maxEdge?: number;
  targetBytes?: number;
  qualitySteps?: readonly number[];
};

export type CompressResult = {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
  originalBytes: number;
  /** False only if even the lowest quality step exceeds the target. */
  underTarget: boolean;
};

export class WebpEncodingUnsupportedError extends Error {
  constructor() {
    super("This browser cannot encode WebP images.");
    this.name = "WebpEncodingUnsupportedError";
  }
}

/** Scale (width, height) so the longest edge is at most maxEdge. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge: number = MAX_EDGE): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new RangeError(`Invalid image size ${width}×${height}`);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Encode at decreasing quality until the result fits targetBytes.
 * Returns the first fit, or the smallest attempt if none fit.
 */
export async function encodeUnderTarget<T extends { size: number }>(
  encode: (quality: number) => Promise<T>,
  targetBytes: number = TARGET_BYTES,
  qualitySteps: readonly number[] = QUALITY_STEPS,
): Promise<{ output: T; quality: number; underTarget: boolean }> {
  if (qualitySteps.length === 0) throw new RangeError("qualitySteps must not be empty");
  let smallest: { output: T; quality: number } | null = null;
  for (const quality of qualitySteps) {
    const output = await encode(quality);
    if (output.size <= targetBytes) return { output, quality, underTarget: true };
    if (!smallest || output.size < smallest.output.size) smallest = { output, quality };
  }
  return { ...smallest!, underTarget: false };
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function canvasToWebp(canvas: AnyCanvas, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/webp", quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas encoding failed"))), "image/webp", quality),
  );
}

/** Browser only. Decode, resize and re-encode an image file as WebP. */
export async function compressImage(file: Blob, options: CompressOptions = {}): Promise<CompressResult> {
  const { maxEdge = MAX_EDGE, targetBytes = TARGET_BYTES, qualitySteps = QUALITY_STEPS } = options;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error("2D canvas is unavailable");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const { output, quality, underTarget } = await encodeUnderTarget(
      async (q) => {
        const blob = await canvasToWebp(canvas, q);
        // Browsers without a WebP encoder (Safari) silently return PNG.
        if (blob.type !== "image/webp") throw new WebpEncodingUnsupportedError();
        return blob;
      },
      targetBytes,
      qualitySteps,
    );
    return { blob: output, width, height, quality, originalBytes: file.size, underTarget };
  } finally {
    bitmap.close();
  }
}
