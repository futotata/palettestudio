import { LayerBlendMode, LayerItem } from './compositor';
import { readCanvasRegion, writeCanvasRegion } from './gpuReadback';

export interface LayerStateSnapshot {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: LayerBlendMode;
  clipped: boolean;
  alphaLock: boolean;
  isReference: boolean;
  imageData: ImageData;
}

export interface FullCanvasHistoryEntry {
  kind: 'full';
  activeLayerId: string;
  layers: LayerStateSnapshot[];
}

export interface LayerPatchHistoryEntry {
  kind: 'patch';
  layerId: string;
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
}

export type CanvasHistoryEntry = FullCanvasHistoryEntry | LayerPatchHistoryEntry;

export function captureLayersSnapshot(
  layers: LayerItem[],
  activeLayerId: string
): FullCanvasHistoryEntry {
  return {
    kind: 'full',
    activeLayerId,
    layers: layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      clipped: l.clipped,
      alphaLock: l.alphaLock,
      isReference: l.isReference,
      imageData: readCanvasRegion(l.canvas, 0, 0, l.canvas.width, l.canvas.height),
    })),
  };
}

export function restoreLayersFromSnapshot(
  entry: FullCanvasHistoryEntry,
  width: number,
  height: number
): { layers: LayerItem[]; activeLayerId: string } {
  const restored: LayerItem[] = entry.layers.map((snap) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    writeCanvasRegion(canvas, snap.imageData, 0, 0);
    return {
      id: snap.id,
      name: snap.name,
      visible: snap.visible,
      opacity: snap.opacity,
      blendMode: snap.blendMode,
      clipped: snap.clipped,
      alphaLock: snap.alphaLock,
      isReference: snap.isReference,
      canvas,
    };
  });
  return {
    layers: restored,
    activeLayerId: entry.activeLayerId,
  };
}

export function applyPatchUndo(layers: LayerItem[], entry: LayerPatchHistoryEntry): boolean {
  const target = layers.find((l) => l.id === entry.layerId);
  if (!target) return false;
  writeCanvasRegion(target.canvas, entry.before, entry.x, entry.y);
  return true;
}

export function applyPatchRedo(layers: LayerItem[], entry: LayerPatchHistoryEntry): boolean {
  const target = layers.find((l) => l.id === entry.layerId);
  if (!target) return false;
  writeCanvasRegion(target.canvas, entry.after, entry.x, entry.y);
  return true;
}
