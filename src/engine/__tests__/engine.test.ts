import { describe, expect, it } from 'vitest';
import { clampDirtyRect, unionDirtyRect } from '../gpuReadback';
import { convertBrightnessToOpacityData } from '../lineArtProcessor';

function makeImageData(pixels: number[], width: number, height: number): ImageData {
  return {
    data: new Uint8ClampedArray(pixels),
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('lineArtProcessor - convertBrightnessToOpacityData', () => {
  it('converts pure white background to alpha=0 and pure black lines to opaque black', () => {
    const img = makeImageData(
      [
        255, 255, 255, 255,
        0, 0, 0, 255,
        128, 128, 128, 255,
      ],
      3,
      1
    );

    const out = convertBrightnessToOpacityData(img);

    expect(out.data[3]).toBe(0);

    expect(out.data[4]).toBe(0);
    expect(out.data[5]).toBe(0);
    expect(out.data[6]).toBe(0);
    expect(out.data[7]).toBe(255);

    expect(out.data[8]).toBe(0);
    expect(out.data[9]).toBe(0);
    expect(out.data[10]).toBe(0);
    expect(out.data[11]).toBeGreaterThan(120);
    expect(out.data[11]).toBeLessThan(135);
  });
});

describe('gpuReadback DirtyRect math', () => {
  it('unions and clamps dirty rectangles accurately to canvas bounds', () => {
    const u = unionDirtyRect({ x: 10.4, y: 20.2, w: 15, h: 12 }, { x: -5, y: 25, w: 20, h: 30 });
    expect(u).not.toBeNull();
    const clamped = clampDirtyRect(u!, 1440, 1080);
    expect(clamped).toEqual({ x: 0, y: 20, w: 26, h: 35 });

    // Completely out-of-bounds rectangle returns null
    expect(clampDirtyRect({ x: -50, y: -50, w: 20, h: 20 }, 1440, 1080)).toBeNull();
  });
});
