import React, { useRef, useState } from 'react';
import {
  Brush,
  Eraser,
  FlipHorizontal2,
  Hand,
  Maximize2,
  PaintBucket,
  Pipette,
  Redo2,
  Undo2,
} from 'lucide-react';
import { clamp } from '../../color/colorMath';
import { BrushId, EraserId } from '../../engine/brushEngine';
import { FillReferMode, useCanvasStore } from '../../store/useCanvasStore';

const VerticalThumbSlider: React.FC<{
  label: string;
  valueText: string;
  ratio: number; // 0..1
  onRatioChange: (ratio: number) => void;
  height?: number;
}> = ({ label, valueText, ratio, onRatioChange, height = 94 }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const update = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Bottom = 0, Top = 1
    const r = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    onRatioChange(r);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        width: '100%',
      }}
    >
      <span style={{ fontSize: 9.5, color: 'var(--text-secondary)' }}>{label}</span>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e.clientY);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) update(e.clientY);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={(e) => {
          draggingRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        style={{
          position: 'relative',
          width: 26,
          height,
          background: 'var(--bg-input)',
          border: '1px solid var(--border-strong)',
          borderRadius: 13,
          overflow: 'hidden',
          touchAction: 'none',
          cursor: 'ns-resize',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${clamp(ratio, 0, 1) * 100}%`,
            background: 'linear-gradient(180deg, var(--accent-hover), var(--accent))',
          }}
        />
      </div>
      <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{valueText}</span>
    </div>
  );
};

export const LeftThumbBar: React.FC = () => {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const thumbEyedropperHeld = useCanvasStore((s) => s.thumbEyedropperHeld);
  const activeBrushId = useCanvasStore((s) => s.activeBrushId);
  const activeEraserId = useCanvasStore((s) => s.activeEraserId);
  const brushPresets = useCanvasStore((s) => s.brushPresets);
  const fillReferMode = useCanvasStore((s) => s.fillReferMode);
  const fillTolerance = useCanvasStore((s) => s.fillTolerance);
  const fillExpandPx = useCanvasStore((s) => s.fillExpandPx);
  const flipViewX = useCanvasStore((s) => s.flipViewX);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);

  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setThumbEyedropperHeld = useCanvasStore((s) => s.setThumbEyedropperHeld);
  const selectBrush = useCanvasStore((s) => s.selectBrush);
  const selectEraser = useCanvasStore((s) => s.selectEraser);
  const updateCurrentBrushSetting = useCanvasStore((s) => s.updateCurrentBrushSetting);
  const setFillReferMode = useCanvasStore((s) => s.setFillReferMode);
  const setFillTolerance = useCanvasStore((s) => s.setFillTolerance);
  const setFillExpandPx = useCanvasStore((s) => s.setFillExpandPx);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const toggleFlipViewX = useCanvasStore((s) => s.toggleFlipViewX);
  const fitViewport = useCanvasStore((s) => s.fitViewport);

  const [flyout, setFlyout] = useState<'brush' | 'eraser' | 'fill' | null>(null);

  const currentBrush =
    activeTool === 'eraser' ? brushPresets[activeEraserId] : brushPresets[activeBrushId];

  // Non-linear size slider mapping (1..260px) so fine sizes (2..40px) have rich thumb precision!
  const sizeToRatio = (sz: number) => Math.sqrt(clamp((sz - 1) / 259, 0, 1));
  const ratioToSize = (r: number) => Math.round(1 + r * r * 259);

  const brushIds: BrushId[] = ['gpen', 'airbrush', 'mix', 'blend'];
  const eraserIds: EraserId[] = ['eraser-hard', 'eraser-soft'];

  return (
    <aside
      aria-label="左手親指用クイックツールバー"
      style={{
        position: 'relative',
        width: 58,
        height: '100%',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 4px',
        gap: 6,
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Undo / Redo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <button
          type="button"
          title="元に戻す (Undo / 2本指タップ)"
          disabled={!canUndo}
          onClick={undo}
          style={{ width: '100%', minHeight: 36, padding: 0 }}
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          title="やり直し (Redo)"
          disabled={!canRedo}
          onClick={redo}
          style={{ width: '100%', minHeight: 34, padding: 0 }}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div style={{ width: '80%', height: 1, background: 'var(--border-color)' }} />

      {/* Left-Thumb Hold Eyedropper (Tablet Alt-key equivalent!) */}
      <button
        type="button"
        title="左手親指で押している間だけスポイト（タップでスポイトツール固定）"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setThumbEyedropperHeld(true);
        }}
        onPointerUp={(e) => {
          setThumbEyedropperHeld(false);
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => setThumbEyedropperHeld(false)}
        onDoubleClick={() => setActiveTool(activeTool === 'eyedropper' ? 'brush' : 'eyedropper')}
        className={
          thumbEyedropperHeld || activeTool === 'eyedropper' ? 'btn-primary' : ''
        }
        style={{
          width: '100%',
          minHeight: 42,
          flexDirection: 'column',
          gap: 1,
          padding: '3px 2px',
          fontSize: 9,
        }}
      >
        <Pipette size={16} />
        <span>スポイト</span>
      </button>

      {/* Tool Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <button
          type="button"
          title="ブラシ選択（再タップでブラシ種別ポップアップ）"
          onClick={() => {
            if (activeTool === 'brush') {
              setFlyout(flyout === 'brush' ? null : 'brush');
            } else {
              setActiveTool('brush');
              setFlyout('brush');
            }
          }}
          className={activeTool === 'brush' ? 'btn-active' : ''}
          style={{
            width: '100%',
            minHeight: 40,
            flexDirection: 'column',
            gap: 1,
            padding: '3px 2px',
            fontSize: 9,
          }}
        >
          <Brush size={15} />
          <span>{brushPresets[activeBrushId].shortLabel}</span>
        </button>

        <button
          type="button"
          title="消しゴム（硬消し・軟消し）"
          onClick={() => {
            if (activeTool === 'eraser') {
              setFlyout(flyout === 'eraser' ? null : 'eraser');
            } else {
              setActiveTool('eraser');
              setFlyout(null);
            }
          }}
          className={activeTool === 'eraser' ? 'btn-active' : ''}
          style={{
            width: '100%',
            minHeight: 38,
            flexDirection: 'column',
            gap: 1,
            padding: '3px 2px',
            fontSize: 9,
          }}
        >
          <Eraser size={15} />
          <span>{brushPresets[activeEraserId].shortLabel}</span>
        </button>

        <button
          type="button"
          title="バケツ塗り（参照レイヤー対応）"
          onClick={() => {
            if (activeTool === 'fill') {
              setFlyout(flyout === 'fill' ? null : 'fill');
            } else {
              setActiveTool('fill');
              setFlyout('fill');
            }
          }}
          className={activeTool === 'fill' ? 'btn-active' : ''}
          style={{
            width: '100%',
            minHeight: 38,
            flexDirection: 'column',
            gap: 1,
            padding: '3px 2px',
            fontSize: 9,
          }}
        >
          <PaintBucket size={15} />
          <span>バケツ</span>
        </button>

        <button
          type="button"
          title="キャンバス移動ツール"
          onClick={() => {
            setActiveTool(activeTool === 'pan' ? 'brush' : 'pan');
            setFlyout(null);
          }}
          className={activeTool === 'pan' ? 'btn-active' : ''}
          style={{ width: '100%', minHeight: 32, padding: 0 }}
        >
          <Hand size={15} />
        </button>
      </div>

      {/* Vertical Thumb Sliders for Brush Size & Opacity */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        <VerticalThumbSlider
          label="サイズ"
          valueText={`${Math.round(currentBrush.size)}`}
          ratio={sizeToRatio(currentBrush.size)}
          onRatioChange={(r) => updateCurrentBrushSetting('size', ratioToSize(r))}
          height={86}
        />
        <VerticalThumbSlider
          label="不透明"
          valueText={`${Math.round(currentBrush.opacity * 100)}%`}
          ratio={currentBrush.opacity}
          onRatioChange={(r) => updateCurrentBrushSetting('opacity', clamp(r, 0.02, 1))}
          height={78}
        />
      </div>

      {/* Bottom View Helpers: Mirror Flip & Fit */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <button
          type="button"
          title="表示を左右反転（デッサン・塗りバランスの確認）"
          onClick={toggleFlipViewX}
          className={flipViewX ? 'btn-active' : ''}
          style={{ width: '100%', minHeight: 32, padding: 0 }}
        >
          <FlipHorizontal2 size={15} />
        </button>
        <button
          type="button"
          title="キャンバスを画面中央にフィット"
          onClick={() => fitViewport(window.innerWidth - 390, window.innerHeight - 48)}
          style={{ width: '100%', minHeight: 32, padding: 0 }}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Tool Sub-Settings Flyout Card */}
      {flyout && (
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: 96,
            width: 244,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 80,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 12 }}>
              {flyout === 'brush'
                ? '塗りブラシ選択'
                : flyout === 'eraser'
                  ? '消しゴム選択'
                  : 'バケツ塗り設定'}
            </strong>
            <button
              type="button"
              onClick={() => setFlyout(null)}
              style={{ fontSize: 10, padding: '2px 6px' }}
            >
              閉じる
            </button>
          </div>

          {flyout === 'brush' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {brushIds.map((id) => {
                  const b = brushPresets[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectBrush(id)}
                      className={activeBrushId === id ? 'btn-active' : ''}
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '6px 8px',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{b.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        {b.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(activeBrushId === 'mix' || activeBrushId === 'blend') && (
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 11,
                  }}
                >
                  {activeBrushId === 'mix' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 56 }}>絵の具量</span>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={Math.round(currentBrush.mixAmount * 100)}
                        onChange={(e) =>
                          updateCurrentBrushSetting('mixAmount', Number(e.target.value) / 100)
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 30, textAlign: 'right' }}>
                        {Math.round(currentBrush.mixAmount * 100)}%
                      </span>
                    </label>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 56 }}>色伸び</span>
                    <input
                      type="range"
                      min={10}
                      max={96}
                      value={Math.round(currentBrush.colorStretch * 100)}
                      onChange={(e) =>
                        updateCurrentBrushSetting('colorStretch', Number(e.target.value) / 100)
                      }
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 30, textAlign: 'right' }}>
                      {Math.round(currentBrush.colorStretch * 100)}%
                    </span>
                  </label>
                </div>
              )}

              {/* Quick Brush Size Preset Dots */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                {[6, 16, 36, 72, 140].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateCurrentBrushSetting('size', sz)}
                    className={Math.round(currentBrush.size) === sz ? 'btn-active' : ''}
                    style={{ flex: 1, fontSize: 10, padding: '3px 0' }}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </>
          )}

          {flyout === 'eraser' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {eraserIds.map((id) => {
                const er = brushPresets[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectEraser(id)}
                    className={activeEraserId === id ? 'btn-active' : ''}
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '6px 8px',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{er.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                      {er.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {flyout === 'fill' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div>
                <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>境界の参照先：</div>
                <select
                  value={fillReferMode}
                  onChange={(e) => setFillReferMode(e.target.value as FillReferMode)}
                  style={{ width: '100%' }}
                >
                  <option value="reference">参照レイヤー（線画）を参照して下塗り</option>
                  <option value="all">表示中の全レイヤーを参照</option>
                  <option value="active">編集中のレイヤーのみ参照</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 64 }}>色の許容値</span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={fillTolerance}
                  onChange={(e) => setFillTolerance(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: 28, textAlign: 'right' }}>{fillTolerance}</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 64 }} title="線画のアンチエイリアス下に色を潜り込ませ塗り残しを防ぎます">
                  領域拡縮
                </span>
                <input
                  type="range"
                  min={0}
                  max={3}
                  value={fillExpandPx}
                  onChange={(e) => setFillExpandPx(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: 28, textAlign: 'right' }}>+{fillExpandPx}px</span>
              </label>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
