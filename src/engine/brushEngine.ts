import { RGBA, clamp, lerpRgba } from '../color/colorMath';
import {
  DirtyRect,
  clampDirtyRect,
  readCanvasRegion,
  unionDirtyRect,
} from './gpuReadback';
import { LayerPatchHistoryEntry } from './historyManager';

export type BrushId = 'gpen' | 'airbrush' | 'mix' | 'blend';
export type EraserId = 'eraser-hard' | 'eraser-soft';
export type AnyBrushId = BrushId | EraserId;

export interface BrushSettings {
  id: AnyBrushId;
  name: string;
  shortLabel: string;
  description: string;
  size: number; // 1..300 px
  opacity: number; // 0.02..1
  hardness: number; // 0..1
  spacing: number; // fraction of diameter
  pressureSize: boolean;
  pressureOpacity: boolean;
  mixAmount: number; // 0..1 (for 'mix': ratio of brush color vs canvas pickup)
  colorStretch: number; // 0..1 (carry-over persistence)
}

export const DEFAULT_BRUSH_PRESETS: Record<AnyBrushId, BrushSettings> = {
  gpen: {
    id: 'gpen',
    name: 'Gペン・丸ペン',
    shortLabel: 'Gペン',
    description: 'エッジのくっきりしたアニメ塗り・下塗り・ハイライト描き込み用',
    size: 24,
    opacity: 1,
    hardness: 0.94,
    spacing: 0.09,
    pressureSize: true,
    pressureOpacity: false,
    mixAmount: 1,
    colorStretch: 0,
  },
  airbrush: {
    id: 'airbrush',
    name: 'ソフトエアブラシ',
    shortLabel: 'エアブラシ',
    description: '頬の赤み・環境光グラデーション・逆光グロー表現用',
    size: 90,
    opacity: 0.42,
    hardness: 0.08,
    spacing: 0.14,
    pressureSize: false,
    pressureOpacity: true,
    mixAmount: 1,
    colorStretch: 0,
  },
  mix: {
    id: 'mix',
    name: '厚塗り混色ブラシ',
    shortLabel: '厚塗り混色',
    description: '下地の色を拾いながら自然に色を混ぜ伸ばす厚塗り練習用ブラシ',
    size: 42,
    opacity: 0.88,
    hardness: 0.58,
    spacing: 0.1,
    pressureSize: true,
    pressureOpacity: true,
    mixAmount: 0.45,
    colorStretch: 0.78,
  },
  blend: {
    id: 'blend',
    name: '水彩なじませ・ぼかし',
    shortLabel: 'なじませ',
    description: '新しい絵の具を足さず、影とベース色の境界を柔らかく溶かすブラシ',
    size: 48,
    opacity: 0.65,
    hardness: 0.25,
    spacing: 0.11,
    pressureSize: false,
    pressureOpacity: true,
    mixAmount: 0,
    colorStretch: 0.88,
  },
  'eraser-hard': {
    id: 'eraser-hard',
    name: '硬め消しゴム',
    shortLabel: '硬消し',
    description: 'はみ出しをシャープに削る消しゴム',
    size: 28,
    opacity: 1,
    hardness: 0.92,
    spacing: 0.09,
    pressureSize: true,
    pressureOpacity: false,
    mixAmount: 1,
    colorStretch: 0,
  },
  'eraser-soft': {
    id: 'eraser-soft',
    name: '軟らかめ消しゴム',
    shortLabel: '軟消し',
    description: '影の端をふんわり抜くグラデーション消しゴム',
    size: 72,
    opacity: 0.55,
    hardness: 0.12,
    spacing: 0.14,
    pressureSize: false,
    pressureOpacity: true,
    mixAmount: 1,
    colorStretch: 0,
  },
};

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number; // 0..1
}

// Pre-allocated GPU scratch canvases (reused across strokes to eliminate pointerdown allocations)
let sharedLayerBackup: HTMLCanvasElement | null = null;
let sharedStrokeScratch: HTMLCanvasElement | null = null;
let sharedPredScratch: HTMLCanvasElement | null = null;
let sharedWetTip: HTMLCanvasElement | null = null;
let sharedWetSampler: HTMLCanvasElement | null = null;

function ensureGpuBuffer(
  buf: HTMLCanvasElement | null,
  width: number,
  height: number
): HTMLCanvasElement {
  const c = buf ?? document.createElement('canvas');
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  return c;
}

// Pre-baked 128x128 Brush Stamp Cache (eliminates per-dab resize & gradient creation)
const STAMP_DIM = 128;
const stampCache = new Map<string, HTMLCanvasElement>();

function getCachedBrushStamp(
  hardness: number,
  r: number,
  g: number,
  b: number
): HTMLCanvasElement {
  const hKey = Math.round(clamp(hardness, 0, 1) * 100);
  const key = `${hKey}:${r}:${g}:${b}`;
  const hit = stampCache.get(key);
  if (hit) return hit;

  // Keep cache bounded
  if (stampCache.size > 24) {
    const oldest = stampCache.keys().next().value;
    if (oldest !== undefined) stampCache.delete(oldest);
  }

  const c = document.createElement('canvas');
  c.width = STAMP_DIM;
  c.height = STAMP_DIM;
  const ctx = c.getContext('2d')!;
  const half = STAMP_DIM / 2;
  const radius = half - 1;
  const innerStop = clamp(hardness * 0.88, 0, 0.96);

  const grad = ctx.createRadialGradient(half, half, radius * innerStop, half, half, radius);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, STAMP_DIM, STAMP_DIM);

  stampCache.set(key, c);
  return c;
}

const WET_TIP_DIM = 64;

function renderWetTip(hardness: number, r: number, g: number, b: number): HTMLCanvasElement {
  if (!sharedWetTip) {
    sharedWetTip = document.createElement('canvas');
    sharedWetTip.width = WET_TIP_DIM;
    sharedWetTip.height = WET_TIP_DIM;
  }
  const ctx = sharedWetTip.getContext('2d')!;
  ctx.clearRect(0, 0, WET_TIP_DIM, WET_TIP_DIM);
  const half = WET_TIP_DIM / 2;
  const radius = half - 1;
  const innerStop = clamp(hardness * 0.88, 0, 0.95);
  const grad = ctx.createRadialGradient(half, half, radius * innerStop, half, half, radius);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WET_TIP_DIM, WET_TIP_DIM);
  return sharedWetTip;
}

export class StrokeSession {
  private layerId: string;
  private layerCanvas: HTMLCanvasElement;
  private layerCtx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  private backupCanvas: HTMLCanvasElement;
  private scratchCanvas: HTMLCanvasElement;
  private scratchCtx: CanvasRenderingContext2D;
  private predCanvas: HTMLCanvasElement;
  private predCtx: CanvasRenderingContext2D;

  private brush: BrushSettings;
  private color: RGBA;
  private isErase: boolean;
  private alphaLock: boolean;
  private isWetBrush: boolean;
  private cachedStamp: HTMLCanvasElement;

  private lastPoint: StrokePoint | null = null;
  private remainder = 0;
  private carryColor: RGBA | null = null;

  // Half-res CPU color pickup array for zero-GPU-stall wet mixing ('mix' / 'blend')
  private wetSampleData: Uint8ClampedArray | null = null;
  private wetSampleW = 0;
  private wetSampleH = 0;

  private totalBounds: DirtyRect | null = null;
  private prevPredictedBounds: DirtyRect | null = null;

  constructor(params: {
    layerId: string;
    layerCanvas: HTMLCanvasElement;
    compositeCanvas: HTMLCanvasElement;
    brush: BrushSettings;
    color: RGBA;
    isErase: boolean;
    alphaLock: boolean;
  }) {
    this.layerId = params.layerId;
    this.layerCanvas = params.layerCanvas;
    this.layerCtx = params.layerCanvas.getContext('2d')!;
    this.width = params.layerCanvas.width;
    this.height = params.layerCanvas.height;

    this.brush = { ...params.brush };
    this.color = {
      r: Math.round(params.color.r),
      g: Math.round(params.color.g),
      b: Math.round(params.color.b),
      a: params.color.a,
    };
    this.isErase = params.isErase;
    this.alphaLock = params.alphaLock;
    this.isWetBrush = !params.isErase && (params.brush.id === 'mix' || params.brush.id === 'blend');

    // Fast <0.3ms GPU-to-GPU backup of activeLayer (zero getImageData CPU readback!)
    sharedLayerBackup = ensureGpuBuffer(sharedLayerBackup, this.width, this.height);
    this.backupCanvas = sharedLayerBackup;
    const backupCtx = this.backupCanvas.getContext('2d')!;
    backupCtx.clearRect(0, 0, this.width, this.height);
    backupCtx.drawImage(this.layerCanvas, 0, 0);

    sharedStrokeScratch = ensureGpuBuffer(sharedStrokeScratch, this.width, this.height);
    this.scratchCanvas = sharedStrokeScratch;
    this.scratchCtx = this.scratchCanvas.getContext('2d')!;
    this.scratchCtx.clearRect(0, 0, this.width, this.height);

    sharedPredScratch = ensureGpuBuffer(sharedPredScratch, this.width, this.height);
    this.predCanvas = sharedPredScratch;
    this.predCtx = this.predCanvas.getContext('2d')!;

    this.cachedStamp = getCachedBrushStamp(
      this.brush.hardness,
      this.color.r,
      this.color.g,
      this.color.b
    );

    // Only for wet brushes ('mix' / 'blend'): capture 1/2-res color pickup array once at start
    if (this.isWetBrush) {
      this.wetSampleW = Math.max(1, Math.floor(this.width / 2));
      this.wetSampleH = Math.max(1, Math.floor(this.height / 2));
      if (!sharedWetSampler) {
        sharedWetSampler = document.createElement('canvas');
      }
      if (sharedWetSampler.width !== this.wetSampleW) sharedWetSampler.width = this.wetSampleW;
      if (sharedWetSampler.height !== this.wetSampleH) sharedWetSampler.height = this.wetSampleH;
      const sCtx = sharedWetSampler.getContext('2d', { willReadFrequently: true })!;
      sCtx.clearRect(0, 0, this.wetSampleW, this.wetSampleH);
      sCtx.drawImage(params.compositeCanvas, 0, 0, this.wetSampleW, this.wetSampleH);
      this.wetSampleData = sCtx.getImageData(0, 0, this.wetSampleW, this.wetSampleH).data;
    }
  }

  private sampleWetColorFast(x: number, y: number): RGBA | null {
    if (!this.wetSampleData) return null;
    const sx = clamp(Math.floor(x * 0.5), 0, this.wetSampleW - 1);
    const sy = clamp(Math.floor(y * 0.5), 0, this.wetSampleH - 1);
    const idx = (sy * this.wetSampleW + sx) * 4;
    if (this.wetSampleData[idx + 3] <= 10) return null;
    return {
      r: this.wetSampleData[idx],
      g: this.wetSampleData[idx + 1],
      b: this.wetSampleData[idx + 2],
      a: 1,
    };
  }

  private writeWetColorFast(x: number, y: number, rgb: RGBA): void {
    if (!this.wetSampleData) return;
    const sx = clamp(Math.floor(x * 0.5), 0, this.wetSampleW - 1);
    const sy = clamp(Math.floor(y * 0.5), 0, this.wetSampleH - 1);
    const idx = (sy * this.wetSampleW + sx) * 4;
    this.wetSampleData[idx] = Math.round(rgb.r);
    this.wetSampleData[idx + 1] = Math.round(rgb.g);
    this.wetSampleData[idx + 2] = Math.round(rgb.b);
    this.wetSampleData[idx + 3] = 255;
  }

  private stampSingleDab(
    targetCtx: CanvasRenderingContext2D,
    pt: StrokePoint,
    isPrediction: boolean
  ): DirtyRect | null {
    const p = clamp(pt.pressure || 0.5, 0.05, 1);
    const radius = Math.max(
      0.7,
      (this.brush.size * (this.brush.pressureSize ? 0.18 + 0.82 * p : 1)) / 2
    );
    const dabAlpha = this.brush.pressureOpacity ? clamp(p * p * 0.85 + 0.15, 0.04, 1) : 1;

    const drawX = pt.x - radius;
    const drawY = pt.y - radius;
    const drawDim = radius * 2;
    const dabBounds: DirtyRect = {
      x: drawX - 2,
      y: drawY - 2,
      w: drawDim + 4,
      h: drawDim + 4,
    };

    if (this.isWetBrush) {
      if (isPrediction) return null; // Skip prediction mutation on stateful wet brushes
      const sampled = this.sampleWetColorFast(pt.x, pt.y);
      if (!this.carryColor) {
        this.carryColor = sampled ?? { ...this.color };
      } else if (sampled) {
        this.carryColor = lerpRgba(sampled, this.carryColor, this.brush.colorStretch, 'oklab');
      }

      let paintRgb = this.color;
      if (this.brush.id === 'blend') {
        if (!sampled && !this.carryColor) return null;
        paintRgb = this.carryColor;
      } else {
        const freshWeight = clamp(this.brush.mixAmount * (0.4 + 0.6 * p), 0.05, 0.98);
        paintRgb = lerpRgba(this.carryColor, this.color, freshWeight, 'oklab');
        this.carryColor = paintRgb;
      }

      this.writeWetColorFast(pt.x, pt.y, paintRgb);
      const wetStamp = renderWetTip(
        this.brush.hardness,
        Math.round(paintRgb.r),
        Math.round(paintRgb.g),
        Math.round(paintRgb.b)
      );
      const flow = clamp(this.brush.opacity * dabAlpha * 0.55, 0.03, 0.92);

      this.layerCtx.save();
      this.layerCtx.globalAlpha = flow;
      this.layerCtx.globalCompositeOperation = this.alphaLock ? 'source-atop' : 'source-over';
      this.layerCtx.drawImage(wetStamp, drawX, drawY, drawDim, drawDim);
      this.layerCtx.restore();
      return dabBounds;
    }

    // Standard GPU cached stamp (G-pen, Airbrush, Hard/Soft Erasers)
    const flow =
      this.brush.id === 'airbrush' || this.brush.id === 'eraser-soft'
        ? clamp(dabAlpha * 0.36, 0.02, 0.85)
        : clamp(dabAlpha, 0.06, 1);

    targetCtx.save();
    targetCtx.globalAlpha = flow;
    targetCtx.drawImage(this.cachedStamp, drawX, drawY, drawDim, drawDim);
    targetCtx.restore();
    return dabBounds;
  }

  private flushRegionFromScratch(sourceScratch: HTMLCanvasElement, rect: DirtyRect): void {
    if (this.isWetBrush) return;
    const clamped = clampDirtyRect(rect, this.width, this.height);
    if (!clamped) return;
    const { x, y, w, h } = clamped;

    this.layerCtx.save();
    this.layerCtx.beginPath();
    this.layerCtx.rect(x, y, w, h);
    this.layerCtx.clip();

    // Restore clean pre-stroke pixels in (x, y, w, h) on GPU
    this.layerCtx.globalAlpha = 1;
    this.layerCtx.globalCompositeOperation = 'source-over';
    this.layerCtx.clearRect(x, y, w, h);
    this.layerCtx.drawImage(this.backupCanvas, x, y, w, h, x, y, w, h);

    // Composite current stroke scratch in (x, y, w, h) at uniform stroke opacity
    this.layerCtx.globalAlpha = clamp(this.brush.opacity, 0.01, 1);
    if (this.isErase) {
      this.layerCtx.globalCompositeOperation = 'destination-out';
    } else if (this.alphaLock) {
      this.layerCtx.globalCompositeOperation = 'source-atop';
    } else {
      this.layerCtx.globalCompositeOperation = 'source-over';
    }
    this.layerCtx.drawImage(sourceScratch, x, y, w, h, x, y, w, h);
    this.layerCtx.restore();
  }

  private appendSegmentToCtx(
    targetCtx: CanvasRenderingContext2D,
    fromPt: StrokePoint,
    toPt: StrokePoint,
    remainderIn: number,
    isPrediction: boolean
  ): { remainderOut: number; bounds: DirtyRect | null; nextLast: StrokePoint } {
    const dx = toPt.x - fromPt.x;
    const dy = toPt.y - fromPt.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.25) {
      return { remainderOut: remainderIn, bounds: null, nextLast: fromPt };
    }

    const avgP = (fromPt.pressure + toPt.pressure) * 0.5;
    const effDiameter = Math.max(
      1.8,
      this.brush.size * (this.brush.pressureSize ? 0.2 + 0.8 * avgP : 1)
    );
    const step = Math.max(0.9, effDiameter * this.brush.spacing);

    let bounds: DirtyRect | null = null;
    let traveled = step - remainderIn;
    while (traveled <= dist) {
      const t = traveled / dist;
      const dabRect = this.stampSingleDab(
        targetCtx,
        {
          x: fromPt.x + dx * t,
          y: fromPt.y + dy * t,
          pressure: fromPt.pressure + (toPt.pressure - fromPt.pressure) * t,
        },
        isPrediction
      );
      bounds = unionDirtyRect(bounds, dabRect);
      traveled += step;
    }

    return {
      remainderOut: dist - (traveled - step),
      bounds,
      nextLast: toPt,
    };
  }

  /**
   * Processes all coalesced points + optional OS-predicted stylus points in a single batch,
   * flushing ONLY the dirty bounding box to `activeLayer.canvas` and returning the exact
   * `DirtyRect` to composite onto `displayCanvas`.
   */
  public addPointsBatch(
    committedPoints: StrokePoint[],
    predictedPoints: StrokePoint[] = []
  ): DirtyRect | null {
    // Include previous predicted tail so it gets overwritten with true committed ink
    let frameDirty: DirtyRect | null = this.prevPredictedBounds;
    this.prevPredictedBounds = null;

    let committedDirty: DirtyRect | null = null;

    for (const pt of committedPoints) {
      if (!this.lastPoint) {
        this.lastPoint = pt;
        this.remainder = 0;
        const r0 = this.stampSingleDab(this.scratchCtx, pt, false);
        committedDirty = unionDirtyRect(committedDirty, r0);
      } else {
        const res = this.appendSegmentToCtx(
          this.scratchCtx,
          this.lastPoint,
          pt,
          this.remainder,
          false
        );
        this.remainder = res.remainderOut;
        this.lastPoint = res.nextLast;
        committedDirty = unionDirtyRect(committedDirty, res.bounds);
      }
    }

    this.totalBounds = unionDirtyRect(this.totalBounds, committedDirty);
    frameDirty = unionDirtyRect(frameDirty, committedDirty);

    if (frameDirty && !this.isWetBrush) {
      this.flushRegionFromScratch(this.scratchCanvas, frameDirty);
    }

    // Optional transient predicted tail (up to 2 predicted samples, never mutating committed state)
    if (!this.isWetBrush && this.lastPoint && predictedPoints.length > 0) {
      const maxPred = predictedPoints.slice(0, 2);
      // Estimate bounding box for predicted segment first
      const maxR = this.brush.size * 0.55 + 4;
      let minX = this.lastPoint.x - maxR;
      let minY = this.lastPoint.y - maxR;
      let maxX = this.lastPoint.x + maxR;
      let maxY = this.lastPoint.y + maxR;
      for (const pp of maxPred) {
        minX = Math.min(minX, pp.x - maxR);
        minY = Math.min(minY, pp.y - maxR);
        maxX = Math.max(maxX, pp.x + maxR);
        maxY = Math.max(maxY, pp.y + maxR);
      }
      const predBox = clampDirtyRect(
        { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        this.width,
        this.height
      );

      if (predBox) {
        this.predCtx.clearRect(predBox.x, predBox.y, predBox.w, predBox.h);
        this.predCtx.drawImage(
          this.scratchCanvas,
          predBox.x,
          predBox.y,
          predBox.w,
          predBox.h,
          predBox.x,
          predBox.y,
          predBox.w,
          predBox.h
        );

        let simLast = this.lastPoint;
        let simRem = this.remainder;
        let actualPredDirty: DirtyRect | null = null;
        for (const pp of maxPred) {
          const sim = this.appendSegmentToCtx(this.predCtx, simLast, pp, simRem, true);
          simRem = sim.remainderOut;
          simLast = sim.nextLast;
          actualPredDirty = unionDirtyRect(actualPredDirty, sim.bounds);
        }

        if (actualPredDirty) {
          const clampedPred = clampDirtyRect(actualPredDirty, this.width, this.height);
          if (clampedPred) {
            this.flushRegionFromScratch(this.predCanvas, clampedPred);
            this.prevPredictedBounds = clampedPred;
            frameDirty = unionDirtyRect(frameDirty, clampedPred);
          }
        }
      }
    }

    return frameDirty ? clampDirtyRect(frameDirty, this.width, this.height) : null;
  }

  /**
   * Cancels an accidental stroke (e.g. 2-finger gesture detected right after touch start)
   * using a fast GPU restore inside `totalBounds`.
   */
  public cancelStroke(): DirtyRect | null {
    const dirty = unionDirtyRect(this.totalBounds, this.prevPredictedBounds);
    const clamped = dirty ? clampDirtyRect(dirty, this.width, this.height) : null;
    if (!clamped) return null;

    this.layerCtx.save();
    this.layerCtx.globalAlpha = 1;
    this.layerCtx.globalCompositeOperation = 'source-over';
    this.layerCtx.clearRect(clamped.x, clamped.y, clamped.w, clamped.h);
    this.layerCtx.drawImage(
      this.backupCanvas,
      clamped.x,
      clamped.y,
      clamped.w,
      clamped.h,
      clamped.x,
      clamped.y,
      clamped.w,
      clamped.h
    );
    this.layerCtx.restore();
    return clamped;
  }

  /**
   * Finalizes the stroke: strips any transient predicted tail and returns a compact
   * bounding-box `LayerPatchHistoryEntry` for Undo/Redo.
   */
  public finishStroke(): {
    finalDirty: DirtyRect | null;
    patchEntry: LayerPatchHistoryEntry | null;
  } {
    let finalDirty: DirtyRect | null = null;
    if (this.prevPredictedBounds && !this.isWetBrush) {
      this.flushRegionFromScratch(this.scratchCanvas, this.prevPredictedBounds);
      finalDirty = this.prevPredictedBounds;
      this.prevPredictedBounds = null;
    }

    const bounds = this.totalBounds
      ? clampDirtyRect(this.totalBounds, this.width, this.height)
      : null;
    if (!bounds) {
      return { finalDirty, patchEntry: null };
    }

    const before = readCanvasRegion(this.backupCanvas, bounds.x, bounds.y, bounds.w, bounds.h);
    const after = readCanvasRegion(this.layerCanvas, bounds.x, bounds.y, bounds.w, bounds.h);

    return {
      finalDirty,
      patchEntry: {
        kind: 'patch',
        layerId: this.layerId,
        x: bounds.x,
        y: bounds.y,
        before,
        after,
      },
    };
  }
}
