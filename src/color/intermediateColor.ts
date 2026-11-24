import { RGBA, lerpRgba, rgbToHex } from './colorMath';

export type CornerTuple = [RGBA | null, RGBA | null, RGBA | null, RGBA | null]; // [TL, TR, BL, BR]

export interface IntermediateCell {
  row: number;
  col: number;
  cornerIndex: 0 | 1 | 2 | 3 | null;
  rgba: RGBA | null;
  hex: string | null;
}

/**
 * Generates CLIP STUDIO PAINT's Intermediate Color grid from up to 4 corner anchor colors.
 * Supports 4-corner bilinear interpolation, 2-corner linear gradients (horizontal/vertical/diagonal),
 * 3-corner weighted interpolation, or 1-corner fill.
 */
export function generateIntermediateGrid(
  corners: CornerTuple,
  gridSize: number = 7,
  mixSpace: 'rgb' | 'oklab' = 'rgb'
): IntermediateCell[][] {
  const n = Math.max(3, Math.min(13, Math.round(gridSize)));
  const [tl, tr, bl, br] = corners;
  const activeCount = corners.filter(Boolean).length;

  const rows: IntermediateCell[][] = [];

  for (let r = 0; r < n; r++) {
    const v = n === 1 ? 0 : r / (n - 1);
    const rowCells: IntermediateCell[] = [];

    for (let c = 0; c < n; c++) {
      const u = n === 1 ? 0 : c / (n - 1);

      let cornerIndex: 0 | 1 | 2 | 3 | null = null;
      if (r === 0 && c === 0) cornerIndex = 0;
      else if (r === 0 && c === n - 1) cornerIndex = 1;
      else if (r === n - 1 && c === 0) cornerIndex = 2;
      else if (r === n - 1 && c === n - 1) cornerIndex = 3;

      if (activeCount === 0) {
        rowCells.push({ row: r, col: c, cornerIndex, rgba: null, hex: null });
        continue;
      }

      let rgba: RGBA | null = null;

      if (tl && tr && bl && br) {
        const top = lerpRgba(tl, tr, u, mixSpace);
        const bottom = lerpRgba(bl, br, u, mixSpace);
        rgba = lerpRgba(top, bottom, v, mixSpace);
      } else if (tl && tr && !bl && !br) {
        rgba = lerpRgba(tl, tr, u, mixSpace);
      } else if (!tl && !tr && bl && br) {
        rgba = lerpRgba(bl, br, u, mixSpace);
      } else if (tl && !tr && bl && !br) {
        rgba = lerpRgba(tl, bl, v, mixSpace);
      } else if (!tl && tr && !bl && br) {
        rgba = lerpRgba(tr, br, v, mixSpace);
      } else if (tl && !tr && !bl && br) {
        rgba = lerpRgba(tl, br, (u + v) / 2, mixSpace);
      } else if (!tl && tr && bl && !br) {
        rgba = lerpRgba(tr, bl, (1 - u + v) / 2, mixSpace);
      } else {
        // General bilinear weight normalization for 1 or 3 active corners
        const candidates: Array<{ color: RGBA; weight: number }> = [];
        if (tl) candidates.push({ color: tl, weight: (1 - u) * (1 - v) });
        if (tr) candidates.push({ color: tr, weight: u * (1 - v) });
        if (bl) candidates.push({ color: bl, weight: (1 - u) * v });
        if (br) candidates.push({ color: br, weight: u * v });

        const totalWeight = candidates.reduce((acc, item) => acc + item.weight, 0);
        if (totalWeight <= 1e-6) {
          rgba = candidates[0].color;
        } else {
          let accum = candidates[0].color;
          let runningWeight = candidates[0].weight;
          for (let i = 1; i < candidates.length; i++) {
            const w = candidates[i].weight;
            const sum = runningWeight + w;
            if (sum > 1e-6) {
              accum = lerpRgba(accum, candidates[i].color, w / sum, mixSpace);
            }
            runningWeight = sum;
          }
          rgba = accum;
        }
      }

      rowCells.push({
        row: r,
        col: c,
        cornerIndex,
        rgba,
        hex: rgba ? rgbToHex(rgba.r, rgba.g, rgba.b) : null,
      });
    }
    rows.push(rowCells);
  }

  return rows;
}
