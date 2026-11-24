import React, { useMemo } from 'react';
import { Lock, Unlock } from 'lucide-react';
import {
  APPROXIMATE_AXIS_LABELS,
  ApproximateAxis,
  generateApproximateGrid,
} from '../../color/approximateColor';
import { useColorStore } from '../../store/useColorStore';

const AXES: ApproximateAxis[] = ['H', 'S', 'V', 'L', 'R', 'G', 'B'];

export const ApproximateTab: React.FC = () => {
  const mainColor = useColorStore((s) => s.mainColor);
  const subColor = useColorStore((s) => s.subColor);
  const activeSlot = useColorStore((s) => s.activeSlot);
  const lastOpaqueSlot = useColorStore((s) => s.lastOpaqueSlot);

  const approxXAxis = useColorStore((s) => s.approxXAxis);
  const approxYAxis = useColorStore((s) => s.approxYAxis);
  const approxRange = useColorStore((s) => s.approxRange);
  const approxGridSize = useColorStore((s) => s.approxGridSize);
  const approxPinned = useColorStore((s) => s.approxPinned);
  const approxLockedBase = useColorStore((s) => s.approxLockedBase);

  const setApproxAxes = useColorStore((s) => s.setApproxAxes);
  const setApproxRange = useColorStore((s) => s.setApproxRange);
  const setApproxGridSize = useColorStore((s) => s.setApproxGridSize);
  const toggleApproxPin = useColorStore((s) => s.toggleApproxPin);
  const setColorFromRgba = useColorStore((s) => s.setColorFromRgba);

  const liveColor =
    (activeSlot === 'transparent' ? lastOpaqueSlot : activeSlot) === 'sub' ? subColor : mainColor;
  const centerModel = approxPinned && approxLockedBase ? approxLockedBase : liveColor;

  const grid = useMemo(
    () =>
      generateApproximateGrid(
        centerModel,
        approxXAxis,
        approxYAxis,
        approxRange,
        approxGridSize
      ),
    [centerModel, approxXAxis, approxYAxis, approxRange, approxGridSize]
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
      {/* Quick coloring-practice presets */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setApproxAxes('S', 'V')}
          className={approxXAxis === 'S' && approxYAxis === 'V' ? 'btn-active' : ''}
          style={{ fontSize: 10, padding: '2px 6px' }}
        >
          彩度×明度
        </button>
        <button
          type="button"
          onClick={() => setApproxAxes('H', 'V')}
          className={approxXAxis === 'H' && approxYAxis === 'V' ? 'btn-active' : ''}
          style={{ fontSize: 10, padding: '2px 6px' }}
          title="色相ずらし影・ハイライト選びに最適"
        >
          色相×明度 (影選び)
        </button>
        <button
          type="button"
          onClick={() => setApproxAxes('H', 'L')}
          className={approxXAxis === 'H' && approxYAxis === 'L' ? 'btn-active' : ''}
          style={{ fontSize: 10, padding: '2px 6px' }}
        >
          色相×輝度
        </button>

        <button
          type="button"
          title={
            approxPinned
              ? '基準色をピン留め中（色を拾ってもマトリクスがずれません）'
              : '現在の色を基準にピン留めする'
          }
          onClick={toggleApproxPin}
          className={approxPinned ? 'btn-active' : ''}
          style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 6px' }}
        >
          {approxPinned ? <Lock size={11} /> : <Unlock size={11} />}
          <span>{approxPinned ? '基準固定中' : '基準固定'}</span>
        </button>
      </div>

      {/* Custom X / Y Axis Selectors + Grid size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, flexShrink: 0 }}>
        <span style={{ color: 'var(--text-secondary)' }}>横:</span>
        <select
          aria-label="近似色 横軸"
          value={approxXAxis}
          onChange={(e) => setApproxAxes(e.target.value as ApproximateAxis, approxYAxis)}
          style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
        >
          {AXES.map((ax) => (
            <option key={ax} value={ax}>
              {APPROXIMATE_AXIS_LABELS[ax]}
            </option>
          ))}
        </select>

        <span style={{ color: 'var(--text-secondary)' }}>縦:</span>
        <select
          aria-label="近似色 縦軸"
          value={approxYAxis}
          onChange={(e) => setApproxAxes(approxXAxis, e.target.value as ApproximateAxis)}
          style={{ flex: 1, fontSize: 11, padding: '2px 4px' }}
        >
          {AXES.map((ax) => (
            <option key={ax} value={ax}>
              {APPROXIMATE_AXIS_LABELS[ax]}
            </option>
          ))}
        </select>

        <select
          aria-label="近似色 分割数"
          value={approxGridSize}
          onChange={(e) => setApproxGridSize(Number(e.target.value) as 5 | 7 | 9)}
          style={{ fontSize: 11, padding: '2px 4px' }}
        >
          <option value={5}>5×5</option>
          <option value={7}>7×7</option>
          <option value={9}>9×9</option>
        </select>
      </div>

      {/* Matrix Grid */}
      <div
        style={{
          flex: 1,
          minHeight: 120,
          display: 'grid',
          gridTemplateColumns: `repeat(${approxGridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${approxGridSize}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {grid.flatMap((row) =>
          row.map((cell) => (
            <button
              key={`${cell.row}-${cell.col}`}
              type="button"
              title={cell.isCenter ? `基準色 (${cell.hex})` : cell.hex}
              onClick={() => setColorFromRgba(cell.rgba)}
              style={{
                padding: 0,
                background: cell.hex,
                border: cell.isCenter ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.35)',
                boxShadow: cell.isCenter ? 'inset 0 0 0 1.5px #000000' : 'none',
                borderRadius: 2,
              }}
            />
          ))
        )}
      </div>

      {/* Variation step range slider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>変化幅</span>
        <input
          type="range"
          min={6}
          max={100}
          value={approxRange}
          onChange={(e) => setApproxRange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ width: 34, textAlign: 'right', fontFamily: 'monospace' }}>
          {approxRange}%
        </span>
      </div>
    </div>
  );
};
