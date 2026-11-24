import { RGBA, clamp, lerpRgba } from '../color/colorMath';

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
    spacing: 0.08,
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
    spacing: 0.12,
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
    spacing: 0.09,
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
    spacing: 0.1,
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
    spacing: 0.08,
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
    spacing: 0.12,
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

export class StrokeSession {
  private layerCanvas: HTMLCanvasElement;
  private layerCtx: CanvasRenderingContext2D;
  private baseSnapshot: ImageData;
  private strokeScratch: HTMLCanvasElement;
  private strokeScratchCtx: CanvasRenderingContext2D;
  private tipCanvas: HTMLCanvasElement;
  private tipCtx: CanvasRenderingContext2D;

  private brush: BrushSettings;
  private color: RGBA;
  private isErase: boolean;
  private alphaLock: boolean;
  private sampleCtx: CanvasRenderingContext2D | null;

  private lastPoint: StrokePoint | null = null;
  private remainder = 0;
  private carryColor: RGBA | null = null;

  constructor(params: {
    layerCanvas: HTMLCanvasElement;
    compositeCanvas: HTMLCanvasElement;
    brush: BrushSettings;
    color: RGBA;
    isErase: boolean;
    alphaLock: boolean;
  }) {
    this.layerCanvas = params.layerCanvas;
    this.layerCtx = params.layerCanvas.getContext('2d', { willReadFrequently: true })!;
    this.baseSnapshot = this.layerCtx.getImageData(
      0,
      0,
      params.layerCanvas.width,
      params.layerCanvas.height
    );

    this.strokeScratch = document.createElement('canvas');
    this.strokeScratch.width = params.layerCanvas.width;
    this.strokeScratch.height = params.layerCanvas.height;
    this.strokeScratchCtx = this.strokeScratch.getContext('2d')!;

    this.tipCanvas = document.createElement('canvas');
    this.tipCtx = this.tipCanvas.getContext('2d')!;

    this.brush = { ...params.brush };
    this.color = { ...params.color };
    this.isErase = params.isErase;
    this.alphaLock = params.alphaLock;
    this.sampleCtx = params.compositeCanvas.getContext('2d', { willReadFrequently: true });
  }

  public getBeforeSnapshot(): ImageData {
    return this.baseSnapshot;
  }

  private sampleUnderlyingColor(x: number, y: number): RGBA | null {
    const w = this.layerCanvas.width;
    const h = this.layerCanvas.height;
    const ix = clamp(Math.round(x), 0, w - 1);
    const iy = clamp(Math.round(y), 0, h - 1);

    // Prefer active layer pixel if non-transparent, else composite canvas for wet feel
    const layerPx = this.layerCtx.getImageData(ix, iy, 1, 1).data;
    if (layerPx[3] > 12) {
      return { r: layerPx[0], g: layerPx[1], b: layerPx[2], a: layerPx[3] / 255 };
    }
    if (this.sampleCtx) {
      const compPx = this.sampleCtx.getImageData(ix, iy, 1, 1).data;
      if (compPx[3] > 12) {
        return { r: compPx[0], g: compPx[1], b: compPx[2], a: 1 };
      }
    }
    return null;
  }

  private stampDab(pt: StrokePoint): void {
    const p = clamp(pt.pressure || 0.5, 0.05, 1);
    const radius = Math.max(
      0.6,
      (this.brush.size * (this.brush.pressureSize ? 0.18 + 0.82 * p : 1)) / 2
    );
    const dabAlpha = this.brush.pressureOpacity ? clamp(p * p * 0.85 + 0.15, 0.04, 1) : 1;

    const isWetBrush = !this.isErase && (this.brush.id === 'mix' || this.brush.id === 'blend');

    let paintRgb = this.color;
    if (isWetBrush) {
      const sampled = this.sampleUnderlyingColor(pt.x, pt.y);
      if (!this.carryColor) {
        this.carryColor = sampled ?? { ...this.color };
      } else if (sampled) {
        this.carryColor = lerpRgba(sampled, this.carryColor, this.brush.colorStretch, 'oklab');
      }

      if (this.brush.id === 'blend') {
        if (!sampled && !this.carryColor) return;
        paintRgb = this.carryColor;
      } else {
        // 'mix': blend fresh brush pigment with carried canvas pigment using Oklab
        const freshWeight = clamp(this.brush.mixAmount * (0.4 + 0.6 * p), 0.05, 0.98);
        paintRgb = lerpRgba(this.carryColor, this.color, freshWeight, 'oklab');
        this.carryColor = paintRgb;
      }
    }

    const pad = Math.ceil(radius + 2);
    const dim = pad * 2;
    if (this.tipCanvas.width !== dim || this.tipCanvas.height !== dim) {
      this.tipCanvas.width = dim;
      this.tipCanvas.height = dim;
    } else {
      this.tipCtx.clearRect(0, 0, dim, dim);
    }

    const innerStop = clamp(this.brush.hardness * 0.88, 0, 0.95);
    const grad = this.tipCtx.createRadialGradient(pad, pad, radius * innerStop, pad, pad, radius);
    const rgbPrefix = `${Math.round(paintRgb.r)}, ${Math.round(paintRgb.g)}, ${Math.round(paintRgb.b)}`;

    if (isWetBrush) {
      const flow = clamp(this.brush.opacity * dabAlpha * 0.55, 0.03, 0.92);
      grad.addColorStop(0, `rgba(${rgbPrefix}, ${flow})`);
      grad.addColorStop(1, `rgba(${rgbPrefix}, 0)`);
      this.tipCtx.fillStyle = grad;
      this.tipCtx.fillRect(0, 0, dim, dim);

      this.layerCtx.save();
      if (this.alphaLock) {
        this.layerCtx.globalCompositeOperation = 'source-atop';
      } else {
        this.layerCtx.globalCompositeOperation = 'source-over';
      }
      this.layerCtx.drawImage(this.tipCanvas, pt.x - pad, pt.y - pad);
      this.layerCtx.restore();
    } else {
      // Glaze/stroke-buffer rendering for uniform stroke opacity (G-pen, Airbrush, Erasers)
      const flow = this.brush.id === 'airbrush' || this.brush.id === 'eraser-soft'
        ? clamp(dabAlpha * 0.35, 0.02, 0.85)
        : clamp(dabAlpha, 0.05, 1);
      grad.addColorStop(0, `rgba(${rgbPrefix}, ${flow})`);
      grad.addColorStop(1, `rgba(${rgbPrefix}, 0)`);
      this.tipCtx.fillStyle = grad;
      this.tipCtx.fillRect(0, 0, dim, dim);

      this.strokeScratchCtx.drawImage(this.tipCanvas, pt.x - pad, pt.y - pad);
    }
  }

  private flushScratchToLayer(): void {
    const isWetBrush = !this.isErase && (this.brush.id === 'mix' || this.brush.id === 'blend');
    if (isWetBrush) return;

    this.layerCtx.putImageData(this.baseSnapshot, 0, 0);
    this.layerCtx.save();
    this.layerCtx.globalAlpha = clamp(this.brush.opacity, 0.01, 1);

    if (this.isErase) {
      this.layerCtx.globalCompositeOperation = 'destination-out';
    } else if (this.alphaLock) {
      this.layerCtx.globalCompositeOperation = 'source-atop';
    } else {
      this.layerCtx.globalCompositeOperation = 'source-over';
    }

    this.layerCtx.drawImage(this.strokeScratch, 0, 0);
    this.layerCtx.restore();
  }

  public addPoint(pt: StrokePoint): void {
    if (!this.lastPoint) {
      this.lastPoint = pt;
      this.remainder = 0;
      this.stampDab(pt);
      this.flushScratchToLayer();
      return;
    }

    const dx = pt.x - this.lastPoint.x;
    const dy = pt.y - this.lastPoint.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.25) return;

    const avgP = (this.lastPoint.pressure + pt.pressure) * 0.5;
    const effDiameter = Math.max(
      1.5,
      this.brush.size * (this.brush.pressureSize ? 0.2 + 0.8 * avgP : 1)
    );
    const step = Math.max(0.75, effDiameter * this.brush.spacing);

    let traveled = step - this.remainder;
    while (traveled <= dist) {
      const t = traveled / dist;
      this.stampDab({
        x: this.lastPoint.x + dx * t,
        y: this.lastPoint.y + dy * t,
        pressure: this.lastPoint.pressure + (pt.pressure - this.lastPoint.pressure) * t,
      });
      traveled += step;
    }

    this.remainder = dist - (traveled - step);
    this.lastPoint = pt;
    this.flushScratchToLayer();
  }
}
