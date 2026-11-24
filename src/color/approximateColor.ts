import {
  ColorModel,
  RGBA,
  clamp,
  hlsToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHls,
  rgbToHsv,
  wrapHue,
} from './colorMath';

export type ApproximateAxis = 'H' | 'S' | 'V' | 'L' | 'R' | 'G' | 'B';

export const APPROXIMATE_AXIS_LABELS: Record<ApproximateAxis, string> = {
  H: '色相 (H)',
  S: '彩度 (S)',
  V: '明度 (V)',
  L: '輝度 (L)',
  R: '赤 (R)',
  G: '緑 (G)',
  B: '青 (B)',
};

export interface ApproximateCell {
  row: number;
  col: number;
  isCenter: boolean;
  rgba: RGBA;
  hex: string;
}

function applyAxisDelta(base: ColorModel, axis: ApproximateAxis, normalizedOffset: number): ColorModel {
  // normalizedOffset is in [-1, 1] * rangeRatio
  switch (axis) {
    case 'H': {
      const h = wrapHue(base.h + normalizedOffset * 180);
      const rgb = hsvToRgb(h, base.hsvS, base.hsvV);
      const hls = rgbToHls(rgb.r, rgb.g, rgb.b, h);
      return { ...base, ...rgb, h, hlsL: hls.l, hlsS: hls.s };
    }
    case 'S': {
      const hsvS = clamp(base.hsvS + normalizedOffset * 100, 0, 100);
      const rgb = hsvToRgb(base.h, hsvS, base.hsvV);
      const hls = rgbToHls(rgb.r, rgb.g, rgb.b, base.h);
      return { ...base, ...rgb, hsvS, hlsL: hls.l, hlsS: hls.s };
    }
    case 'V': {
      const hsvV = clamp(base.hsvV + normalizedOffset * 100, 0, 100);
      const rgb = hsvToRgb(base.h, base.hsvS, hsvV);
      const hls = rgbToHls(rgb.r, rgb.g, rgb.b, base.h);
      return { ...base, ...rgb, hsvV, hlsL: hls.l, hlsS: hls.s };
    }
    case 'L': {
      const hlsL = clamp(base.hlsL + normalizedOffset * 100, 0, 100);
      const rgb = hlsToRgb(base.h, hlsL, base.hlsS);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b, base.h);
      return { ...base, ...rgb, hlsL, hsvS: hsv.s, hsvV: hsv.v };
    }
    case 'R': {
      const r = clamp(Math.round(base.r + normalizedOffset * 255), 0, 255);
      const hsv = rgbToHsv(r, base.g, base.b, base.h);
      const hls = rgbToHls(r, base.g, base.b, hsv.h);
      return { ...base, r, h: hsv.h, hsvS: hsv.s, hsvV: hsv.v, hlsL: hls.l, hlsS: hls.s };
    }
    case 'G': {
      const g = clamp(Math.round(base.g + normalizedOffset * 255), 0, 255);
      const hsv = rgbToHsv(base.r, g, base.b, base.h);
      const hls = rgbToHls(base.r, g, base.b, hsv.h);
      return { ...base, g, h: hsv.h, hsvS: hsv.s, hsvV: hsv.v, hlsL: hls.l, hlsS: hls.s };
    }
    case 'B': {
      const b = clamp(Math.round(base.b + normalizedOffset * 255), 0, 255);
      const hsv = rgbToHsv(base.r, base.g, b, base.h);
      const hls = rgbToHls(base.r, base.g, b, hsv.h);
      return { ...base, b, h: hsv.h, hsvS: hsv.s, hsvV: hsv.v, hlsL: hls.l, hlsS: hls.s };
    }
  }
}

/**
 * Generates CLIP STUDIO PAINT's Approximate Color grid.
 * Center cell = base color; X-axis increases left->right; Y-axis increases bottom->top.
 * @param rangePercent 5..100 (how wide the total span across the grid is)
 * @param gridSize odd integer (5, 7, 9)
 */
export function generateApproximateGrid(
  base: ColorModel,
  xAxis: ApproximateAxis,
  yAxis: ApproximateAxis,
  rangePercent: number,
  gridSize: 5 | 7 | 9 = 7
): ApproximateCell[][] {
  const half = Math.floor(gridSize / 2);
  const span = clamp(rangePercent, 4, 100) / 100;
  const rows: ApproximateCell[][] = [];

  for (let r = 0; r < gridSize; r++) {
    const rowCells: ApproximateCell[] = [];
    // Upward row = positive delta (higher brightness/value at top, matching CSP)
    const yNorm = ((half - r) / half) * (span / 2);
    for (let c = 0; c < gridSize; c++) {
      const xNorm = ((c - half) / half) * (span / 2);
      const isCenter = r === half && c === half;
      const afterX = applyAxisDelta(base, xAxis, xNorm);
      const finalColor = isCenter ? base : applyAxisDelta(afterX, yAxis, yNorm);
      const rgba: RGBA = { r: finalColor.r, g: finalColor.g, b: finalColor.b, a: base.a };
      rowCells.push({
        row: r,
        col: c,
        isCenter,
        rgba,
        hex: rgbToHex(rgba.r, rgba.g, rgba.b),
      });
    }
    rows.push(rowCells);
  }

  return rows;
}
