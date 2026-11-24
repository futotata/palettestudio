export interface DirtyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampDirtyRect(
  rect: DirtyRect,
  maxWidth: number,
  maxHeight: number
): DirtyRect | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(maxWidth, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(maxHeight, Math.ceil(rect.y + rect.h));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  return { x: x0, y: y0, w, h };
}

export function unionDirtyRect(a: DirtyRect | null, b: DirtyRect | null): DirtyRect | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

let sharedReadCanvas: HTMLCanvasElement | null = null;
let sharedReadCtx: CanvasRenderingContext2D | null = null;

let sharedWriteCanvas: HTMLCanvasElement | null = null;
let sharedWriteCtx: CanvasRenderingContext2D | null = null;

/**
 * Reads pixels from a GPU-backed canvas via a dedicated CPU readback bridge canvas
 * so `getImageData` is NEVER called directly on `layer.canvas` or `displayCanvas`.
 * This prevents Chromium on Android from demoting layer/display canvases out of GPU VRAM.
 */
export function readCanvasRegion(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
): ImageData {
  if (!sharedReadCanvas) {
    sharedReadCanvas = document.createElement('canvas');
    sharedReadCtx = sharedReadCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (sharedReadCanvas.width < w) sharedReadCanvas.width = w;
  if (sharedReadCanvas.height < h) sharedReadCanvas.height = h;
  const ctx = sharedReadCtx!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Writes an ImageData patch back into a GPU-backed canvas via `drawImage`
 * so the target canvas remains hardware-accelerated.
 */
export function writeCanvasRegion(
  target: HTMLCanvasElement,
  patch: ImageData,
  x: number,
  y: number
): void {
  if (!sharedWriteCanvas) {
    sharedWriteCanvas = document.createElement('canvas');
    sharedWriteCtx = sharedWriteCanvas.getContext('2d');
  }
  const w = patch.width;
  const h = patch.height;
  if (sharedWriteCanvas.width < w) sharedWriteCanvas.width = w;
  if (sharedWriteCanvas.height < h) sharedWriteCanvas.height = h;
  sharedWriteCtx!.putImageData(patch, 0, 0);

  const dstCtx = target.getContext('2d');
  if (!dstCtx) return;
  dstCtx.save();
  dstCtx.globalCompositeOperation = 'source-over';
  dstCtx.globalAlpha = 1;
  dstCtx.clearRect(x, y, w, h);
  dstCtx.drawImage(sharedWriteCanvas, 0, 0, w, h, x, y, w, h);
  dstCtx.restore();
}
