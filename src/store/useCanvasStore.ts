import { create } from 'zustand';
import { clamp } from '../color/colorMath';
import {
  AnyBrushId,
  BrushId,
  BrushSettings,
  DEFAULT_BRUSH_PRESETS,
  EraserId,
} from '../engine/brushEngine';
import { LayerBlendMode, LayerItem, compositeLayers } from '../engine/compositor';
import {
  CanvasHistoryEntry,
  captureLayersSnapshot,
  restoreLayersFromSnapshot,
} from '../engine/historyManager';
import {
  SampleTemplateId,
  convertCanvasBrightnessToOpacity,
  drawSampleLineArt,
} from '../engine/lineArtProcessor';

export type ToolType = 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'pan';
export type FillReferMode = 'reference' | 'all' | 'active';

const MAX_UNDO_STEPS = 25;

function createBlankCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function makeLayerId(): string {
  return `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialPracticeLayers(
  width: number,
  height: number,
  template: SampleTemplateId | null = 'character-bust'
): { layers: LayerItem[]; activeLayerId: string } {
  const baseLayer: LayerItem = {
    id: makeLayerId(),
    name: '下塗りベース',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    clipped: false,
    alphaLock: false,
    isReference: false,
    canvas: createBlankCanvas(width, height),
  };

  const shadowLayer: LayerItem = {
    id: makeLayerId(),
    name: '1影 (クリッピング・乗算)',
    visible: true,
    opacity: 1,
    blendMode: 'multiply',
    clipped: true,
    alphaLock: false,
    isReference: false,
    canvas: createBlankCanvas(width, height),
  };

  const lineArtCanvas = createBlankCanvas(width, height);
  if (template) {
    drawSampleLineArt(lineArtCanvas, template);
  }

  const lineLayer: LayerItem = {
    id: makeLayerId(),
    name: '線画 (参照レイヤー)',
    visible: true,
    opacity: 1,
    blendMode: 'multiply',
    clipped: false,
    alphaLock: false,
    isReference: true,
    canvas: lineArtCanvas,
  };

  return {
    layers: [baseLayer, shadowLayer, lineLayer],
    activeLayerId: baseLayer.id,
  };
}

export interface CanvasStoreState {
  width: number;
  height: number;
  paperColor: string;

  zoom: number;
  panX: number;
  panY: number;
  rotationDeg: number;
  flipViewX: boolean;

  activeTool: ToolType;
  thumbEyedropperHeld: boolean;
  activeBrushId: BrushId;
  activeEraserId: EraserId;
  brushPresets: Record<AnyBrushId, BrushSettings>;

  fillReferMode: FillReferMode;
  fillTolerance: number;
  fillExpandPx: number;

  layers: LayerItem[];
  activeLayerId: string;
  compositeVersion: number;

  past: CanvasHistoryEntry[];
  future: CanvasHistoryEntry[];

  initDefaultDocument: (template?: SampleTemplateId | null, width?: number, height?: number) => void;
  bumpComposite: () => void;

  // Viewport transforms
  setViewportTransform: (zoom: number, panX: number, panY: number, rotationDeg?: number) => void;
  fitViewport: (viewportW: number, viewportH: number) => void;
  resetRotation: () => void;
  toggleFlipViewX: () => void;

  // Tool & Brush controls
  setActiveTool: (tool: ToolType) => void;
  setThumbEyedropperHeld: (held: boolean) => void;
  getEffectiveTool: () => ToolType;
  selectBrush: (id: BrushId) => void;
  selectEraser: (id: EraserId) => void;
  getCurrentStrokeBrush: () => BrushSettings;
  updateCurrentBrushSetting: <K extends keyof BrushSettings>(key: K, value: BrushSettings[K]) => void;

  setFillReferMode: (mode: FillReferMode) => void;
  setFillTolerance: (tol: number) => void;
  setFillExpandPx: (px: number) => void;

  // Undo / Redo
  pushHistoryBeforeChange: () => void;
  pushPreCapturedEntry: (entry: CanvasHistoryEntry) => void;
  undo: () => void;
  redo: () => void;

  // Layer operations
  selectLayer: (id: string) => void;
  addLayer: (opts?: { name?: string; clipped?: boolean; blendMode?: LayerBlendMode }) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  clearLayer: (id: string) => void;
  mergeLayerDown: (id: string) => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  renameLayer: (id: string, name: string) => void;
  toggleLayerVisible: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setLayerBlendMode: (id: string, blendMode: LayerBlendMode) => void;
  toggleLayerClipped: (id: string) => void;
  toggleLayerAlphaLock: (id: string) => void;
  toggleLayerReference: (id: string) => void;

  // Line-art & Export utilities
  convertActiveLayerBrightnessToOpacity: () => void;
  importLineArtImage: (
    file: File,
    options: { convertWhiteToTransparent: boolean; setAsReference: boolean }
  ) => Promise<void>;
  exportPngDataUrl: () => string;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => {
  const initialW = 1440;
  const initialH = 1080;
  const initialDoc =
    typeof document !== 'undefined'
      ? createInitialPracticeLayers(initialW, initialH, 'character-bust')
      : { layers: [], activeLayerId: '' };

  return {
    width: initialW,
    height: initialH,
    paperColor: '#ffffff',

    zoom: 0.68,
    panX: 0,
    panY: 0,
    rotationDeg: 0,
    flipViewX: false,

    activeTool: 'brush',
    thumbEyedropperHeld: false,
    activeBrushId: 'gpen',
    activeEraserId: 'eraser-hard',
    brushPresets: structuredClone(DEFAULT_BRUSH_PRESETS),

    fillReferMode: 'reference',
    fillTolerance: 24,
    fillExpandPx: 1,

    layers: initialDoc.layers,
    activeLayerId: initialDoc.activeLayerId,
    compositeVersion: 1,

    past: [],
    future: [],

    initDefaultDocument: (template = 'character-bust', width = 1440, height = 1080) => {
      const doc = createInitialPracticeLayers(width, height, template);
      set((s) => ({
        width,
        height,
        layers: doc.layers,
        activeLayerId: doc.activeLayerId,
        past: [],
        future: [],
        rotationDeg: 0,
        flipViewX: false,
        compositeVersion: s.compositeVersion + 1,
      }));
    },

    bumpComposite: () => set((s) => ({ compositeVersion: s.compositeVersion + 1 })),

    setViewportTransform: (zoom, panX, panY, rotationDeg) =>
      set((s) => ({
        zoom: clamp(zoom, 0.12, 8),
        panX,
        panY,
        rotationDeg: rotationDeg !== undefined ? rotationDeg : s.rotationDeg,
      })),

    fitViewport: (viewportW, viewportH) =>
      set((s) => {
        if (viewportW <= 0 || viewportH <= 0) return {};
        const scale = Math.min((viewportW * 0.86) / s.width, (viewportH * 0.86) / s.height, 1.5);
        return {
          zoom: clamp(scale, 0.15, 4),
          panX: 0,
          panY: 0,
          rotationDeg: 0,
        };
      }),

    resetRotation: () => set({ rotationDeg: 0 }),

    toggleFlipViewX: () => set((s) => ({ flipViewX: !s.flipViewX })),

    setActiveTool: (activeTool) => set({ activeTool }),

    setThumbEyedropperHeld: (thumbEyedropperHeld) => set({ thumbEyedropperHeld }),

    getEffectiveTool: () => {
      const s = get();
      if (s.thumbEyedropperHeld) return 'eyedropper';
      return s.activeTool;
    },

    selectBrush: (activeBrushId) => set({ activeBrushId, activeTool: 'brush' }),

    selectEraser: (activeEraserId) => set({ activeEraserId, activeTool: 'eraser' }),

    getCurrentStrokeBrush: () => {
      const s = get();
      const id: AnyBrushId = s.activeTool === 'eraser' ? s.activeEraserId : s.activeBrushId;
      return s.brushPresets[id];
    },

    updateCurrentBrushSetting: (key, value) =>
      set((s) => {
        const id: AnyBrushId = s.activeTool === 'eraser' ? s.activeEraserId : s.activeBrushId;
        return {
          brushPresets: {
            ...s.brushPresets,
            [id]: {
              ...s.brushPresets[id],
              [key]: value,
            },
          },
        };
      }),

    setFillReferMode: (fillReferMode) => set({ fillReferMode }),
    setFillTolerance: (tol) => set({ fillTolerance: clamp(Math.round(tol), 0, 100) }),
    setFillExpandPx: (px) => set({ fillExpandPx: clamp(Math.round(px), 0, 3) }),

    pushHistoryBeforeChange: () =>
      set((s) => {
        if (s.layers.length === 0) return {};
        const snap = captureLayersSnapshot(s.layers, s.activeLayerId);
        return {
          past: [...s.past.slice(-(MAX_UNDO_STEPS - 1)), snap],
          future: [],
        };
      }),

    pushPreCapturedEntry: (entry) =>
      set((s) => ({
        past: [...s.past.slice(-(MAX_UNDO_STEPS - 1)), entry],
        future: [],
      })),

    undo: () =>
      set((s) => {
        if (s.past.length === 0) return {};
        const currentSnap = captureLayersSnapshot(s.layers, s.activeLayerId);
        const prevEntry = s.past[s.past.length - 1];
        const restored = restoreLayersFromSnapshot(prevEntry, s.width, s.height);
        return {
          layers: restored.layers,
          activeLayerId: restored.activeLayerId,
          past: s.past.slice(0, -1),
          future: [currentSnap, ...s.future].slice(0, MAX_UNDO_STEPS),
          compositeVersion: s.compositeVersion + 1,
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return {};
        const currentSnap = captureLayersSnapshot(s.layers, s.activeLayerId);
        const nextEntry = s.future[0];
        const restored = restoreLayersFromSnapshot(nextEntry, s.width, s.height);
        return {
          layers: restored.layers,
          activeLayerId: restored.activeLayerId,
          past: [...s.past, currentSnap].slice(-MAX_UNDO_STEPS),
          future: s.future.slice(1),
          compositeVersion: s.compositeVersion + 1,
        };
      }),

    selectLayer: (activeLayerId) => set({ activeLayerId }),

    addLayer: (opts) => {
      get().pushHistoryBeforeChange();
      set((s) => {
        const activeIdx = s.layers.findIndex((l) => l.id === s.activeLayerId);
        const insertIdx = activeIdx >= 0 ? activeIdx + 1 : s.layers.length;
        const id = makeLayerId();
        const newLayer: LayerItem = {
          id,
          name: opts?.name ?? `レイヤー ${s.layers.length + 1}`,
          visible: true,
          opacity: 1,
          blendMode: opts?.blendMode ?? 'source-over',
          clipped: opts?.clipped ?? false,
          alphaLock: false,
          isReference: false,
          canvas: createBlankCanvas(s.width, s.height),
        };
        const layers = [...s.layers];
        layers.splice(insertIdx, 0, newLayer);
        return {
          layers,
          activeLayerId: id,
          compositeVersion: s.compositeVersion + 1,
        };
      });
    },

    deleteLayer: (id) => {
      const s = get();
      if (s.layers.length <= 1) return;
      s.pushHistoryBeforeChange();
      set((curr) => {
        const idx = curr.layers.findIndex((l) => l.id === id);
        const layers = curr.layers.filter((l) => l.id !== id);
        const nextActive =
          curr.activeLayerId === id
            ? layers[Math.max(0, idx - 1)].id
            : curr.activeLayerId;
        return {
          layers,
          activeLayerId: nextActive,
          compositeVersion: curr.compositeVersion + 1,
        };
      });
    },

    duplicateLayer: (id) => {
      const s = get();
      const target = s.layers.find((l) => l.id === id);
      if (!target) return;
      s.pushHistoryBeforeChange();
      set((curr) => {
        const idx = curr.layers.findIndex((l) => l.id === id);
        const copyCanvas = createBlankCanvas(curr.width, curr.height);
        copyCanvas.getContext('2d')!.drawImage(target.canvas, 0, 0);
        const newId = makeLayerId();
        const copy: LayerItem = {
          ...target,
          id: newId,
          name: `${target.name} コピー`,
          canvas: copyCanvas,
        };
        const layers = [...curr.layers];
        layers.splice(idx + 1, 0, copy);
        return {
          layers,
          activeLayerId: newId,
          compositeVersion: curr.compositeVersion + 1,
        };
      });
    },

    clearLayer: (id) => {
      const s = get();
      const target = s.layers.find((l) => l.id === id);
      if (!target) return;
      s.pushHistoryBeforeChange();
      target.canvas.getContext('2d')?.clearRect(0, 0, s.width, s.height);
      s.bumpComposite();
    },

    mergeLayerDown: (id) => {
      const s = get();
      const idx = s.layers.findIndex((l) => l.id === id);
      if (idx <= 0) return;
      s.pushHistoryBeforeChange();
      set((curr) => {
        const upper = curr.layers[idx];
        const lower = curr.layers[idx - 1];
        const temp = createBlankCanvas(curr.width, curr.height);
        const tempCtx = temp.getContext('2d')!;
        compositeLayers(
          tempCtx,
          [
            { ...lower, clipped: false, opacity: 1, blendMode: 'source-over' },
            upper,
          ],
          curr.width,
          curr.height,
          null
        );
        const lowerCtx = lower.canvas.getContext('2d')!;
        lowerCtx.clearRect(0, 0, curr.width, curr.height);
        lowerCtx.drawImage(temp, 0, 0);

        const layers = curr.layers.filter((l) => l.id !== id);
        return {
          layers,
          activeLayerId: lower.id,
          compositeVersion: curr.compositeVersion + 1,
        };
      });
    },

    moveLayer: (id, direction) => {
      const s = get();
      const idx = s.layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= s.layers.length) return;
      s.pushHistoryBeforeChange();
      set((curr) => {
        const layers = [...curr.layers];
        const [item] = layers.splice(idx, 1);
        layers.splice(targetIdx, 0, item);
        return { layers, compositeVersion: curr.compositeVersion + 1 };
      });
    },

    renameLayer: (id, name) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)),
      })),

    toggleLayerVisible: (id) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
        compositeVersion: s.compositeVersion + 1,
      })),

    setLayerOpacity: (id, opacity) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, opacity: clamp(opacity, 0, 1) } : l)),
        compositeVersion: s.compositeVersion + 1,
      })),

    setLayerBlendMode: (id, blendMode) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, blendMode } : l)),
        compositeVersion: s.compositeVersion + 1,
      })),

    toggleLayerClipped: (id) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, clipped: !l.clipped } : l)),
        compositeVersion: s.compositeVersion + 1,
      })),

    toggleLayerAlphaLock: (id) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, alphaLock: !l.alphaLock } : l)),
      })),

    toggleLayerReference: (id) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, isReference: !l.isReference } : l)),
      })),

    convertActiveLayerBrightnessToOpacity: () => {
      const s = get();
      const active = s.layers.find((l) => l.id === s.activeLayerId);
      if (!active) return;
      s.pushHistoryBeforeChange();
      convertCanvasBrightnessToOpacity(active.canvas);
      s.bumpComposite();
    },

    importLineArtImage: async (file, options) => {
      const bitmap = await createImageBitmap(file);
      const s = get();
      s.pushHistoryBeforeChange();

      const canvas = createBlankCanvas(s.width, s.height);
      const ctx = canvas.getContext('2d')!;
      const scale = Math.min(s.width / bitmap.width, s.height / bitmap.height);
      const dw = bitmap.width * scale;
      const dh = bitmap.height * scale;
      const dx = (s.width - dw) / 2;
      const dy = (s.height - dh) / 2;
      ctx.drawImage(bitmap, dx, dy, dw, dh);
      bitmap.close();

      if (options.convertWhiteToTransparent) {
        convertCanvasBrightnessToOpacity(canvas);
      }

      const newId = makeLayerId();
      const baseName = file.name.replace(/\.[^.]+$/, '') || '読み込み線画';
      const newLayer: LayerItem = {
        id: newId,
        name: options.setAsReference ? `${baseName} (線画)` : baseName,
        visible: true,
        opacity: 1,
        blendMode: options.convertWhiteToTransparent ? 'multiply' : 'multiply',
        clipped: false,
        alphaLock: false,
        isReference: options.setAsReference,
        canvas,
      };

      set((curr) => ({
        layers: [...curr.layers, newLayer],
        activeLayerId: curr.activeLayerId || newId,
        compositeVersion: curr.compositeVersion + 1,
      }));
    },

    exportPngDataUrl: () => {
      const s = get();
      const out = createBlankCanvas(s.width, s.height);
      const ctx = out.getContext('2d')!;
      compositeLayers(ctx, s.layers, s.width, s.height, s.paperColor);
      return out.toDataURL('image/png');
    },
  };
});
