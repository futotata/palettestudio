import React, { useEffect, useRef } from 'react';
import { clamp, hlsToRgb, hsvToRgb } from '../../color/colorMath';
import { SliderGroupMode, useColorStore } from '../../store/useColorStore';

interface GradientSliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  colorAtValue: (val: number) => { r: number; g: number; b: number };
  onChange: (val: number) => void;
}

const GradientSliderRow: React.FC<GradientSliderRowProps> = ({
  label,
  value,
  min,
  max,
  unit = '',
  colorAtValue,
  onChange,
}) => {
  const barRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const canvas = barRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 180;
    const h = 18;
    canvas.width = w;
    canvas.height = h;

    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const val = min + t * (max - min);
      const rgb = colorAtValue(val);
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Marker line at current value
    const ratio = clamp((value - min) / (max - min), 0, 1);
    const mx = ratio * (w - 1);
    ctx.fillStyle = '#000000';
    ctx.fillRect(mx - 2, 0, 4, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 1, 1, 2, h - 2);
  }, [value, min, max, colorAtValue]);

  const updateFromClientX = (clientX: number) => {
    const canvas = barRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    onChange(Math.round(min + ratio * (max - min)));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 20,
          fontWeight: 600,
          fontSize: 11,
          color: 'var(--text-secondary)',
          textAlign: 'center',
        }}
      >
        {label}
      </span>

      <button
        type="button"
        onClick={() => onChange(clamp(Math.round(value) - 1, min, max))}
        style={{ width: 22, height: 22, padding: 0, fontSize: 12 }}
        title="-1"
      >
        −
      </button>

      <canvas
        ref={barRef}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) updateFromClientX(e.clientX);
        }}
        onPointerUp={(e) => {
          if (draggingRef.current) {
            draggingRef.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        style={{
          flex: 1,
          height: 20,
          borderRadius: 3,
          border: '1px solid var(--border-strong)',
          touchAction: 'none',
          cursor: 'ew-resize',
        }}
      />

      <button
        type="button"
        onClick={() => onChange(clamp(Math.round(value) + 1, min, max))}
        style={{ width: 22, height: 22, padding: 0, fontSize: 12 }}
        title="+1"
      >
        +
      </button>

      <span
        style={{
          width: 38,
          textAlign: 'right',
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        {Math.round(value)}
        {unit}
      </span>
    </div>
  );
};

export const ColorSliderTab: React.FC = () => {
  const mainColor = useColorStore((s) => s.mainColor);
  const subColor = useColorStore((s) => s.subColor);
  const activeSlot = useColorStore((s) => s.activeSlot);
  const lastOpaqueSlot = useColorStore((s) => s.lastOpaqueSlot);
  const sliderMode = useColorStore((s) => s.sliderMode);
  const setSliderMode = useColorStore((s) => s.setSliderMode);

  const setColorFromRgba = useColorStore((s) => s.setColorFromRgba);
  const setColorFromHsv = useColorStore((s) => s.setColorFromHsv);
  const setColorFromHls = useColorStore((s) => s.setColorFromHls);

  const c =
    (activeSlot === 'transparent' ? lastOpaqueSlot : activeSlot) === 'sub' ? subColor : mainColor;

  const modes: Array<{ id: SliderGroupMode; label: string }> = [
    { id: 'hsv', label: 'HSV' },
    { id: 'hls', label: 'HLS' },
    { id: 'rgb', label: 'RGB' },
  ];

  return (
    <div
      className="scroll-y"
      style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        height: '100%',
      }}
    >
      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSliderMode(m.id)}
            className={sliderMode === m.id ? 'btn-active' : ''}
            style={{ flex: 1, padding: '4px 0', fontSize: 11 }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {sliderMode === 'hsv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GradientSliderRow
            label="H"
            value={c.h}
            min={0}
            max={360}
            unit="°"
            colorAtValue={(h) => hsvToRgb(h, Math.max(20, c.hsvS), Math.max(30, c.hsvV))}
            onChange={(h) => setColorFromHsv(h, c.hsvS, c.hsvV)}
          />
          <GradientSliderRow
            label="S"
            value={c.hsvS}
            min={0}
            max={100}
            unit="%"
            colorAtValue={(s) => hsvToRgb(c.h, s, c.hsvV)}
            onChange={(s) => setColorFromHsv(c.h, s, c.hsvV)}
          />
          <GradientSliderRow
            label="V"
            value={c.hsvV}
            min={0}
            max={100}
            unit="%"
            colorAtValue={(v) => hsvToRgb(c.h, c.hsvS, v)}
            onChange={(v) => setColorFromHsv(c.h, c.hsvS, v)}
          />
        </div>
      )}

      {sliderMode === 'hls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GradientSliderRow
            label="H"
            value={c.h}
            min={0}
            max={360}
            unit="°"
            colorAtValue={(h) => hlsToRgb(h, 50, 100)}
            onChange={(h) => setColorFromHls(h, c.hlsL, c.hlsS)}
          />
          <GradientSliderRow
            label="L"
            value={c.hlsL}
            min={0}
            max={100}
            unit="%"
            colorAtValue={(l) => hlsToRgb(c.h, l, c.hlsS)}
            onChange={(l) => setColorFromHls(c.h, l, c.hlsS)}
          />
          <GradientSliderRow
            label="S"
            value={c.hlsS}
            min={0}
            max={100}
            unit="%"
            colorAtValue={(s) => hlsToRgb(c.h, c.hlsL, s)}
            onChange={(s) => setColorFromHls(c.h, c.hlsL, s)}
          />
        </div>
      )}

      {sliderMode === 'rgb' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GradientSliderRow
            label="R"
            value={c.r}
            min={0}
            max={255}
            colorAtValue={(r) => ({ r, g: c.g, b: c.b })}
            onChange={(r) => setColorFromRgba({ r, g: c.g, b: c.b, a: c.a })}
          />
          <GradientSliderRow
            label="G"
            value={c.g}
            min={0}
            max={255}
            colorAtValue={(g) => ({ r: c.r, g, b: c.b })}
            onChange={(g) => setColorFromRgba({ r: c.r, g, b: c.b, a: c.a })}
          />
          <GradientSliderRow
            label="B"
            value={c.b}
            min={0}
            max={255}
            colorAtValue={(b) => ({ r: c.r, g: c.g, b })}
            onChange={(b) => setColorFromRgba({ r: c.r, g: c.g, b, a: c.a })}
          />
        </div>
      )}

      {/* Secondary RGB reference bar when viewing HSV/HLS (super helpful for checking channel clipping) */}
      {sliderMode !== 'rgb' && (
        <div
          style={{
            marginTop: 2,
            paddingTop: 8,
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>RGB連動調整</div>
          <GradientSliderRow
            label="R"
            value={c.r}
            min={0}
            max={255}
            colorAtValue={(r) => ({ r, g: c.g, b: c.b })}
            onChange={(r) => setColorFromRgba({ r, g: c.g, b: c.b, a: c.a })}
          />
          <GradientSliderRow
            label="G"
            value={c.g}
            min={0}
            max={255}
            colorAtValue={(g) => ({ r: c.r, g, b: c.b })}
            onChange={(g) => setColorFromRgba({ r: c.r, g, b: c.b, a: c.a })}
          />
          <GradientSliderRow
            label="B"
            value={c.b}
            min={0}
            max={255}
            colorAtValue={(b) => ({ r: c.r, g: c.g, b })}
            onChange={(b) => setColorFromRgba({ r: c.r, g: c.g, b, a: c.a })}
          />
        </div>
      )}
    </div>
  );
};
