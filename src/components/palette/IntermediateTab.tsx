import React, { useMemo } from 'react';
import { PaintBucket, X } from 'lucide-react';
import { rgbToHex } from '../../color/colorMath';
import { generateIntermediateGrid } from '../../color/intermediateColor';
import { useColorStore } from '../../store/useColorStore';

const CORNER_LABELS = ['左上', '右上', '左下', '右下'] as const;

export const IntermediateTab: React.FC = () => {
  const intermediateCorners = useColorStore((s) => s.intermediateCorners);
  const intermediateGridSize = useColorStore((s) => s.intermediateGridSize);
  const intermediateMixSpace = useColorStore((s) => s.intermediateMixSpace);

  const setIntermediateCornerToCurrent = useColorStore((s) => s.setIntermediateCornerToCurrent);
  const clearIntermediateCorner = useColorStore((s) => s.clearIntermediateCorner);
  const setIntermediateGridSize = useColorStore((s) => s.setIntermediateGridSize);
  const setIntermediateMixSpace = useColorStore((s) => s.setIntermediateMixSpace);
  const setColorFromRgba = useColorStore((s) => s.setColorFromRgba);

  const grid = useMemo(
    () =>
      generateIntermediateGrid(
        intermediateCorners,
        intermediateGridSize,
        intermediateMixSpace
      ),
    [intermediateCorners, intermediateGridSize, intermediateMixSpace]
  );

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
      {/* 4 Corner Anchor Setters (designed for tablet stylus where hover is unavailable) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 4,
          flexShrink: 0,
        }}
      >
        {([0, 1, 2, 3] as const).map((idx) => {
          const corner = intermediateCorners[idx];
          const hex = corner ? rgbToHex(corner.r, corner.g, corner.b) : null;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: 'var(--bg-panel-header)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                padding: 2,
              }}
            >
              <button
                type="button"
                title={`${CORNER_LABELS[idx]}に現在の描画色をセット`}
                onClick={() => setIntermediateCornerToCurrent(idx)}
                style={{
                  flex: 1,
                  padding: '3px 2px',
                  fontSize: 10,
                  background: hex ?? 'transparent',
                  color: corner && corner.r + corner.g + corner.b > 390 ? '#111' : '#fff',
                  textShadow: corner ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <PaintBucket size={10} />
                <span>{CORNER_LABELS[idx]}</span>
              </button>
              {corner && (
                <button
                  type="button"
                  title={`${CORNER_LABELS[idx]}の基準色をクリア`}
                  onClick={() => clearIntermediateCorner(idx)}
                  style={{ width: 18, height: 22, padding: 0, minWidth: 18 }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Interpolated Intermediate Grid */}
      <div
        style={{
          flex: 1,
          minHeight: 120,
          display: 'grid',
          gridTemplateColumns: `repeat(${intermediateGridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${intermediateGridSize}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {grid.flatMap((row) =>
          row.map((cell) => {
            const isCorner = cell.cornerIndex !== null;
            return (
              <button
                key={`${cell.row}-${cell.col}`}
                type="button"
                disabled={!cell.rgba}
                title={
                  isCorner && cell.cornerIndex !== null
                    ? `${CORNER_LABELS[cell.cornerIndex]}基準色 (${cell.hex ?? '未設定'})`
                    : cell.hex ?? ''
                }
                onClick={() => {
                  if (cell.rgba) setColorFromRgba(cell.rgba);
                }}
                style={{
                  padding: 0,
                  background: cell.hex ?? 'rgba(0,0,0,0.2)',
                  border: isCorner
                    ? '2px solid rgba(255,255,255,0.9)'
                    : '1px solid rgba(0,0,0,0.35)',
                  borderRadius: 2,
                }}
              />
            );
          })
        )}
      </div>

      {/* Mix space & division controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 3 }}>
          <button
            type="button"
            title="補色同士でも灰色に濁りにくい知覚的混色"
            onClick={() => setIntermediateMixSpace('oklab')}
            className={intermediateMixSpace === 'oklab' ? 'btn-active' : ''}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            自然混色 (Oklab)
          </button>
          <button
            type="button"
            title="クリスタ標準のRGB線形補間"
            onClick={() => setIntermediateMixSpace('rgb')}
            className={intermediateMixSpace === 'rgb' ? 'btn-active' : ''}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            RGB標準
          </button>
        </div>

        <select
          aria-label="中間色 グリッド分割数"
          value={intermediateGridSize}
          onChange={(e) => setIntermediateGridSize(Number(e.target.value))}
          style={{ fontSize: 11, padding: '2px 5px' }}
        >
          <option value={5}>5×5</option>
          <option value={7}>7×7</option>
          <option value={9}>9×9</option>
          <option value={11}>11×11</option>
        </select>
      </div>
    </div>
  );
};
