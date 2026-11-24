import { LayerBlendMode, LayerItem } from './compositor';

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

export interface CanvasHistoryEntry {
  activeLayerId: string;
  layers: LayerStateSnapshot[];
}

export function captureLayersSnapshot(
  layers: LayerItem[],
  activeLayerId: string
): CanvasHistoryEntry {
  return {
    activeLayerId,
    layers: layers.map((l) => {
      const ctx = l.canvas.getContext('2d', { willReadFrequently: true })!;
      return {
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        clipped: l.clipped,
        alphaLock: l.alphaLock,
        isReference: l.isReference,
        imageData: ctx.getImageData(0, 0, l.canvas.width, l.canvas.height),
      };
    }),
  };
}

export function restoreLayersFromSnapshot(
  entry: CanvasHistoryEntry,
  width: number,
  height: number
): { layers: LayerItem[]; activeLayerId: string } {
  const restored: LayerItem[] = entry.layers.map((snap) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(snap.imageData, 0, 0);
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
