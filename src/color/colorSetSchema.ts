import { clamp, hexToRgba, rgbToHex } from './colorMath';

export interface ColorSwatch {
  hex: string; // #RRGGBB
  alpha: number; // 0..1
  name?: string;
}

export interface ColorSet {
  id: string;
  name: string;
  favorite: boolean;
  columns: number; // e.g., 6, 8, 12, 16
  swatches: Array<ColorSwatch | null>; // null = transparent spacer cell like CSP
}

export interface ColorSetExportPayload {
  format: 'palette-studio-colorset';
  version: 1;
  exportedAt: string;
  sets: ColorSet[];
}

export interface ParseColorSetResult {
  ok: boolean;
  sets: ColorSet[];
  error?: string;
}

function makeId(): string {
  return `cset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSwatch(raw: unknown): ColorSwatch | null | 'invalid' {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw === 'string') {
    const parsed = hexToRgba(raw);
    if (!parsed) return 'invalid';
    return { hex: rgbToHex(parsed.r, parsed.g, parsed.b), alpha: parsed.a };
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.empty === true || obj.hex === null) {
      return null;
    }
    if (typeof obj.hex === 'string') {
      const parsed = hexToRgba(obj.hex);
      if (!parsed) return 'invalid';
      const alpha = typeof obj.alpha === 'number' ? clamp(obj.alpha, 0, 1) : parsed.a;
      const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : undefined;
      return {
        hex: rgbToHex(parsed.r, parsed.g, parsed.b),
        alpha,
        ...(name ? { name } : {}),
      };
    }
    if (typeof obj.r === 'number' && typeof obj.g === 'number' && typeof obj.b === 'number') {
      const alpha = typeof obj.a === 'number' ? clamp(obj.a, 0, 1) : 1;
      const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : undefined;
      return {
        hex: rgbToHex(obj.r, obj.g, obj.b),
        alpha,
        ...(name ? { name } : {}),
      };
    }
  }
  return 'invalid';
}

function normalizeColorSet(raw: unknown, fallbackIndex: number): ColorSet | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawList = Array.isArray(obj.swatches)
    ? obj.swatches
    : Array.isArray(obj.colors)
      ? obj.colors
      : null;
  if (!rawList) return null;

  const swatches: Array<ColorSwatch | null> = [];
  for (const item of rawList) {
    const norm = normalizeSwatch(item);
    if (norm === 'invalid') return null;
    swatches.push(norm);
  }

  const name =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim()
      : `インポートセット ${fallbackIndex + 1}`;
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : makeId();
  const favorite = typeof obj.favorite === 'boolean' ? obj.favorite : false;
  const columns =
    typeof obj.columns === 'number' && Number.isFinite(obj.columns)
      ? clamp(Math.round(obj.columns), 4, 16)
      : 8;

  return {
    id,
    name,
    favorite,
    columns,
    swatches,
  };
}

export function serializeColorSetsToJson(sets: ColorSet[]): string {
  const payload: ColorSetExportPayload = {
    format: 'palette-studio-colorset',
    version: 1,
    exportedAt: new Date().toISOString(),
    sets,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseColorSetsFromJson(jsonText: string): ParseColorSetResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      sets: [],
      error: 'JSONの構文が正しくありません。ファイル内容を確認してください。',
    };
  }

  // Case 1: Simple array of hex strings ["#FF0000", "#00FF00"]
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && (typeof parsed[0] === 'string' || parsed[0] === null)) {
      const single = normalizeColorSet({ name: 'インポートセット', swatches: parsed }, 0);
      if (!single) {
        return { ok: false, sets: [], error: '色コード配列に不正な値が含まれています。' };
      }
      return { ok: true, sets: [single] };
    }
    // Array of ColorSet objects
    const sets: ColorSet[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const cs = normalizeColorSet(parsed[i], i);
      if (!cs) {
        return { ok: false, sets: [], error: `${i + 1}番目のカラーセット定義が不正です。` };
      }
      sets.push(cs);
    }
    if (sets.length === 0) {
      return { ok: false, sets: [], error: 'インポートできるカラーセットが空です。' };
    }
    return { ok: true, sets };
  }

  // Case 2: Standard payload { format, version, sets: [...] } or single ColorSet object
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.sets)) {
      const sets: ColorSet[] = [];
      for (let i = 0; i < obj.sets.length; i++) {
        const cs = normalizeColorSet(obj.sets[i], i);
        if (!cs) {
          return {
            ok: false,
            sets: [],
            error: `カラーセット配列の ${i + 1} 番目に不正な色データが含まれています。`,
          };
        }
        sets.push(cs);
      }
      if (sets.length === 0) {
        return { ok: false, sets: [], error: 'カラーセットが1件も含まれていません。' };
      }
      return { ok: true, sets };
    }

    const single = normalizeColorSet(obj, 0);
    if (single) {
      return { ok: true, sets: [single] };
    }
  }

  return {
    ok: false,
    sets: [],
    error: '対応していないJSON形式です。Palette Studio形式のカラーセットJSONを指定してください。',
  };
}
