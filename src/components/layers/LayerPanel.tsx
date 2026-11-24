import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerDownRight,
  Eraser,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Merge,
  Plus,
  RadioTower,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BLEND_MODE_OPTIONS, LayerBlendMode, LayerItem } from '../../engine/compositor';
import { useCanvasStore } from '../../store/useCanvasStore';

const LayerThumb: React.FC<{ layer: LayerItem; version: number }> = ({ layer, version }) => {
  const thumbRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = thumbRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(layer.canvas, 0, 0, c.width, c.height);
  }, [layer.canvas, version]);

  return (
    <canvas
      ref={thumbRef}
      width={36}
      height={27}
      className="checkerboard"
      style={{
        width: 36,
        height: 27,
        borderRadius: 3,
        border: '1px solid var(--border-strong)',
        flexShrink: 0,
      }}
    />
  );
};

export const LayerPanel: React.FC = () => {
  const layers = useCanvasStore((s) => s.layers);
  const activeLayerId = useCanvasStore((s) => s.activeLayerId);
  const compositeVersion = useCanvasStore((s) => s.compositeVersion);

  const selectLayer = useCanvasStore((s) => s.selectLayer);
  const addLayer = useCanvasStore((s) => s.addLayer);
  const deleteLayer = useCanvasStore((s) => s.deleteLayer);
  const duplicateLayer = useCanvasStore((s) => s.duplicateLayer);
  const clearLayer = useCanvasStore((s) => s.clearLayer);
  const mergeLayerDown = useCanvasStore((s) => s.mergeLayerDown);
  const moveLayer = useCanvasStore((s) => s.moveLayer);
  const renameLayer = useCanvasStore((s) => s.renameLayer);
  const toggleLayerVisible = useCanvasStore((s) => s.toggleLayerVisible);
  const setLayerOpacity = useCanvasStore((s) => s.setLayerOpacity);
  const setLayerBlendMode = useCanvasStore((s) => s.setLayerBlendMode);
  const toggleLayerClipped = useCanvasStore((s) => s.toggleLayerClipped);
  const toggleLayerAlphaLock = useCanvasStore((s) => s.toggleLayerAlphaLock);
  const toggleLayerReference = useCanvasStore((s) => s.toggleLayerReference);
  const convertActiveLayerBrightnessToOpacity = useCanvasStore(
    (s) => s.convertActiveLayerBrightnessToOpacity
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  const activeIndex = layers.findIndex((l) => l.id === activeLayer?.id);

  // Display top-to-bottom (matching CLIP STUDIO PAINT layer stack)
  const displayLayers = [...layers].reverse();

  if (!activeLayer) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '6px 8px',
        gap: 6,
      }}
    >
      {/* Blend Mode + Opacity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <select
          aria-label="レイヤー合成モード"
          value={activeLayer.blendMode}
          onChange={(e) => setLayerBlendMode(activeLayer.id, e.target.value as LayerBlendMode)}
          style={{ width: 122, fontSize: 11, padding: '3px 4px' }}
        >
          {BLEND_MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(activeLayer.opacity * 100)}
          onChange={(e) => setLayerOpacity(activeLayer.id, Number(e.target.value) / 100)}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
          title="レイヤー不透明度"
        />
        <span style={{ width: 32, textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>
          {Math.round(activeLayer.opacity * 100)}%
        </span>
      </div>

      {/* CSP Layer Attribute Toggles: Clipping, Alpha Lock, Reference Layer, Brightness->Opacity */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'nowrap', flexShrink: 0 }}>
        <button
          type="button"
          title="下のレイヤーでクリッピング（下塗りの外にはみ出さず影・光を塗る）"
          onClick={() => toggleLayerClipped(activeLayer.id)}
          className={activeLayer.clipped ? 'btn-active' : ''}
          style={{ flex: 1, fontSize: 10, padding: '3px 4px', whiteSpace: 'nowrap' }}
        >
          <CornerDownRight size={11} /> クリップ
        </button>

        <button
          type="button"
          title="透明ピクセルをロック（既に塗った部分の中だけ色を変える）"
          onClick={() => toggleLayerAlphaLock(activeLayer.id)}
          className={activeLayer.alphaLock ? 'btn-active' : ''}
          style={{ flex: 1, fontSize: 10, padding: '3px 4px', whiteSpace: 'nowrap' }}
        >
          <Lock size={11} /> 透明ロック
        </button>

        <button
          type="button"
          title="参照レイヤーに設定（線画レイヤーに指定すると別レイヤーからバケツ下塗り可能）"
          onClick={() => toggleLayerReference(activeLayer.id)}
          className={activeLayer.isReference ? 'btn-active' : ''}
          style={{ fontSize: 10, padding: '3px 5px', whiteSpace: 'nowrap' }}
        >
          <RadioTower size={11} /> 参照
        </button>

        <button
          type="button"
          title="輝度を透明度に変換（白背景の線画をワンタップで透明化）"
          onClick={convertActiveLayerBrightnessToOpacity}
          style={{ fontSize: 10, padding: '3px 5px', whiteSpace: 'nowrap' }}
        >
          <Sparkles size={11} /> 白→透明
        </button>
      </div>

      {/* Layer Stack List */}
      <div className="scroll-y" style={{ flex: 1, minHeight: 92 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {displayLayers.map((layer) => {
            const isSelected = layer.id === activeLayer.id;
            const blendLabel =
              BLEND_MODE_OPTIONS.find((b) => b.value === layer.blendMode)?.label.split(' ')[0] ??
              '通常';
            const sideBorder = isSelected
              ? '1px solid var(--accent)'
              : '1px solid var(--border-color)';

            return (
              <div
                key={layer.id}
                onClick={() => selectLayer(layer.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 6px',
                  borderRadius: 4,
                  background: isSelected ? 'var(--accent-soft)' : 'var(--bg-input)',
                  borderTop: sideBorder,
                  borderRight: sideBorder,
                  borderBottom: sideBorder,
                  // CSP-style coral/pink left indicator bar when Clipped!
                  borderLeft: layer.clipped ? '4px solid #ff6b8b' : sideBorder,
                  paddingLeft: layer.clipped ? 10 : 6,
                  cursor: 'pointer',
                }}
              >
                <button
                  type="button"
                  title={layer.visible ? 'レイヤーを非表示' : 'レイヤーを表示'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisible(layer.id);
                  }}
                  style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    minWidth: 24,
                    background: 'transparent',
                    border: 'none',
                  }}
                >
                  {layer.visible ? (
                    <Eye size={14} />
                  ) : (
                    <EyeOff size={14} color="var(--text-muted)" />
                  )}
                </button>

                <LayerThumb layer={layer} version={compositeVersion} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === layer.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={nameDraft}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => {
                        renameLayer(layer.id, nameDraft);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameLayer(layer.id, nameDraft);
                          setEditingId(null);
                        }
                      }}
                      style={{ width: '100%', fontSize: 11, padding: '1px 4px' }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(layer.id);
                        setNameDraft(layer.name);
                      }}
                      title="ダブルタップで名前変更"
                      style={{
                        fontSize: 11,
                        fontWeight: isSelected ? 600 : 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {layer.name}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      fontSize: 9.5,
                      color: 'var(--text-secondary)',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      {blendLabel} {Math.round(layer.opacity * 100)}%
                    </span>
                    {layer.isReference && (
                      <span
                        style={{
                          background: 'rgba(245, 185, 66, 0.22)',
                          color: '#ffd166',
                          padding: '0 4px',
                          borderRadius: 2,
                        }}
                      >
                        参照
                      </span>
                    )}
                    {layer.alphaLock && (
                      <span
                        style={{
                          background: 'rgba(255, 255, 255, 0.14)',
                          padding: '0 4px',
                          borderRadius: 2,
                        }}
                      >
                        ロック
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Layer Operations Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          paddingTop: 4,
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 3 }}>
          <button
            type="button"
            title="通常レイヤーを追加"
            onClick={() => addLayer()}
            style={{ padding: '4px 6px', fontSize: 10 }}
          >
            <Plus size={12} /> 追加
          </button>
          <button
            type="button"
            title="クリッピング乗算レイヤー（影塗り用）を上に追加"
            onClick={() =>
              addLayer({ name: '影レイヤー (乗算)', clipped: true, blendMode: 'multiply' })
            }
            style={{ padding: '4px 6px', fontSize: 10 }}
          >
            <Layers size={12} /> +影
          </button>
          <button
            type="button"
            title="レイヤーを複製"
            onClick={() => duplicateLayer(activeLayer.id)}
            className="btn-icon"
            style={{ minWidth: 25, minHeight: 25 }}
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            title="下のレイヤーと結合"
            disabled={activeIndex <= 0}
            onClick={() => mergeLayerDown(activeLayer.id)}
            className="btn-icon"
            style={{ minWidth: 25, minHeight: 25 }}
          >
            <Merge size={12} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 3 }}>
          <button
            type="button"
            title="レイヤーを1つ上へ移動"
            disabled={activeIndex >= layers.length - 1}
            onClick={() => moveLayer(activeLayer.id, 'up')}
            className="btn-icon"
            style={{ minWidth: 25, minHeight: 25 }}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            title="レイヤーを1つ下へ移動"
            disabled={activeIndex <= 0}
            onClick={() => moveLayer(activeLayer.id, 'down')}
            className="btn-icon"
            style={{ minWidth: 25, minHeight: 25 }}
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            title="現在のレイヤーの描画内容を消去"
            onClick={() => clearLayer(activeLayer.id)}
            className="btn-icon"
            style={{ minWidth: 25, minHeight: 25 }}
          >
            <Eraser size={12} />
          </button>
          <button
            type="button"
            title="レイヤーを削除"
            disabled={layers.length <= 1}
            onClick={() => deleteLayer(activeLayer.id)}
            className="btn-icon"
            style={{ minWidth: 25, minHeight: 25 }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
