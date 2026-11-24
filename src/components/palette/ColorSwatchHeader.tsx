import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Columns2, Square } from 'lucide-react';
import { rgbToHex } from '../../color/colorMath';
import { useColorStore } from '../../store/useColorStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const ColorSwatchHeader: React.FC = () => {
  const mainColor = useColorStore((s) => s.mainColor);
  const subColor = useColorStore((s) => s.subColor);
  const activeSlot = useColorStore((s) => s.activeSlot);
  const setActiveSlot = useColorStore((s) => s.setActiveSlot);
  const swapMainAndSub = useColorStore((s) => s.swapMainAndSub);
  const setColorFromHex = useColorStore((s) => s.setColorFromHex);

  const paletteLayout = useWorkspaceStore((s) => s.paletteLayout);
  const setPaletteLayout = useWorkspaceStore((s) => s.setPaletteLayout);

  const activeModel = activeSlot === 'sub' ? subColor : mainColor;
  const activeHex = rgbToHex(activeModel.r, activeModel.g, activeModel.b);

  const [hexDraft, setHexDraft] = useState(activeHex);

  useEffect(() => {
    setHexDraft(activeHex);
  }, [activeHex]);

  const commitHex = () => {
    if (!setColorFromHex(hexDraft)) {
      setHexDraft(activeHex);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        padding: '6px 8px',
        background: 'var(--bg-panel-header)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}
    >
      {/* CSP-style Main / Sub / Transparent swatches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <button
          type="button"
          title="メインカラー"
          onClick={() => setActiveSlot('main')}
          style={{
            width: 32,
            height: 28,
            padding: 0,
            background: rgbToHex(mainColor.r, mainColor.g, mainColor.b),
            border:
              activeSlot === 'main' ? '2.5px solid #ffffff' : '1px solid var(--border-strong)',
            boxShadow: activeSlot === 'main' ? '0 0 0 1.5px var(--accent)' : 'none',
          }}
        />
        <button
          type="button"
          title="メイン色とサブ色を入れ替え"
          onClick={swapMainAndSub}
          className="btn-icon"
          style={{ width: 24, height: 26, minWidth: 24, minHeight: 26, padding: 2 }}
        >
          <ArrowLeftRight size={13} />
        </button>
        <button
          type="button"
          title="サブカラー"
          onClick={() => setActiveSlot('sub')}
          style={{
            width: 28,
            height: 28,
            padding: 0,
            background: rgbToHex(subColor.r, subColor.g, subColor.b),
            border:
              activeSlot === 'sub' ? '2.5px solid #ffffff' : '1px solid var(--border-strong)',
            boxShadow: activeSlot === 'sub' ? '0 0 0 1.5px var(--accent)' : 'none',
          }}
        />
        <button
          type="button"
          title="透明色（現在のブラシ形状のまま消しゴム描画）"
          onClick={() => setActiveSlot(activeSlot === 'transparent' ? 'main' : 'transparent')}
          className="checkerboard"
          style={{
            width: 28,
            height: 28,
            padding: 0,
            border:
              activeSlot === 'transparent'
                ? '2.5px solid #ffffff'
                : '1px solid var(--border-strong)',
            boxShadow: activeSlot === 'transparent' ? '0 0 0 1.5px var(--accent)' : 'none',
            position: 'relative',
          }}
        >
          {activeSlot === 'transparent' && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                background: 'rgba(0,0,0,0.68)',
                color: '#fff',
                padding: '0 2px',
                borderRadius: 2,
              }}
            >
              透明
            </span>
          )}
        </button>
      </div>

      {/* HEX input */}
      <input
        type="text"
        aria-label="HEXカラーコード"
        value={hexDraft}
        onChange={(e) => setHexDraft(e.target.value)}
        onBlur={commitHex}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitHex();
            (e.target as HTMLInputElement).blur();
          }
        }}
        style={{
          width: 74,
          fontFamily: 'monospace',
          fontSize: 12,
          textAlign: 'center',
          padding: '3px 4px',
        }}
      />

      {/* 1-pane vs 2-pane vertical split toggle */}
      <button
        type="button"
        title={
          paletteLayout === 'split'
            ? 'パレット表示：上下2段ドック中（タップで1段表示に切替）'
            : 'パレット表示：1段タブ中（タップで上下2段表示に切替）'
        }
        onClick={() => setPaletteLayout(paletteLayout === 'split' ? 'single' : 'split')}
        className={paletteLayout === 'split' ? 'btn-active' : ''}
        style={{ padding: '4px 6px', fontSize: 11 }}
      >
        {paletteLayout === 'split' ? <Columns2 size={13} /> : <Square size={13} />}
        <span>{paletteLayout === 'split' ? '2段' : '1段'}</span>
      </button>
    </div>
  );
};
