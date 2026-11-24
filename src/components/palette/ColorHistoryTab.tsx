import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useColorStore } from '../../store/useColorStore';

export const ColorHistoryTab: React.FC = () => {
  const colorHistory = useColorStore((s) => s.colorHistory);
  const setColorFromHex = useColorStore((s) => s.setColorFromHex);
  const addCurrentColorToSet = useColorStore((s) => s.addCurrentColorToSet);
  const clearColorHistory = useColorStore((s) => s.clearColorHistory);

  const [columns, setColumns] = useState<6 | 8 | 10>(8);

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
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span>描画に使用した色（新しい順：{colorHistory.length}色）</span>
        <select
          aria-label="履歴タイル列数"
          value={columns}
          onChange={(e) => setColumns(Number(e.target.value) as 6 | 8 | 10)}
          style={{ fontSize: 11, padding: '2px 4px' }}
        >
          <option value={6}>大 (6列)</option>
          <option value={8}>中 (8列)</option>
          <option value={10}>小 (10列)</option>
        </select>
      </div>

      <div className="scroll-y" style={{ flex: 1, minHeight: 80 }}>
        {colorHistory.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 11,
            }}
          >
            キャンバスに描画・塗りつぶしを行うと、実際に塗った色が自動でここへ記録されます。
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: 3,
            }}
          >
            {colorHistory.map((item, idx) => (
              <button
                key={`${item.hex}-${idx}`}
                type="button"
                title={item.hex}
                onClick={() => setColorFromHex(item.hex)}
                style={{
                  aspectRatio: '1 / 1',
                  padding: 0,
                  background: item.hex,
                  border: idx === 0 ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.45)',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 4,
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={addCurrentColorToSet}
          style={{ fontSize: 11, padding: '4px 7px' }}
          title="現在選択中の色をアクティブなカラーセットに追加"
        >
          <Plus size={12} /> 選択色をカラーセットへ保存
        </button>

        <button
          type="button"
          disabled={colorHistory.length === 0}
          onClick={clearColorHistory}
          style={{ fontSize: 11, padding: '4px 7px' }}
        >
          <Trash2 size={12} /> クリア
        </button>
      </div>
    </div>
  );
};
