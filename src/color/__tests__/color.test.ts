import { describe, expect, it } from 'vitest';
import {
  colorModelFromHls,
  colorModelFromHsv,
  colorModelFromRgba,
  hexToRgba,
  hlsToRgb,
  hsvToRgb,
  lerpRgba,
  oklabToRgb,
  rgbToHex,
  rgbToHls,
  rgbToHsv,
  rgbToOklab,
} from '../colorMath';
import { generateApproximateGrid } from '../approximateColor';
import { generateIntermediateGrid } from '../intermediateColor';
import { parseColorSetsFromJson, serializeColorSetsToJson } from '../colorSetSchema';
import { DEFAULT_COLOR_SETS } from '../defaultColorSets';

describe('colorMath', () => {
  it('converts RGB <-> HSV accurately across primaries and midtones', () => {
    const samples = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 128 },
      { r: 64, g: 128, b: 220 },
      { r: 245, g: 210, b: 195 },
    ];
    for (const s of samples) {
      const hsv = rgbToHsv(s.r, s.g, s.b);
      const back = hsvToRgb(hsv.h, hsv.s, hsv.v);
      expect(Math.abs(back.r - s.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - s.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - s.b)).toBeLessThanOrEqual(1);
    }
  });

  it('converts RGB <-> HLS accurately and preserves Hue on black/white in ColorModel', () => {
    const hls = rgbToHls(210, 95, 140);
    const back = hlsToRgb(hls.h, hls.l, hls.s);
    expect(Math.abs(back.r - 210)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.g - 95)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.b - 140)).toBeLessThanOrEqual(1);

    const blackKeepHue = colorModelFromHsv(215, 70, 0);
    expect(blackKeepHue.r).toBe(0);
    expect(blackKeepHue.h).toBe(215);
    expect(blackKeepHue.hsvS).toBe(70);

    const whiteKeepHue = colorModelFromHls(145, 100, 60);
    expect(whiteKeepHue.r).toBe(255);
    expect(whiteKeepHue.h).toBe(145);
    expect(whiteKeepHue.hlsS).toBe(60);
  });

  it('round-trips Oklab and supports perceptual mixing', () => {
    const lab = rgbToOklab(240, 180, 60);
    const rgb = oklabToRgb(lab);
    expect(Math.abs(rgb.r - 240)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - 180)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - 60)).toBeLessThanOrEqual(1);

    const mid = lerpRgba({ r: 255, g: 220, b: 0, a: 1 }, { r: 0, g: 90, b: 255, a: 1 }, 0.5, 'oklab');
    expect(mid.g).toBeGreaterThan(120);
  });

  it('parses and formats HEX strings', () => {
    expect(rgbToHex(251, 227, 216)).toBe('#FBE3D8');
    expect(hexToRgba('#fbe3d8')).toEqual({ r: 251, g: 227, b: 216, a: 1 });
    expect(hexToRgba('#f0a')).toEqual({ r: 255, g: 0, b: 170, a: 1 });
    expect(hexToRgba('invalid')).toBeNull();
  });
});

describe('approximateColor & intermediateColor', () => {
  it('places base color at center and varies chosen axes', () => {
    const base = colorModelFromRgba({ r: 200, g: 120, b: 100, a: 1 });
    const grid = generateApproximateGrid(base, 'H', 'V', 40, 5);
    expect(grid).toHaveLength(5);
    expect(grid[2][2].isCenter).toBe(true);
    expect(grid[2][2].hex).toBe(rgbToHex(200, 120, 100));
    // Top row has higher Value than bottom row
    const topV = rgbToHsv(grid[0][2].rgba.r, grid[0][2].rgba.g, grid[0][2].rgba.b).v;
    const botV = rgbToHsv(grid[4][2].rgba.r, grid[4][2].rgba.g, grid[4][2].rgba.b).v;
    expect(topV).toBeGreaterThan(botV);
  });

  it('interpolates 4 corners bilinearly in Intermediate Color grid', () => {
    const tl = { r: 255, g: 0, b: 0, a: 1 };
    const tr = { r: 0, g: 255, b: 0, a: 1 };
    const bl = { r: 0, g: 0, b: 255, a: 1 };
    const br = { r: 255, g: 255, b: 255, a: 1 };
    const grid = generateIntermediateGrid([tl, tr, bl, br], 5, 'rgb');
    expect(grid[0][0].hex).toBe('#FF0000');
    expect(grid[0][4].hex).toBe('#00FF00');
    expect(grid[4][0].hex).toBe('#0000FF');
    expect(grid[4][4].hex).toBe('#FFFFFF');
    // Center is average of all 4 corners: (128, 128, 128)
    expect(grid[2][2].rgba?.r).toBeCloseTo(128, -1);
  });
});

describe('colorSetSchema JSON import/export', () => {
  it('serializes and parses ColorSets preserving favorites, names, and null spacer cells', () => {
    const json = serializeColorSetsToJson(DEFAULT_COLOR_SETS);
    const res = parseColorSetsFromJson(json);
    expect(res.ok).toBe(true);
    expect(res.sets).toHaveLength(DEFAULT_COLOR_SETS.length);
    expect(res.sets[0].favorite).toBe(true);
    expect(res.sets[0].swatches).toContain(null);
    expect(res.sets[0].swatches[0]?.name).toBe('美白 ハイライト');
  });

  it('rejects malformed JSON cleanly', () => {
    const res = parseColorSetsFromJson('{ broken json');
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
