export interface RGBA {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
  a: number; // 0..1
}

export interface HSV {
  h: number; // 0..360
  s: number; // 0..100
  v: number; // 0..100
}

export interface HLS {
  h: number; // 0..360
  l: number; // 0..100
  s: number; // 0..100
}

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

/**
 * Rich color state that preserves Hue & Saturation even when Value=0 (black)
 * or Luminance=0/100 (black/white), matching CLIP STUDIO PAINT's color picker feel.
 */
export interface ColorModel {
  r: number;
  g: number;
  b: number;
  a: number;
  h: number; // 0..360
  hsvS: number; // 0..100
  hsvV: number; // 0..100
  hlsL: number; // 0..100
  hlsS: number; // 0..100
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function wrapHue(h: number): number {
  const mod = h % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function rgbToHsv(r: number, g: number, b: number, fallbackHue = 0): HSV {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = fallbackHue;
  if (d > 1e-6) {
    if (max === rn) {
      h = ((gn - bn) / d) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / d + 2) * 60;
    } else {
      h = ((rn - gn) / d + 4) * 60;
    }
    h = wrapHue(h);
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hn = wrapHue(h);
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;

  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hn < 60) {
    rp = c;
    gp = x;
  } else if (hn < 120) {
    rp = x;
    gp = c;
  } else if (hn < 180) {
    gp = c;
    bp = x;
  } else if (hn < 240) {
    gp = x;
    bp = c;
  } else if (hn < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function rgbToHls(r: number, g: number, b: number, fallbackHue = 0): HLS {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;

  let h = fallbackHue;
  let s = 0;

  if (d > 1e-6) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) {
      h = ((gn - bn) / d) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / d + 2) * 60;
    } else {
      h = ((rn - gn) / d + 4) * 60;
    }
    h = wrapHue(h);
  }

  return {
    h,
    l: l * 100,
    s: clamp(s * 100, 0, 100),
  };
}

export function hlsToRgb(h: number, l: number, s: number): { r: number; g: number; b: number } {
  const hn = wrapHue(h) / 360;
  const ln = clamp(l, 0, 100) / 100;
  const sn = clamp(s, 0, 100) / 100;

  if (sn === 0) {
    const gray = Math.round(ln * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, tInput: number): number => {
    let t = tInput;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

export function colorModelFromRgba(rgba: RGBA, prevHue = 0): ColorModel {
  const r = clamp(Math.round(rgba.r), 0, 255);
  const g = clamp(Math.round(rgba.g), 0, 255);
  const b = clamp(Math.round(rgba.b), 0, 255);
  const a = clamp(rgba.a, 0, 1);
  const hsv = rgbToHsv(r, g, b, prevHue);
  const hls = rgbToHls(r, g, b, hsv.h);
  return {
    r,
    g,
    b,
    a,
    h: hsv.h,
    hsvS: hsv.s,
    hsvV: hsv.v,
    hlsL: hls.l,
    hlsS: hls.s,
  };
}

export function colorModelFromHsv(h: number, s: number, v: number, a = 1): ColorModel {
  const hn = wrapHue(h);
  const sn = clamp(s, 0, 100);
  const vn = clamp(v, 0, 100);
  const rgb = hsvToRgb(hn, sn, vn);
  const hls = rgbToHls(rgb.r, rgb.g, rgb.b, hn);
  return {
    ...rgb,
    a: clamp(a, 0, 1),
    h: hn,
    hsvS: sn,
    hsvV: vn,
    hlsL: hls.l,
    hlsS: hls.s,
  };
}

export function colorModelFromHls(h: number, l: number, s: number, a = 1): ColorModel {
  const hn = wrapHue(h);
  const ln = clamp(l, 0, 100);
  const sn = clamp(s, 0, 100);
  const rgb = hlsToRgb(hn, ln, sn);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b, hn);
  return {
    ...rgb,
    a: clamp(a, 0, 1),
    h: hn,
    hsvS: hsv.s,
    hsvV: hsv.v,
    hlsL: ln,
    hlsS: sn,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgba(hex: string, alpha = 1): RGBA | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b, a: clamp(alpha, 0, 1) };
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b, a: clamp(alpha, 0, 1) };
  }
  if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    const a = parseInt(cleaned.slice(6, 8), 16) / 255;
    return { r, g, b, a: clamp(a, 0, 1) };
  }
  return null;
}

export function rgbaToCss(c: { r: number; g: number; b: number; a?: number }): string {
  const a = c.a ?? 1;
  if (a >= 0.999) {
    return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  }
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${a.toFixed(3)})`;
}

// Linear sRGB <-> Oklab for natural pigment-like intermediate mixing
function srgbToLinear(c: number): number {
  const v = clamp(c, 0, 255) / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const clamped = clamp(v, 0, 1);
  const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(clamp(s * 255, 0, 255));
}

export function rgbToOklab(r: number, g: number, b: number): Oklab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb(lab: Oklab): { r: number; g: number; b: number } {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
  };
}

export function lerpRgba(c1: RGBA, c2: RGBA, t: number, space: 'rgb' | 'oklab' = 'rgb'): RGBA {
  const tn = clamp(t, 0, 1);
  if (space === 'oklab') {
    const lab1 = rgbToOklab(c1.r, c1.g, c1.b);
    const lab2 = rgbToOklab(c2.r, c2.g, c2.b);
    const mixed = oklabToRgb({
      L: lab1.L + (lab2.L - lab1.L) * tn,
      a: lab1.a + (lab2.a - lab1.a) * tn,
      b: lab1.b + (lab2.b - lab1.b) * tn,
    });
    return {
      ...mixed,
      a: c1.a + (c2.a - c1.a) * tn,
    };
  }
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * tn),
    g: Math.round(c1.g + (c2.g - c1.g) * tn),
    b: Math.round(c1.b + (c2.b - c1.b) * tn),
    a: c1.a + (c2.a - c1.a) * tn,
  };
}
