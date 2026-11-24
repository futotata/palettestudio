import { create } from 'zustand';
import {
  ColorModel,
  RGBA,
  clamp,
  colorModelFromHls,
  colorModelFromHsv,
  colorModelFromRgba,
  hexToRgba,
  rgbToHex,
} from '../color/colorMath';
import { ApproximateAxis } from '../color/approximateColor';
import { CornerTuple } from '../color/intermediateColor';
import { ColorSet, ColorSwatch } from '../color/colorSetSchema';
import { DEFAULT_COLOR_SETS } from '../color/defaultColorSets';
import { loadPersisted, savePersistedDebounced } from './persistence';

export type ActiveColorSlot = 'main' | 'sub' | 'transparent';
export type WheelSpaceMode = 'hsv-square' | 'hls-triangle';
export type SliderGroupMode = 'rgb' | 'hsv' | 'hls';

interface PersistedColorData {
  mainColor: ColorModel;
  subColor: ColorModel;
  wheelMode: WheelSpaceMode;
  sliderMode: SliderGroupMode;
  colorSets: ColorSet[];
  activeColorSetId: string;
  approxXAxis: ApproximateAxis;
  approxYAxis: ApproximateAxis;
  approxRange: number;
  approxGridSize: 5 | 7 | 9;
  intermediateCorners: CornerTuple;
  intermediateGridSize: number;
  intermediateMixSpace: 'rgb' | 'oklab';
  colorHistory: ColorSwatch[];
}

const STORAGE_KEY = 'palette-studio:color-v1';

const INITIAL_MAIN = colorModelFromRgba({ r: 247, g: 206, b: 182, a: 1 }); // 標準肌ベース #F7CEB6
const INITIAL_SUB = colorModelFromRgba({ r: 196, g: 126, b: 106, a: 1 }); // 肌影 #C47E6A

const INITIAL_CORNERS: CornerTuple = [
  { r: 255, g: 240, b: 230, a: 1 }, // TL: 明部ハイライト
  { r: 245, g: 155, b: 144, a: 1 }, // TR: 血色チーク
  { r: 155, g: 192, b: 217, a: 1 }, // BL: 空反射光
  { r: 135, g: 78, b: 58, a: 1 },   // BR: 深影
];

export interface ColorStoreState extends PersistedColorData {
  activeSlot: ActiveColorSlot;
  lastOpaqueSlot: 'main' | 'sub';
  selectedSwatchIndex: number | null;
  approxPinned: boolean;
  approxLockedBase: ColorModel | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  getActiveColorModel: () => ColorModel;

  setActiveSlot: (slot: ActiveColorSlot) => void;
  swapMainAndSub: () => void;

  setColorFromRgba: (rgba: RGBA) => void;
  setColorFromHsv: (h: number, s: number, v: number) => void;
  setColorFromHls: (h: number, l: number, s: number) => void;
  setColorFromHex: (hex: string) => boolean;

  setWheelMode: (mode: WheelSpaceMode) => void;
  setSliderMode: (mode: SliderGroupMode) => void;

  // Color Set actions
  selectColorSet: (id: string) => void;
  setSelectedSwatchIndex: (idx: number | null) => void;
  toggleFavoriteColorSet: (id: string) => void;
  createColorSet: (name: string) => string;
  duplicateColorSet: (id: string) => void;
  renameColorSet: (id: string, name: string) => void;
  deleteColorSet: (id: string) => void;
  setColorSetColumns: (id: string, columns: number) => void;
  addCurrentColorToSet: () => void;
  replaceSwatchWithCurrent: (index: number) => void;
  addSpacerToSet: () => void;
  removeSwatchFromSet: (index: number) => void;
  renameSwatchInSet: (index: number, name: string) => void;
  importColorSets: (sets: ColorSet[], mode: 'append' | 'overwrite') => void;
  resetPresetColorSets: () => void;

  // Approximate Color actions
  setApproxAxes: (xAxis: ApproximateAxis, yAxis: ApproximateAxis) => void;
  setApproxRange: (range: number) => void;
  setApproxGridSize: (size: 5 | 7 | 9) => void;
  toggleApproxPin: () => void;

  // Intermediate Color actions
  setIntermediateCornerToCurrent: (cornerIdx: 0 | 1 | 2 | 3) => void;
  clearIntermediateCorner: (cornerIdx: 0 | 1 | 2 | 3) => void;
  setIntermediateGridSize: (size: number) => void;
  setIntermediateMixSpace: (space: 'rgb' | 'oklab') => void;

  // Color History actions
  recordStrokeColorUsed: () => void;
  clearColorHistory: () => void;
}

function persistSlice(state: ColorStoreState): void {
  const data: PersistedColorData = {
    mainColor: state.mainColor,
    subColor: state.subColor,
    wheelMode: state.wheelMode,
    sliderMode: state.sliderMode,
    colorSets: state.colorSets,
    activeColorSetId: state.activeColorSetId,
    approxXAxis: state.approxXAxis,
    approxYAxis: state.approxYAxis,
    approxRange: state.approxRange,
    approxGridSize: state.approxGridSize,
    intermediateCorners: state.intermediateCorners,
    intermediateGridSize: state.intermediateGridSize,
    intermediateMixSpace: state.intermediateMixSpace,
    colorHistory: state.colorHistory,
  };
  savePersistedDebounced(STORAGE_KEY, data);
}

export const useColorStore = create<ColorStoreState>((set, get) => {
  const applyModelToSlot = (nextModel: ColorModel) => {
    set((s) => {
      // Picking any opaque color while Transparent is active returns to lastOpaqueSlot (CSP behavior)
      const targetSlot = s.activeSlot === 'transparent' ? s.lastOpaqueSlot : s.activeSlot;
      const updated =
        targetSlot === 'main'
          ? { mainColor: nextModel, activeSlot: 'main' as const, lastOpaqueSlot: 'main' as const }
          : { subColor: nextModel, activeSlot: 'sub' as const, lastOpaqueSlot: 'sub' as const };
      const merged = { ...s, ...updated };
      persistSlice(merged);
      return updated;
    });
  };

  return {
    mainColor: INITIAL_MAIN,
    subColor: INITIAL_SUB,
    activeSlot: 'main',
    lastOpaqueSlot: 'main',
    wheelMode: 'hsv-square',
    sliderMode: 'hsv',
    colorSets: DEFAULT_COLOR_SETS,
    activeColorSetId: DEFAULT_COLOR_SETS[0].id,
    selectedSwatchIndex: null,

    approxXAxis: 'S',
    approxYAxis: 'V',
    approxRange: 38,
    approxGridSize: 7,
    approxPinned: false,
    approxLockedBase: null,

    intermediateCorners: INITIAL_CORNERS,
    intermediateGridSize: 7,
    intermediateMixSpace: 'oklab',

    colorHistory: [
      { hex: '#F7CEB6', alpha: 1, name: '標準 ベース' },
      { hex: '#E5A68A', alpha: 1, name: '標準 1影' },
      { hex: '#C47E6A', alpha: 1, name: '標準 2影' },
      { hex: '#9E7382', alpha: 1, name: '回り込み影' },
      { hex: '#FFE8D6', alpha: 1, name: 'ハイライト' },
    ],
    hydrated: false,

    hydrate: async () => {
      const saved = await loadPersisted<Partial<PersistedColorData>>(STORAGE_KEY);
      if (saved) {
        set((s) => ({
          ...s,
          ...saved,
          colorSets:
            Array.isArray(saved.colorSets) && saved.colorSets.length > 0
              ? saved.colorSets
              : s.colorSets,
          activeColorSetId:
            saved.activeColorSetId &&
            saved.colorSets?.some((cs) => cs.id === saved.activeColorSetId)
              ? saved.activeColorSetId
              : saved.colorSets?.[0]?.id ?? s.activeColorSetId,
          hydrated: true,
        }));
      } else {
        set({ hydrated: true });
      }
    },

    getActiveColorModel: () => {
      const s = get();
      const slot = s.activeSlot === 'transparent' ? s.lastOpaqueSlot : s.activeSlot;
      return slot === 'main' ? s.mainColor : s.subColor;
    },

    setActiveSlot: (slot) =>
      set((s) => ({
        activeSlot: slot,
        lastOpaqueSlot: slot === 'transparent' ? s.lastOpaqueSlot : slot,
      })),

    swapMainAndSub: () =>
      set((s) => {
        const next = {
          ...s,
          mainColor: s.subColor,
          subColor: s.mainColor,
          activeSlot: s.activeSlot === 'transparent' ? s.lastOpaqueSlot : s.activeSlot,
        };
        persistSlice(next);
        return {
          mainColor: next.mainColor,
          subColor: next.subColor,
          activeSlot: next.activeSlot,
        };
      }),

    setColorFromRgba: (rgba) => {
      const cur = get().getActiveColorModel();
      applyModelToSlot(colorModelFromRgba(rgba, cur.h));
    },

    setColorFromHsv: (h, s, v) => {
      const cur = get().getActiveColorModel();
      applyModelToSlot(colorModelFromHsv(h, s, v, cur.a));
    },

    setColorFromHls: (h, l, s) => {
      const cur = get().getActiveColorModel();
      applyModelToSlot(colorModelFromHls(h, l, s, cur.a));
    },

    setColorFromHex: (hex) => {
      const rgba = hexToRgba(hex);
      if (!rgba) return false;
      const cur = get().getActiveColorModel();
      applyModelToSlot(colorModelFromRgba(rgba, cur.h));
      return true;
    },

    setWheelMode: (wheelMode) =>
      set((s) => {
        const next = { ...s, wheelMode };
        persistSlice(next);
        return { wheelMode };
      }),

    setSliderMode: (sliderMode) =>
      set((s) => {
        const next = { ...s, sliderMode };
        persistSlice(next);
        return { sliderMode };
      }),

    selectColorSet: (id) =>
      set((s) => {
        const next = { ...s, activeColorSetId: id, selectedSwatchIndex: null };
        persistSlice(next);
        return { activeColorSetId: id, selectedSwatchIndex: null };
      }),

    setSelectedSwatchIndex: (idx) => set({ selectedSwatchIndex: idx }),

    toggleFavoriteColorSet: (id) =>
      set((s) => {
        const colorSets = s.colorSets.map((cs) =>
          cs.id === id ? { ...cs, favorite: !cs.favorite } : cs
        );
        const next = { ...s, colorSets };
        persistSlice(next);
        return { colorSets };
      }),

    createColorSet: (name) => {
      const id = `cset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const trimmed = name.trim() || 'マイカラーセット';
      const newSet: ColorSet = {
        id,
        name: trimmed,
        favorite: true,
        columns: 8,
        swatches: [],
      };
      set((s) => {
        const colorSets = [newSet, ...s.colorSets];
        const next = { ...s, colorSets, activeColorSetId: id, selectedSwatchIndex: null };
        persistSlice(next);
        return { colorSets, activeColorSetId: id, selectedSwatchIndex: null };
      });
      return id;
    },

    duplicateColorSet: (id) =>
      set((s) => {
        const target = s.colorSets.find((cs) => cs.id === id);
        if (!target) return {};
        const newId = `cset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const copy: ColorSet = {
          ...target,
          id: newId,
          name: `${target.name} (コピー)`,
          swatches: target.swatches.map((sw) => (sw ? { ...sw } : null)),
        };
        const idx = s.colorSets.findIndex((cs) => cs.id === id);
        const colorSets = [...s.colorSets];
        colorSets.splice(idx + 1, 0, copy);
        const next = { ...s, colorSets, activeColorSetId: newId, selectedSwatchIndex: null };
        persistSlice(next);
        return { colorSets, activeColorSetId: newId, selectedSwatchIndex: null };
      }),

    renameColorSet: (id, name) =>
      set((s) => {
        const trimmed = name.trim();
        if (!trimmed) return {};
        const colorSets = s.colorSets.map((cs) => (cs.id === id ? { ...cs, name: trimmed } : cs));
        const next = { ...s, colorSets };
        persistSlice(next);
        return { colorSets };
      }),

    deleteColorSet: (id) =>
      set((s) => {
        if (s.colorSets.length <= 1) return {};
        const colorSets = s.colorSets.filter((cs) => cs.id !== id);
        const activeColorSetId =
          s.activeColorSetId === id ? colorSets[0].id : s.activeColorSetId;
        const next = { ...s, colorSets, activeColorSetId, selectedSwatchIndex: null };
        persistSlice(next);
        return { colorSets, activeColorSetId, selectedSwatchIndex: null };
      }),

    setColorSetColumns: (id, columns) =>
      set((s) => {
        const cols = clamp(Math.round(columns), 4, 16);
        const colorSets = s.colorSets.map((cs) => (cs.id === id ? { ...cs, columns: cols } : cs));
        const next = { ...s, colorSets };
        persistSlice(next);
        return { colorSets };
      }),

    addCurrentColorToSet: () =>
      set((s) => {
        const c = s.getActiveColorModel();
        const swatch: ColorSwatch = { hex: rgbToHex(c.r, c.g, c.b), alpha: c.a };
        const colorSets = s.colorSets.map((cs) => {
          if (cs.id !== s.activeColorSetId) return cs;
          return { ...cs, swatches: [...cs.swatches, swatch] };
        });
        const next = { ...s, colorSets };
        persistSlice(next);
        return { colorSets };
      }),

    replaceSwatchWithCurrent: (index) =>
      set((s) => {
        const c = s.getActiveColorModel();
        const colorSets = s.colorSets.map((cs) => {
          if (cs.id !== s.activeColorSetId) return cs;
          const swatches = [...cs.swatches];
          const prevName = swatches[index]?.name;
          swatches[index] = {
            hex: rgbToHex(c.r, c.g, c.b),
            alpha: c.a,
            ...(prevName ? { name: prevName } : {}),
          };
          return { ...cs, swatches };
        });
        const next = { ...s, colorSets };
        persistSlice(next);
        return { colorSets };
      }),

    addSpacerToSet: () =>
      set((s) => {
        const colorSets = s.colorSets.map((cs) =>
          cs.id === s.activeColorSetId ? { ...cs, swatches: [...cs.swatches, null] } : cs
        );
        const next = { ...s, colorSets };
        persistSlice(next);
        return { colorSets };
      }),

    removeSwatchFromSet: (index) =>
      set((s) => {
        const colorSets = s.colorSets.map((cs) => {
          if (cs.id !== s.activeColorSetId) return cs;
          const swatches = cs.swatches.filter((_, i) => i !== index);
          return { ...cs, swatches };
        });
        const next = { ...s, colorSets, selectedSwatchIndex: null };
        persistSlice(next);
        return { colorSets, selectedSwatchIndex: null };
      }),

    renameSwatchInSet: (index, name) =>
      set((s) => {
        const colorSets = s.colorSets.map((cs) => {
          if (cs.id !== s.activeColorSetId) return cs;
          const swatches = [...cs.swatches];
          const cur = swatches[index];
          if (!cur) return cs;
          const trimmed = name.trim();
          swatches[index] = trimmed ? { ...cur, name: trimmed } : { hex: cur.hex, alpha: cur.alpha };
          return { ...cs, swatches };
        });
        const next = { ...s, colorSets };
        persistSlice(next);
        return { colorSets };
      }),

    importColorSets: (incoming, mode) =>
      set((s) => {
        if (incoming.length === 0) return {};
        let colorSets = [...s.colorSets];

        if (mode === 'overwrite') {
          for (const item of incoming) {
            const existingIdx = colorSets.findIndex(
              (cs) => cs.id === item.id || cs.name === item.name
            );
            if (existingIdx >= 0) {
              colorSets[existingIdx] = { ...item, id: colorSets[existingIdx].id };
            } else {
              colorSets.push({
                ...item,
                id: `cset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              });
            }
          }
        } else {
          const withFreshIds = incoming.map((item) => ({
            ...item,
            id: `cset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          }));
          colorSets = [...withFreshIds, ...colorSets];
        }

        const activeColorSetId = incoming[0]
          ? colorSets.find((cs) => cs.name === incoming[0].name)?.id ?? colorSets[0].id
          : s.activeColorSetId;

        const next = { ...s, colorSets, activeColorSetId, selectedSwatchIndex: null };
        persistSlice(next);
        return { colorSets, activeColorSetId, selectedSwatchIndex: null };
      }),

    resetPresetColorSets: () =>
      set((s) => {
        const customOnly = s.colorSets.filter(
          (cs) => !DEFAULT_COLOR_SETS.some((def) => def.id === cs.id)
        );
        const colorSets = [...DEFAULT_COLOR_SETS, ...customOnly];
        const next = { ...s, colorSets, activeColorSetId: DEFAULT_COLOR_SETS[0].id };
        persistSlice(next);
        return { colorSets, activeColorSetId: DEFAULT_COLOR_SETS[0].id };
      }),

    setApproxAxes: (approxXAxis, approxYAxis) =>
      set((s) => {
        const next = { ...s, approxXAxis, approxYAxis };
        persistSlice(next);
        return { approxXAxis, approxYAxis };
      }),

    setApproxRange: (approxRange) =>
      set((s) => {
        const clamped = clamp(approxRange, 5, 100);
        const next = { ...s, approxRange: clamped };
        persistSlice(next);
        return { approxRange: clamped };
      }),

    setApproxGridSize: (approxGridSize) =>
      set((s) => {
        const next = { ...s, approxGridSize };
        persistSlice(next);
        return { approxGridSize };
      }),

    toggleApproxPin: () =>
      set((s) => {
        if (s.approxPinned) {
          return { approxPinned: false, approxLockedBase: null };
        }
        return { approxPinned: true, approxLockedBase: s.getActiveColorModel() };
      }),

    setIntermediateCornerToCurrent: (cornerIdx) =>
      set((s) => {
        const c = s.getActiveColorModel();
        const intermediateCorners: CornerTuple = [...s.intermediateCorners] as CornerTuple;
        intermediateCorners[cornerIdx] = { r: c.r, g: c.g, b: c.b, a: c.a };
        const next = { ...s, intermediateCorners };
        persistSlice(next);
        return { intermediateCorners };
      }),

    clearIntermediateCorner: (cornerIdx) =>
      set((s) => {
        const intermediateCorners: CornerTuple = [...s.intermediateCorners] as CornerTuple;
        intermediateCorners[cornerIdx] = null;
        const next = { ...s, intermediateCorners };
        persistSlice(next);
        return { intermediateCorners };
      }),

    setIntermediateGridSize: (size) =>
      set((s) => {
        const intermediateGridSize = clamp(Math.round(size), 4, 12);
        const next = { ...s, intermediateGridSize };
        persistSlice(next);
        return { intermediateGridSize };
      }),

    setIntermediateMixSpace: (intermediateMixSpace) =>
      set((s) => {
        const next = { ...s, intermediateMixSpace };
        persistSlice(next);
        return { intermediateMixSpace };
      }),

    recordStrokeColorUsed: () =>
      set((s) => {
        if (s.activeSlot === 'transparent') return {};
        const c = s.getActiveColorModel();
        const hex = rgbToHex(c.r, c.g, c.b);
        const filtered = s.colorHistory.filter((item) => item.hex !== hex);
        const colorHistory = [{ hex, alpha: c.a }, ...filtered].slice(0, 96);
        const next = { ...s, colorHistory };
        persistSlice(next);
        return { colorHistory };
      }),

    clearColorHistory: () =>
      set((s) => {
        const next = { ...s, colorHistory: [] };
        persistSlice(next);
        return { colorHistory: [] };
      }),
  };
});
