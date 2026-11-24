import { DirtyRect, clampDirtyRect, readCanvasRegion } from './gpuReadback';

export type LayerBlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'lighter'
  | 'soft-light'
  | 'darken'
  | 'lighten';

export const BLEND_MODE_OPTIONS: Array<{ value: LayerBlendMode; label: string }> = [
  { value: 'source-over', label: '通常' },
  { value: 'multiply', label: '乗算 (影・線画)' },
  { value: 'screen', label: 'スクリーン' },
  { value: 'overlay', label: 'オーバーレイ' },
  { value: 'lighter', label: '加算・発光' },
  { value: 'soft-light', label: 'ソフトライト' },
  { value: 'darken', label: '比較 (暗)' },
  { value: 'lighten', label: '比較 (明)' },
];

export interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  blendMode: LayerBlendMode;
  clipped: boolean; // 下のレイヤーでクリッピング
  alphaLock: boolean; // 透明ピクセルをロック
  isReference: boolean; // 参照レイヤー（バケツ参照用）
  canvas: HTMLCanvasElement;
}

let sharedGroupCanvas: HTMLCanvasElement | null = null;
let sharedMaskCanvas: HTMLCanvasElement | null = null;

function ensureScratchCanvas(
  existing: HTMLCanvasElement | null,
  width: number,
  height: number
): HTMLCanvasElement {
  const c = existing ?? document.createElement('canvas');
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  return c;
}

/**
 * Composites layers bottom-to-top onto outputCtx on GPU.
 * When `dirtyRect` is provided, ONLY the dirty sub-rectangle `(dx, dy, dw, dh)` is cleared,
 * clipped, and composited — cutting per-frame pixel throughput by >98% during stylus strokes.
 */
export function compositeLayers(
  outputCtx: CanvasRenderingContext2D,
  layers: LayerItem[],
  width: number,
  height: number,
  paperColor: string | null = '#ffffff',
  dirtyRect?: DirtyRect | null
): void {
  const region = dirtyRect
    ? clampDirtyRect(dirtyRect, width, height)
    : { x: 0, y: 0, w: width, h: height };
  if (!region) return;

  const { x: dx, y: dy, w: dw, h: dh } = region;

  outputCtx.save();
  outputCtx.setTransform(1, 0, 0, 1, 0, 0);
  outputCtx.beginPath();
  outputCtx.rect(dx, dy, dw, dh);
  outputCtx.clip();
  outputCtx.clearRect(dx, dy, dw, dh);

  if (paperColor) {
    outputCtx.fillStyle = paperColor;
    outputCtx.fillRect(dx, dy, dw, dh);
  }

  let i = 0;
  while (i < layers.length) {
    const baseLayer = layers[i];

    // Check if subsequent layers clip to this base layer
    let clipEnd = i;
    while (clipEnd + 1 < layers.length && layers[clipEnd + 1].clipped) {
      clipEnd++;
    }

    if (!baseLayer.visible) {
      i = clipEnd + 1;
      continue;
    }

    if (clipEnd === i) {
      if (baseLayer.opacity > 0) {
        outputCtx.save();
        outputCtx.globalAlpha = baseLayer.opacity;
        outputCtx.globalCompositeOperation = baseLayer.blendMode;
        outputCtx.drawImage(baseLayer.canvas, dx, dy, dw, dh, dx, dy, dw, dh);
        outputCtx.restore();
      }
      i++;
      continue;
    }

    // Clipping stack: baseLayer + layers[i+1 .. clipEnd], restricted strictly to (dx, dy, dw, dh)
    sharedGroupCanvas = ensureScratchCanvas(sharedGroupCanvas, width, height);
    sharedMaskCanvas = ensureScratchCanvas(sharedMaskCanvas, width, height);
    const groupCtx = sharedGroupCanvas.getContext('2d')!;
    const maskCtx = sharedMaskCanvas.getContext('2d')!;

    groupCtx.clearRect(dx, dy, dw, dh);
    groupCtx.drawImage(baseLayer.canvas, dx, dy, dw, dh, dx, dy, dw, dh);

    for (let k = i + 1; k <= clipEnd; k++) {
      const cl = layers[k];
      if (!cl.visible || cl.opacity <= 0) continue;

      maskCtx.save();
      maskCtx.beginPath();
      maskCtx.rect(dx, dy, dw, dh);
      maskCtx.clip();

      maskCtx.clearRect(dx, dy, dw, dh);
      maskCtx.drawImage(sharedGroupCanvas, dx, dy, dw, dh, dx, dy, dw, dh);

      maskCtx.save();
      maskCtx.globalAlpha = cl.opacity;
      maskCtx.globalCompositeOperation = cl.blendMode;
      maskCtx.drawImage(cl.canvas, dx, dy, dw, dh, dx, dy, dw, dh);
      maskCtx.restore();

      maskCtx.save();
      maskCtx.globalCompositeOperation = 'destination-in';
      maskCtx.drawImage(baseLayer.canvas, dx, dy, dw, dh, dx, dy, dw, dh);
      maskCtx.restore();

      maskCtx.restore();

      groupCtx.clearRect(dx, dy, dw, dh);
      groupCtx.drawImage(sharedMaskCanvas, dx, dy, dw, dh, dx, dy, dw, dh);
    }

    if (baseLayer.opacity > 0) {
      outputCtx.save();
      outputCtx.globalAlpha = baseLayer.opacity;
      outputCtx.globalCompositeOperation = baseLayer.blendMode;
      outputCtx.drawImage(sharedGroupCanvas, dx, dy, dw, dh, dx, dy, dw, dh);
      outputCtx.restore();
    }

    i = clipEnd + 1;
  }

  outputCtx.restore();
}

/**
 * Generates an ImageData composite of Reference layers (for Reference Bucket Fill)
 * using the isolated readback bridge so layer canvases remain GPU-accelerated.
 */
export function buildReferenceImageData(
  layers: LayerItem[],
  width: number,
  height: number,
  mode: 'reference' | 'all' | 'active',
  activeLayerId: string
): ImageData | null {
  if (mode === 'active') return null;

  const temp = document.createElement('canvas');
  temp.width = width;
  temp.height = height;
  const ctx = temp.getContext('2d');
  if (!ctx) return null;

  if (mode === 'reference') {
    const refLayers = layers.filter((l) => l.visible && (l.isReference || l.id === activeLayerId));
    const targetList = refLayers.some((l) => l.isReference)
      ? refLayers
      : layers.filter((l) => l.visible);
    for (const l of targetList) {
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.canvas, 0, 0);
      ctx.restore();
    }
  } else {
    compositeLayers(ctx, layers, width, height, null);
  }

  return readCanvasRegion(temp, 0, 0, width, height);
}
