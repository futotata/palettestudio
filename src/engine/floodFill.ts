import { RGBA, clamp } from '../color/colorMath';

export interface FloodFillOptions {
  x: number;
  y: number;
  fillColor: RGBA;
  isErase?: boolean;
  tolerance: number; // 0..100
  expandPx: number; // 0..3 (area scaling to prevent white gaps along anti-aliased line art)
  alphaLock?: boolean;
}

/**
 * Scanline Flood Fill supporting a separate Reference ImageData (e.g. Line Art Reference Layer
 * or All Visible Layers composite) while writing pixels into targetCanvas.
 */
export function executeFloodFill(
  targetCanvas: HTMLCanvasElement,
  referenceImageData: ImageData | null,
  options: FloodFillOptions
): boolean {
  const w = targetCanvas.width;
  const h = targetCanvas.height;
  const startX = Math.floor(options.x);
  const startY = Math.floor(options.y);

  if (startX < 0 || startX >= w || startY < 0 || startY >= h) {
    return false;
  }

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  const targetImage = ctx.getImageData(0, 0, w, h);
  const targetData = targetImage.data;
  const refData = referenceImageData ? referenceImageData.data : targetData;

  const startIdx = (startY * w + startX) * 4;
  const sr = refData[startIdx];
  const sg = refData[startIdx + 1];
  const sb = refData[startIdx + 2];
  const sa = refData[startIdx + 3];

  const maxDiff = Math.round((clamp(options.tolerance, 0, 100) / 100) * 255);

  const matchesSeed = (pixelIndex: number): boolean => {
    const i = pixelIndex * 4;
    const a = refData[i + 3];
    if (sa === 0 && a === 0) return true;
    const dr = Math.abs(refData[i] - sr);
    const dg = Math.abs(refData[i + 1] - sg);
    const db = Math.abs(refData[i + 2] - sb);
    const da = Math.abs(a - sa);
    return dr <= maxDiff && dg <= maxDiff && db <= maxDiff && da <= maxDiff;
  };

  const totalPixels = w * h;
  const mask = new Uint8Array(totalPixels);
  const stack = new Int32Array(totalPixels);
  let stackPtr = 0;

  const seedPixel = startY * w + startX;
  mask[seedPixel] = 1;
  stack[stackPtr++] = seedPixel;

  let filledCount = 0;

  while (stackPtr > 0) {
    const p = stack[--stackPtr];
    filledCount++;

    const px = p % w;
    const py = (p - px) / w;

    // Left
    if (px > 0) {
      const left = p - 1;
      if (mask[left] === 0 && matchesSeed(left)) {
        mask[left] = 1;
        stack[stackPtr++] = left;
      }
    }
    // Right
    if (px < w - 1) {
      const right = p + 1;
      if (mask[right] === 0 && matchesSeed(right)) {
        mask[right] = 1;
        stack[stackPtr++] = right;
      }
    }
    // Up
    if (py > 0) {
      const up = p - w;
      if (mask[up] === 0 && matchesSeed(up)) {
        mask[up] = 1;
        stack[stackPtr++] = up;
      }
    }
    // Down
    if (py < h - 1) {
      const down = p + w;
      if (mask[down] === 0 && matchesSeed(down)) {
        mask[down] = 1;
        stack[stackPtr++] = down;
      }
    }
  }

  if (filledCount === 0) return false;

  // Area scaling (dilation by 1..3 px so fill reaches cleanly beneath anti-aliased line edges)
  let activeMask = mask;
  const expandSteps = clamp(Math.round(options.expandPx), 0, 3);
  for (let step = 0; step < expandSteps; step++) {
    const nextMask = new Uint8Array(activeMask);
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        const idx = rowOffset + x;
        if (activeMask[idx] === 1) continue;
        if (
          (x > 0 && activeMask[idx - 1] === 1) ||
          (x < w - 1 && activeMask[idx + 1] === 1) ||
          (y > 0 && activeMask[idx - w] === 1) ||
          (y < h - 1 && activeMask[idx + w] === 1)
        ) {
          nextMask[idx] = 1;
        }
      }
    }
    activeMask = nextMask;
  }

  const fr = clamp(Math.round(options.fillColor.r), 0, 255);
  const fg = clamp(Math.round(options.fillColor.g), 0, 255);
  const fb = clamp(Math.round(options.fillColor.b), 0, 255);
  const fa = clamp(options.fillColor.a, 0, 1);

  for (let p = 0; p < totalPixels; p++) {
    if (activeMask[p] === 0) continue;
    const i = p * 4;

    if (options.isErase) {
      targetData[i + 3] = 0;
      continue;
    }

    const dstA = targetData[i + 3] / 255;
    if (options.alphaLock && dstA <= 0) {
      continue;
    }

    if (options.alphaLock) {
      // Preserve destination alpha, blend RGB
      const mix = fa;
      targetData[i] = Math.round(fr * mix + targetData[i] * (1 - mix));
      targetData[i + 1] = Math.round(fg * mix + targetData[i + 1] * (1 - mix));
      targetData[i + 2] = Math.round(fb * mix + targetData[i + 2] * (1 - mix));
    } else {
      const outA = fa + dstA * (1 - fa);
      if (outA <= 1e-5) {
        targetData[i + 3] = 0;
      } else {
        targetData[i] = Math.round((fr * fa + targetData[i] * dstA * (1 - fa)) / outA);
        targetData[i + 1] = Math.round((fg * fa + targetData[i + 1] * dstA * (1 - fa)) / outA);
        targetData[i + 2] = Math.round((fb * fa + targetData[i + 2] * dstA * (1 - fa)) / outA);
        targetData[i + 3] = Math.round(outA * 255);
      }
    }
  }

  ctx.putImageData(targetImage, 0, 0);
  return true;
}
