import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, hlsToRgb, hsvToRgb, wrapHue } from '../../color/colorMath';
import { useColorStore } from '../../store/useColorStore';

type DragZone = 'ring' | 'inner' | null;

export const ColorCircleTab: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const mainColor = useColorStore((s) => s.mainColor);
  const subColor = useColorStore((s) => s.subColor);
  const activeSlot = useColorStore((s) => s.activeSlot);
  const lastOpaqueSlot = useColorStore((s) => s.lastOpaqueSlot);
  const wheelMode = useColorStore((s) => s.wheelMode);
  const setWheelMode = useColorStore((s) => s.setWheelMode);
  const setColorFromHsv = useColorStore((s) => s.setColorFromHsv);
  const setColorFromHls = useColorStore((s) => s.setColorFromHls);

  const color = (activeSlot === 'transparent' ? lastOpaqueSlot : activeSlot) === 'sub'
    ? subColor
    : mainColor;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragZoneRef = useRef<DragZone>(null);
  const [size, setSize] = useState(compact ? 210 : 248);

  // Resize observer so the wheel fits both 1-pane and 2-pane split cleanly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const dim = Math.floor(clamp(Math.min(rect.width - 16, rect.height - 28), 156, 310));
      setSize(dim);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getGeometry = useCallback((dim: number) => {
    const cx = dim / 2;
    const cy = dim / 2;
    const outerR = dim * 0.47;
    const innerR = dim * 0.365;
    // Inscribed square inside innerR
    const sqHalf = innerR * 0.69;
    // Fixed HLS triangle inside innerR (left vertical edge White->Black, right apex Pure Hue)
    const triRightX = cx + innerR * 0.92;
    const triLeftX = cx - innerR * 0.52;
    const triHalfH = innerR * 0.82;
    return {
      cx,
      cy,
      outerR,
      innerR,
      sqLeft: cx - sqHalf,
      sqTop: cy - sqHalf,
      sqSize: sqHalf * 2,
      triLeftX,
      triRightX,
      triTopY: cy - triHalfH,
      triBotY: cy + triHalfH,
    };
  }, []);

  // Render Hue Ring + Inner Square or HLS Triangle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dim = size;
    canvas.width = dim;
    canvas.height = dim;

    const g = getGeometry(dim);
    const img = ctx.createImageData(dim, dim);
    const data = img.data;

    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const dx = x + 0.5 - g.cx;
        const dy = y + 0.5 - g.cy;
        const dist = Math.hypot(dx, dy);
        const idx = (y * dim + x) * 4;

        // 1. Outer Hue Ring (1px anti-aliased feather)
        if (dist >= g.innerR - 1 && dist <= g.outerR + 1) {
          const aaOuter = clamp(g.outerR + 0.7 - dist, 0, 1);
          const aaInner = clamp(dist - (g.innerR - 0.7), 0, 1);
          const ringAlpha = aaOuter * aaInner;
          if (ringAlpha > 0) {
            // Top (12 o'clock) = 0 deg Red, clockwise
            const angleDeg = wrapHue((Math.atan2(dy, dx) * 180) / Math.PI + 90);
            const rgb = hsvToRgb(angleDeg, 100, 100);
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = Math.round(ringAlpha * 255);
            continue;
          }
        }

        // 2. Inner HSV Square or HLS Triangle
        if (wheelMode === 'hsv-square') {
          if (
            x >= g.sqLeft &&
            x <= g.sqLeft + g.sqSize &&
            y >= g.sqTop &&
            y <= g.sqTop + g.sqSize
          ) {
            const s = ((x - g.sqLeft) / g.sqSize) * 100;
            const v = (1 - (y - g.sqTop) / g.sqSize) * 100;
            const rgb = hsvToRgb(color.h, s, v);
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = 255;
          }
        } else {
          // Fixed HLS Triangle: top-left = White (L=100), bottom-left = Black (L=0), right = Pure Hue (L=50, S=100)
          if (y >= g.triTopY && y <= g.triBotY && x >= g.triLeftX - 0.5) {
            const lNorm = clamp((g.triBotY - y) / (g.triBotY - g.triTopY), 0, 1);
            const maxSpanRatio = 1 - Math.abs(2 * lNorm - 1);
            const maxX = g.triLeftX + maxSpanRatio * (g.triRightX - g.triLeftX);
            if (x <= maxX + 0.8) {
              const edgeAlpha = clamp(maxX + 0.8 - x, 0, 1) * clamp(x - (g.triLeftX - 0.5), 0, 1);
              const sNorm =
                maxSpanRatio < 1e-4
                  ? 0
                  : clamp((x - g.triLeftX) / (maxSpanRatio * (g.triRightX - g.triLeftX)), 0, 1);
              const rgb = hlsToRgb(color.h, lNorm * 100, sNorm * 100);
              data[idx] = rgb.r;
              data[idx + 1] = rgb.g;
              data[idx + 2] = rgb.b;
              data[idx + 3] = Math.round(edgeAlpha * 255);
            }
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Draw crisp cursors for Hue Ring and Inner S/V or L/S
    const hueRad = ((color.h - 90) * Math.PI) / 180;
    const midR = (g.innerR + g.outerR) * 0.5;
    const hx = g.cx + Math.cos(hueRad) * midR;
    const hy = g.cy + Math.sin(hueRad) * midR;

    const drawRingCursor = (px: number, py: number, radius = 6) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, radius - 1.2, 0, Math.PI * 2);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    };

    drawRingCursor(hx, hy, Math.max(5, (g.outerR - g.innerR) * 0.38));

    if (wheelMode === 'hsv-square') {
      const ix = g.sqLeft + (color.hsvS / 100) * g.sqSize;
      const iy = g.sqTop + (1 - color.hsvV / 100) * g.sqSize;
      drawRingCursor(ix, iy, 6.5);
    } else {
      const lNorm = clamp(color.hlsL / 100, 0, 1);
      const sNorm = clamp(color.hlsS / 100, 0, 1);
      const spanRatio = 1 - Math.abs(2 * lNorm - 1);
      const ix = g.triLeftX + sNorm * spanRatio * (g.triRightX - g.triLeftX);
      const iy = g.triBotY - lNorm * (g.triBotY - g.triTopY);
      drawRingCursor(ix, iy, 6.5);
    }
  }, [size, wheelMode, color.h, color.hsvS, color.hsvV, color.hlsL, color.hlsS, getGeometry]);

  const updateFromPointer = (clientX: number, clientY: number, zone: DragZone) => {
    const canvas = canvasRef.current;
    if (!canvas || !zone) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * size;
    const y = ((clientY - rect.top) / rect.height) * size;
    const g = getGeometry(size);

    if (zone === 'ring') {
      const hue = wrapHue((Math.atan2(y - g.cy, x - g.cx) * 180) / Math.PI + 90);
      if (wheelMode === 'hsv-square') {
        setColorFromHsv(hue, color.hsvS, color.hsvV);
      } else {
        setColorFromHls(hue, color.hlsL, color.hlsS);
      }
      return;
    }

    if (wheelMode === 'hsv-square') {
      const s = clamp(((x - g.sqLeft) / g.sqSize) * 100, 0, 100);
      const v = clamp((1 - (y - g.sqTop) / g.sqSize) * 100, 0, 100);
      setColorFromHsv(color.h, s, v);
    } else {
      const lNorm = clamp((g.triBotY - y) / (g.triBotY - g.triTopY), 0, 1);
      const maxSpanRatio = 1 - Math.abs(2 * lNorm - 1);
      const sNorm =
        maxSpanRatio < 1e-4
          ? 0
          : clamp((x - g.triLeftX) / (maxSpanRatio * (g.triRightX - g.triLeftX)), 0, 1);
      setColorFromHls(color.h, lNorm * 100, sNorm * 100);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    const g = getGeometry(size);
    const dist = Math.hypot(x - g.cx, y - g.cy);

    let zone: DragZone = null;
    if (dist >= g.innerR - 4 && dist <= g.outerR + 8) {
      zone = 'ring';
    } else if (dist < g.innerR) {
      zone = 'inner';
    }
    if (!zone) return;

    dragZoneRef.current = zone;
    canvas.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY, zone);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragZoneRef.current) return;
    updateFromPointer(e.clientX, e.clientY, dragZoneRef.current);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragZoneRef.current) {
      dragZoneRef.current = null;
      canvasRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: compact ? 185 : 225,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 6px 24px',
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: size,
          height: size,
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />

      {/* Bottom status + CSP bottom-right HSV/HLS space switcher */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          {wheelMode === 'hsv-square'
            ? `H:${Math.round(color.h)}° S:${Math.round(color.hsvS)}% V:${Math.round(color.hsvV)}%`
            : `H:${Math.round(color.h)}° L:${Math.round(color.hlsL)}% S:${Math.round(color.hlsS)}%`}
        </span>

        <div style={{ display: 'flex', gap: 3 }}>
          <button
            type="button"
            title="HSV色空間（四角形）"
            onClick={() => setWheelMode('hsv-square')}
            className={wheelMode === 'hsv-square' ? 'btn-active' : ''}
            style={{ padding: '2px 6px', fontSize: 10 }}
          >
            ■ HSV
          </button>
          <button
            type="button"
            title="HLS色空間（固定三角形：輝度コントロール向け）"
            onClick={() => setWheelMode('hls-triangle')}
            className={wheelMode === 'hls-triangle' ? 'btn-active' : ''}
            style={{ padding: '2px 6px', fontSize: 10 }}
          >
            ▶ HLS
          </button>
        </div>
      </div>
    </div>
  );
};
