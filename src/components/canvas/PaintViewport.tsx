import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, rgbToHex } from '../../color/colorMath';
import { StrokeSession } from '../../engine/brushEngine';
import { buildReferenceImageData, compositeLayers } from '../../engine/compositor';
import { executeFloodFill } from '../../engine/floodFill';
import { captureLayersSnapshot } from '../../engine/historyManager';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useColorStore } from '../../store/useColorStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { SubViewPanel } from './SubViewPanel';

interface TouchPointInfo {
  x: number;
  y: number;
  startX: number;
  startY: number;
  type: string;
}

interface EyedropperHud {
  screenX: number;
  screenY: number;
  pickedHex: string;
  prevHex: string;
}

export const PaintViewport: React.FC = () => {
  const width = useCanvasStore((s) => s.width);
  const height = useCanvasStore((s) => s.height);
  const paperColor = useCanvasStore((s) => s.paperColor);
  const zoom = useCanvasStore((s) => s.zoom);
  const panX = useCanvasStore((s) => s.panX);
  const panY = useCanvasStore((s) => s.panY);
  const rotationDeg = useCanvasStore((s) => s.rotationDeg);
  const flipViewX = useCanvasStore((s) => s.flipViewX);
  const layers = useCanvasStore((s) => s.layers);
  const activeLayerId = useCanvasStore((s) => s.activeLayerId);
  const compositeVersion = useCanvasStore((s) => s.compositeVersion);

  const activeTool = useCanvasStore((s) => s.activeTool);
  const thumbEyedropperHeld = useCanvasStore((s) => s.thumbEyedropperHeld);
  const fillReferMode = useCanvasStore((s) => s.fillReferMode);
  const fillTolerance = useCanvasStore((s) => s.fillTolerance);
  const fillExpandPx = useCanvasStore((s) => s.fillExpandPx);

  const setViewportTransform = useCanvasStore((s) => s.setViewportTransform);
  const fitViewport = useCanvasStore((s) => s.fitViewport);
  const bumpComposite = useCanvasStore((s) => s.bumpComposite);
  const getCurrentStrokeBrush = useCanvasStore((s) => s.getCurrentStrokeBrush);
  const pushHistoryBeforeChange = useCanvasStore((s) => s.pushHistoryBeforeChange);
  const pushPreCapturedEntry = useCanvasStore((s) => s.pushPreCapturedEntry);
  const undo = useCanvasStore((s) => s.undo);

  const penOnlyMode = useWorkspaceStore((s) => s.penOnlyMode);
  const notifyStylusDetected = useWorkspaceStore((s) => s.notifyStylusDetected);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePointersRef = useRef<Map<number, TouchPointInfo>>(new Map());
  const strokeSessionRef = useRef<{
    pointerId: number;
    session: StrokeSession;
    preEntry: ReturnType<typeof captureLayersSnapshot>;
    movedDist: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  const gestureRef = useRef<{
    lastMidX: number;
    lastMidY: number;
    lastDist: number;
    lastAngle: number;
    startedAt: number;
    maxMove: number;
  } | null>(null);

  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  const [eyedropperHud, setEyedropperHud] = useState<EyedropperHud | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const spaceHeldRef = useRef(false);

  // Initial fit to viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    fitViewport(rect.width, rect.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Keyboard shortcuts (Undo/Redo, Space pan, X swap colors) for optional tablet keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        spaceHeldRef.current = true;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useCanvasStore.getState().redo();
        } else {
          useCanvasStore.getState().undo();
        }
      } else if (e.key.toLowerCase() === 'x') {
        useColorStore.getState().swapMainAndSub();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Re-composite layers onto displayCanvas
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    compositeLayers(ctx, layers, width, height, paperColor);
  }, [layers, width, height, paperColor, compositeVersion]);

  /**
   * Maps screen client coordinates into document pixel coordinates (0..width, 0..height),
   * accounting for pan, zoom, rotationDeg, and horizontal mirror preview (`flipViewX`).
   */
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const vp = viewportRef.current;
      if (!vp) return { x: 0, y: 0 };
      const rect = vp.getBoundingClientRect();
      const vx = clientX - rect.left - rect.width / 2 - panX;
      const vy = clientY - rect.top - rect.height / 2 - panY;

      const rad = (-rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      let rx = vx * cos - vy * sin;
      const ry = vx * sin + vy * cos;

      if (flipViewX) rx = -rx;

      return {
        x: rx / zoom + width / 2,
        y: ry / zoom + height / 2,
      };
    },
    [panX, panY, rotationDeg, flipViewX, zoom, width, height]
  );

  const sampleCompositeColorAt = (clientX: number, clientY: number, prevHex: string) => {
    const canvas = displayCanvasRef.current;
    const vp = viewportRef.current;
    if (!canvas || !vp) return;
    const pt = clientToCanvas(clientX, clientY);
    const ix = clamp(Math.floor(pt.x), 0, width - 1);
    const iy = clamp(Math.floor(pt.y), 0, height - 1);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const px = ctx.getImageData(ix, iy, 1, 1).data;
    useColorStore.getState().setColorFromRgba({ r: px[0], g: px[1], b: px[2], a: 1 });
    const vpRect = vp.getBoundingClientRect();
    setEyedropperHud({
      screenX: clientX - vpRect.left,
      screenY: clientY - vpRect.top,
      pickedHex: rgbToHex(px[0], px[1], px[2]),
      prevHex,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const vp = viewportRef.current;
    if (!vp) return;

    if (e.pointerType === 'pen') {
      notifyStylusDetected();
    }

    vp.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      type: e.pointerType,
    });

    // Multi-touch (2 fingers): Pan + Pinch Zoom + Rotate + 2-finger Tap Undo
    const touchPointers = [...activePointersRef.current.values()].filter((p) => p.type === 'touch');
    if (touchPointers.length >= 2) {
      // Cancel any nascent accidental 1-finger stroke before committing
      if (strokeSessionRef.current && strokeSessionRef.current.movedDist < 10) {
        const activeLayer = layers.find((l) => l.id === activeLayerId);
        if (activeLayer) {
          activeLayer.canvas
            .getContext('2d')
            ?.putImageData(strokeSessionRef.current.session.getBeforeSnapshot(), 0, 0);
          bumpComposite();
        }
        strokeSessionRef.current = null;
      }

      const [p1, p2] = touchPointers;
      gestureRef.current = {
        lastMidX: (p1.x + p2.x) / 2,
        lastMidY: (p1.y + p2.y) / 2,
        lastDist: Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
        lastAngle: (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI,
        startedAt: performance.now(),
        maxMove: 0,
      };
      return;
    }

    // Hardware Palm Rejection: ignore single-finger touch on canvas when Pen-Only mode is active
    const effTool = thumbEyedropperHeld ? 'eyedropper' : activeTool;
    if (penOnlyMode && e.pointerType === 'touch' && effTool !== 'pan') {
      return;
    }

    // Middle mouse or Pan tool or Spacebar -> Pan
    if (e.button === 1 || effTool === 'pan' || spaceHeldRef.current) {
      panDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origPanX: panX,
        origPanY: panY,
      };
      return;
    }

    // Eyedropper (either Eyedropper tool or Left Thumb Hold button!)
    if (effTool === 'eyedropper' || e.altKey) {
      const cur = useColorStore.getState().getActiveColorModel();
      const prevHex = rgbToHex(cur.r, cur.g, cur.b);
      sampleCompositeColorAt(e.clientX, e.clientY, prevHex);
      return;
    }

    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer || !activeLayer.visible) return;

    const colorStore = useColorStore.getState();
    const activeColor = colorStore.getActiveColorModel();
    const isTransparentColor = colorStore.activeSlot === 'transparent';

    // Bucket Flood Fill
    if (effTool === 'fill') {
      const pt = clientToCanvas(e.clientX, e.clientY);
      if (pt.x < 0 || pt.x >= width || pt.y < 0 || pt.y >= height) return;

      pushHistoryBeforeChange();
      const refData = buildReferenceImageData(
        layers,
        width,
        height,
        fillReferMode,
        activeLayer.id
      );
      const changed = executeFloodFill(activeLayer.canvas, refData, {
        x: pt.x,
        y: pt.y,
        fillColor: {
          r: activeColor.r,
          g: activeColor.g,
          b: activeColor.b,
          a: activeColor.a,
        },
        isErase: isTransparentColor,
        tolerance: fillTolerance,
        expandPx: fillExpandPx,
        alphaLock: activeLayer.alphaLock,
      });
      if (changed) {
        colorStore.recordStrokeColorUsed();
        bumpComposite();
      }
      return;
    }

    // Brush or Eraser Stroke
    const brush = getCurrentStrokeBrush();
    const isErase = effTool === 'eraser' || isTransparentColor;
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    const preEntry = captureLayersSnapshot(layers, activeLayerId);
    const session = new StrokeSession({
      layerCanvas: activeLayer.canvas,
      compositeCanvas: displayCanvas,
      brush,
      color: { r: activeColor.r, g: activeColor.g, b: activeColor.b, a: activeColor.a },
      isErase,
      alphaLock: activeLayer.alphaLock,
    });

    const pt = clientToCanvas(e.clientX, e.clientY);
    const pressure =
      e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.5) : 0.72;
    session.addPoint({ x: pt.x, y: pt.y, pressure });

    strokeSessionRef.current = {
      pointerId: e.pointerId,
      session,
      preEntry,
      movedDist: 0,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };

    // Directly re-composite for immediate zero-lag visual feedback
    const ctx = displayCanvas.getContext('2d');
    if (ctx) compositeLayers(ctx, layers, width, height, paperColor);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const vp = viewportRef.current;
    if (vp) {
      const r = vp.getBoundingClientRect();
      setCursorPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    }

    const tracked = activePointersRef.current.get(e.pointerId);
    if (tracked) {
      tracked.x = e.clientX;
      tracked.y = e.clientY;
    }

    // 2-finger touch gesture update
    const touchPointers = [...activePointersRef.current.values()].filter((p) => p.type === 'touch');
    if (gestureRef.current && touchPointers.length >= 2) {
      const [p1, p2] = touchPointers;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

      const g = gestureRef.current;
      const dPanX = midX - g.lastMidX;
      const dPanY = midY - g.lastMidY;
      const scaleFactor = dist / g.lastDist;
      let dAngle = angle - g.lastAngle;
      if (dAngle > 180) dAngle -= 360;
      if (dAngle < -180) dAngle += 360;

      g.maxMove = Math.max(
        g.maxMove,
        Math.hypot(p1.x - p1.startX, p1.y - p1.startY),
        Math.hypot(p2.x - p2.startX, p2.y - p2.startY)
      );

      const nextZoom = clamp(zoom * scaleFactor, 0.12, 8);
      const nextRot = Math.abs(dAngle) > 0.35 ? rotationDeg + dAngle : rotationDeg;
      setViewportTransform(nextZoom, panX + dPanX, panY + dPanY, nextRot);

      g.lastMidX = midX;
      g.lastMidY = midY;
      g.lastDist = dist;
      g.lastAngle = angle;
      return;
    }

    if (panDragRef.current && panDragRef.current.pointerId === e.pointerId) {
      setViewportTransform(
        zoom,
        panDragRef.current.origPanX + (e.clientX - panDragRef.current.startX),
        panDragRef.current.origPanY + (e.clientY - panDragRef.current.startY)
      );
      return;
    }

    if (eyedropperHud && activePointersRef.current.has(e.pointerId)) {
      sampleCompositeColorAt(e.clientX, e.clientY, eyedropperHud.prevHex);
      return;
    }

    const activeStroke = strokeSessionRef.current;
    if (activeStroke && activeStroke.pointerId === e.pointerId) {
      activeStroke.movedDist = Math.max(
        activeStroke.movedDist,
        Math.hypot(e.clientX - activeStroke.startClientX, e.clientY - activeStroke.startClientY)
      );

      // Process coalesced stylus samples for silky high-refresh curves
      const nativeEvt = e.nativeEvent as PointerEvent;
      const events =
        typeof nativeEvt.getCoalescedEvents === 'function'
          ? nativeEvt.getCoalescedEvents()
          : [nativeEvt];
      const samples = events.length > 0 ? events : [nativeEvt];

      for (const sample of samples) {
        const pt = clientToCanvas(sample.clientX, sample.clientY);
        const pressure =
          sample.pointerType === 'pen'
            ? sample.pressure > 0
              ? sample.pressure
              : 0.5
            : 0.72;
        activeStroke.session.addPoint({ x: pt.x, y: pt.y, pressure });
      }

      const displayCanvas = displayCanvasRef.current;
      const ctx = displayCanvas?.getContext('2d');
      if (ctx) compositeLayers(ctx, layers, width, height, paperColor);
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);

    // Check 2-finger quick tap -> Undo!
    if (gestureRef.current && activePointersRef.current.size === 0) {
      const elapsed = performance.now() - gestureRef.current.startedAt;
      if (elapsed < 240 && gestureRef.current.maxMove < 14) {
        undo();
      }
      gestureRef.current = null;
    }

    if (panDragRef.current?.pointerId === e.pointerId) {
      panDragRef.current = null;
    }

    if (eyedropperHud) {
      setEyedropperHud(null);
    }

    if (strokeSessionRef.current?.pointerId === e.pointerId) {
      const finished = strokeSessionRef.current;
      strokeSessionRef.current = null;
      pushPreCapturedEntry(finished.preEntry);
      useColorStore.getState().recordStrokeColorUsed();
      bumpComposite();
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const effTool = thumbEyedropperHeld ? 'eyedropper' : activeTool;
  const brushDiameterScreen = getCurrentStrokeBrush().size * zoom;

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onPointerLeave={() => setCursorPos(null)}
      onWheel={(e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        setViewportTransform(zoom * factor, panX, panY);
      }}
      style={{
        position: 'relative',
        flex: 1,
        height: '100%',
        background: 'var(--bg-viewport)',
        overflow: 'hidden',
        touchAction: 'none',
        cursor:
          effTool === 'pan'
            ? 'grab'
            : effTool === 'eyedropper' || effTool === 'fill'
              ? 'crosshair'
              : 'none',
      }}
    >
      {/* Transformed Document Canvas */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width,
          height,
          transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) rotate(${rotationDeg}deg) scale(${
            flipViewX ? -zoom : zoom
          }, ${zoom})`,
          transformOrigin: 'center center',
          boxShadow: '0 10px 36px rgba(0, 0, 0, 0.52)',
          pointerEvents: 'none',
        }}
      >
        <canvas
          ref={displayCanvasRef}
          width={width}
          height={height}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>

      {/* Brush Size Ring Indicator */}
      {cursorPos && (effTool === 'brush' || effTool === 'eraser') && (
        <div
          style={{
            position: 'absolute',
            left: cursorPos.x - brushDiameterScreen / 2,
            top: cursorPos.y - brushDiameterScreen / 2,
            width: Math.max(4, brushDiameterScreen),
            height: Math.max(4, brushDiameterScreen),
            borderRadius: '50%',
            border: '1.2px solid rgba(255,255,255,0.85)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* CSP-style Floating Eyedropper Split Color Ring */}
      {eyedropperHud && (
        <div
          style={{
            position: 'absolute',
            left: eyedropperHud.screenX - 42,
            top: eyedropperHud.screenY - 96,
            width: 84,
            height: 84,
            borderRadius: '50%',
            border: '3px solid #ffffff',
            boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, background: eyedropperHud.pickedHex }} />
          <div style={{ flex: 1, background: eyedropperHud.prevHex }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#fff',
              textShadow: '0 1px 3px #000, 0 0 2px #000',
            }}
          >
            {eyedropperHud.pickedHex}
          </div>
        </div>
      )}

      {/* Mirror view indicator badge */}
      {flipViewX && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(76, 139, 245, 0.85)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 12,
            pointerEvents: 'none',
          }}
        >
          左右反転表示中
        </div>
      )}

      {/* Floating Sub-View Reference Panel (anchored top-left away from right palette) */}
      <SubViewPanel />
    </div>
  );
};
