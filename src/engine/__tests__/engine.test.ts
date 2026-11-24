import { describe, expect, it } from 'vitest';
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
    // Pixel 0: White (255,255,255,255), Pixel 1: Black (0,0,0,255), Pixel 2: 50% Gray (128,128,128,255)
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

    // White -> completely transparent
    expect(out.data[3]).toBe(0);

    // Black -> opaque black
    expect(out.data[4]).toBe(0);
    expect(out.data[5]).toBe(0);
    expect(out.data[6]).toBe(0);
    expect(out.data[7]).toBe(255);

    // Gray -> semi-transparent black (zero white halo!)
    expect(out.data[8]).toBe(0);
    expect(out.data[9]).toBe(0);
    expect(out.data[10]).toBe(0);
    expect(out.data[11]).toBeGreaterThan(120);
    expect(out.data[11]).toBeLessThan(135);
  });
});
