import { create } from 'zustand';
import { clamp } from '../color/colorMath';
import { loadPersisted, savePersistedDebounced } from './persistence';

export type PaletteTabId =
  | 'circle'
  | 'slider'
  | 'set'
  | 'approx'
  | 'intermediate'
  | 'history';

export const PALETTE_TABS: Array<{ id: PaletteTabId; label: string; shortLabel: string }> = [
  { id: 'circle', label: 'カラーサークル', shortLabel: 'サークル' },
  { id: 'slider', label: 'カラースライダー', shortLabel: 'スライダー' },
  { id: 'set', label: 'カラーセット', shortLabel: 'セット' },
  { id: 'approx', label: '近似色', shortLabel: '近似色' },
  { id: 'intermediate', label: '中間色', shortLabel: '中間色' },
  { id: 'history', label: 'カラーヒストリー', shortLabel: '履歴' },
];

export interface SubViewImage {
  id: string;
  name: string;
  dataUrl: string;
}

interface PersistedWorkspaceData {
  paletteLayout: 'split' | 'single';
  singleTab: PaletteTabId;
  topTab: PaletteTabId;
  bottomTab: PaletteTabId;
  rightDockOpen: boolean;
  rightDockWidth: number;
  layerPanelOpen: boolean;
  penOnlyMode: boolean;
  autoPenDetect: boolean;
  subViewOpen: boolean;
  subViewImages: SubViewImage[];
  subViewIndex: number;
  subViewAutoEyedropper: boolean;
}

export interface WorkspaceStoreState extends PersistedWorkspaceData {
  subViewZoom: number;
  subViewPanX: number;
  subViewPanY: number;
  subViewFlipX: boolean;
  detectedStylusOnce: boolean;

  hydrate: () => Promise<void>;
  setPaletteLayout: (layout: 'split' | 'single') => void;
  setSingleTab: (tab: PaletteTabId) => void;
  setTopTab: (tab: PaletteTabId) => void;
  setBottomTab: (tab: PaletteTabId) => void;
  toggleRightDock: () => void;
  setRightDockWidth: (width: number) => void;
  toggleLayerPanel: () => void;
  setLayerPanelOpen: (open: boolean) => void;

  setPenOnlyMode: (enabled: boolean) => void;
  notifyStylusDetected: () => void;

  toggleSubView: () => void;
  addSubViewImage: (name: string, dataUrl: string) => void;
  removeSubViewImage: (id: string) => void;
  selectSubViewIndex: (index: number) => void;
  setSubViewTransform: (zoom: number, panX: number, panY: number) => void;
  resetSubViewTransform: () => void;
  toggleSubViewFlipX: () => void;
  toggleSubViewAutoEyedropper: () => void;
}

const STORAGE_KEY = 'palette-studio:workspace-v1';

function persistWorkspace(s: WorkspaceStoreState): void {
  const data: PersistedWorkspaceData = {
    paletteLayout: s.paletteLayout,
    singleTab: s.singleTab,
    topTab: s.topTab,
    bottomTab: s.bottomTab,
    rightDockOpen: s.rightDockOpen,
    rightDockWidth: s.rightDockWidth,
    layerPanelOpen: s.layerPanelOpen,
    penOnlyMode: s.penOnlyMode,
    autoPenDetect: s.autoPenDetect,
    subViewOpen: s.subViewOpen,
    subViewImages: s.subViewImages,
    subViewIndex: s.subViewIndex,
    subViewAutoEyedropper: s.subViewAutoEyedropper,
  };
  savePersistedDebounced(STORAGE_KEY, data);
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  paletteLayout: 'split',
  singleTab: 'circle',
  topTab: 'circle',
  bottomTab: 'set',
  rightDockOpen: true,
  rightDockWidth: 324,
  layerPanelOpen: true,
  penOnlyMode: false,
  autoPenDetect: true,
  detectedStylusOnce: false,

  subViewOpen: false,
  subViewImages: [],
  subViewIndex: 0,
  subViewZoom: 1,
  subViewPanX: 0,
  subViewPanY: 0,
  subViewFlipX: false,
  subViewAutoEyedropper: true,

  hydrate: async () => {
    const saved = await loadPersisted<Partial<PersistedWorkspaceData>>(STORAGE_KEY);
    if (saved) {
      set((s) => ({ ...s, ...saved }));
    }
  },

  setPaletteLayout: (paletteLayout) =>
    set((s) => {
      const next = { ...s, paletteLayout };
      persistWorkspace(next);
      return { paletteLayout };
    }),

  setSingleTab: (singleTab) =>
    set((s) => {
      const next = { ...s, singleTab };
      persistWorkspace(next);
      return { singleTab };
    }),

  setTopTab: (topTab) =>
    set((s) => {
      const next = { ...s, topTab };
      persistWorkspace(next);
      return { topTab };
    }),

  setBottomTab: (bottomTab) =>
    set((s) => {
      const next = { ...s, bottomTab };
      persistWorkspace(next);
      return { bottomTab };
    }),

  toggleRightDock: () =>
    set((s) => {
      const rightDockOpen = !s.rightDockOpen;
      const next = { ...s, rightDockOpen };
      persistWorkspace(next);
      return { rightDockOpen };
    }),

  setRightDockWidth: (width) =>
    set((s) => {
      const rightDockWidth = clamp(Math.round(width), 268, 430);
      const next = { ...s, rightDockWidth };
      persistWorkspace(next);
      return { rightDockWidth };
    }),

  toggleLayerPanel: () =>
    set((s) => {
      const layerPanelOpen = !s.layerPanelOpen;
      const next = { ...s, layerPanelOpen };
      persistWorkspace(next);
      return { layerPanelOpen };
    }),

  setLayerPanelOpen: (layerPanelOpen) =>
    set((s) => {
      const next = { ...s, layerPanelOpen };
      persistWorkspace(next);
      return { layerPanelOpen };
    }),

  setPenOnlyMode: (penOnlyMode) =>
    set((s) => {
      const next = { ...s, penOnlyMode, autoPenDetect: false };
      persistWorkspace(next);
      return { penOnlyMode, autoPenDetect: false };
    }),

  notifyStylusDetected: () =>
    set((s) => {
      if (s.detectedStylusOnce) return {};
      const enablePenOnly = s.autoPenDetect ? true : s.penOnlyMode;
      const next = { ...s, detectedStylusOnce: true, penOnlyMode: enablePenOnly };
      persistWorkspace(next);
      return { detectedStylusOnce: true, penOnlyMode: enablePenOnly };
    }),

  toggleSubView: () =>
    set((s) => {
      const subViewOpen = !s.subViewOpen;
      const next = { ...s, subViewOpen };
      persistWorkspace(next);
      return { subViewOpen };
    }),

  addSubViewImage: (name, dataUrl) =>
    set((s) => {
      const img: SubViewImage = {
        id: `sub-${Date.now().toString(36)}`,
        name,
        dataUrl,
      };
      const subViewImages = [...s.subViewImages, img].slice(-8);
      const subViewIndex = subViewImages.length - 1;
      const next = {
        ...s,
        subViewImages,
        subViewIndex,
        subViewOpen: true,
        subViewZoom: 1,
        subViewPanX: 0,
        subViewPanY: 0,
      };
      persistWorkspace(next);
      return {
        subViewImages,
        subViewIndex,
        subViewOpen: true,
        subViewZoom: 1,
        subViewPanX: 0,
        subViewPanY: 0,
      };
    }),

  removeSubViewImage: (id) =>
    set((s) => {
      const subViewImages = s.subViewImages.filter((item) => item.id !== id);
      const subViewIndex = Math.max(0, Math.min(s.subViewIndex, subViewImages.length - 1));
      const next = { ...s, subViewImages, subViewIndex };
      persistWorkspace(next);
      return { subViewImages, subViewIndex };
    }),

  selectSubViewIndex: (index) =>
    set((s) => {
      const subViewIndex = clamp(index, 0, Math.max(0, s.subViewImages.length - 1));
      const next = { ...s, subViewIndex, subViewZoom: 1, subViewPanX: 0, subViewPanY: 0 };
      persistWorkspace(next);
      return { subViewIndex, subViewZoom: 1, subViewPanX: 0, subViewPanY: 0 };
    }),

  setSubViewTransform: (subViewZoom, subViewPanX, subViewPanY) =>
    set({
      subViewZoom: clamp(subViewZoom, 0.25, 6),
      subViewPanX,
      subViewPanY,
    }),

  resetSubViewTransform: () => set({ subViewZoom: 1, subViewPanX: 0, subViewPanY: 0, subViewFlipX: false }),

  toggleSubViewFlipX: () => set((s) => ({ subViewFlipX: !s.subViewFlipX })),

  toggleSubViewAutoEyedropper: () =>
    set((s) => {
      const subViewAutoEyedropper = !s.subViewAutoEyedropper;
      const next = { ...s, subViewAutoEyedropper };
      persistWorkspace(next);
      return { subViewAutoEyedropper };
    }),
}));
