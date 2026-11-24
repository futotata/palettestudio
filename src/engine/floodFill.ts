import { RGBA, clamp } from '../color/colorMath';
import { readCanvasRegion, writeCanvasRegion } from './gpuReadback';
import { LayerPatchHistoryEntry } from './historyManager';

export interface FloodFillOptions {
  layerId: string;
  x: number;
  y: number;
  fillColor: RGBA;
  isErase?: boolean;
  tolerance: number; // 0..100
  expandPx: number; // 0..3
  alphaLock?: boolean;
}

/**
 * Scanline Flood Fill using isolated GPU readback/writeback bridges
 * and returning a compact bounding-box LayerPatchHistoryEntry for fast Undo/Redo.
 */
export function executeFloodFill(
  targetCanvas: HTMLCanvasElement,
  referenceImageData: ImageData | null,
  options: FloodFillOptions
): LayerPatchHistoryEntry | null {
  const w = targetCanvas.width;
  const h = targetCanvas.height;
  const startX = Math.floor(options.x);
  const startY = Math.floor(options.y);

  if (startX < 0 || startX >= w || startY < 0 || startY >= h) {
    return null;
  }

  const beforeFull = readCanvasRegion(targetCanvas, 0, 0, w, h);
  const targetImage = new ImageData(new Uint8ClampedArray(beforeFull.data), w, h);
  const targetData = targetImage.data;
  const refData = referenceImageData ? referenceImageData.data : beforeFull.data;

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
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  while (stackPtr > 0) {
    const p = stack[--stackPtr];
    filledCount++;

    const px = p % w;
    const py = (p - px) / w;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;

    if (px > 0) {
      const left = p - 1;
      if (mask[left] === 0 && matchesSeed(left)) {
        mask[left] = 1;
        stack[stackPtr++] = left;
      }
    }
    if (px < w - 1) {
      const right = p + 1;
      if (mask[right] === 0 && matchesSeed(right)) {
        mask[right] = 1;
        stack[stackPtr++] = right;
      }
    }
    if (py > 0) {
      const up = p - w;
      if (mask[up] === 0 && matchesSeed(up)) {
        mask[up] = 1;
        stack[stackPtr++] = up;
      }
    }
    if (py < h - 1) {
      const down = p + w;
      if (mask[down] === 0 && matchesSeed(down)) {
        mask[down] = 1;
        stack[stackPtr++] = down;
      }
    }
  }

  if (filledCount === 0) return null;

  let activeMask = mask;
  const expandSteps = clamp(Math.round(options.expandPx), 0, 3);
  if (expandSteps > 0) {
    minX = Math.max(0, minX - expandSteps);
    maxX = Math.min(w - 1, maxX + expandSteps);
    minY = Math.max(0, minY - expandSteps);
    maxY = Math.min(h - 1, maxY + expandSteps);
  }

  for (let step = 0; step < expandSteps; step++) {
    const nextMask = new Uint8Array(activeMask);
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * w;
      for (let x = minX; x <= maxX; x++) {
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

  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * w;
    for (let x = minX; x <= maxX; x++) {
      const p = rowOffset + x;
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
  }

  const patchW = maxX - minX + 1;
  const patchH = maxY - minY + 1;
  const beforePatch = new ImageData(patchW, patchH);
  const afterPatch = new ImageData(patchW, patchH);

  for (let py = 0; py < patchH; py++) {
    const srcStart = ((minY + py) * w + minX) * 4;
    const srcEnd = srcStart + patchW * 4;
    const dstStart = py * patchW * 4;
    beforePatch.data.set(beforeFull.data.subarray(srcStart, srcEnd), dstStart);
    afterPatch.data.set(targetData.subarray(srcStart, srcEnd), dstStart);
  }

  writeCanvasRegion(targetCanvas, afterPatch, minX, minY);

  return {
    kind: 'patch',
    layerId: options.layerId,
    x: minX,
    y: minY,
    before: beforePatch,
    after: afterPatch,
  };
}
