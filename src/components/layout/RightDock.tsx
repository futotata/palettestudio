import React, { useRef } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { PALETTE_TABS, PaletteTabId, useWorkspaceStore } from '../../store/useWorkspaceStore';
import { LayerPanel } from '../layers/LayerPanel';
import { ApproximateTab } from '../palette/ApproximateTab';
import { ColorCircleTab } from '../palette/ColorCircleTab';
import { ColorHistoryTab } from '../palette/ColorHistoryTab';
import { ColorSetTab } from '../palette/ColorSetTab';
import { ColorSliderTab } from '../palette/ColorSliderTab';
import { ColorSwatchHeader } from '../palette/ColorSwatchHeader';
import { IntermediateTab } from '../palette/IntermediateTab';

const PalettePaneContent: React.FC<{ tab: PaletteTabId; compact?: boolean }> = ({
  tab,
  compact = false,
}) => {
  switch (tab) {
    case 'circle':
      return <ColorCircleTab compact={compact} />;
    case 'slider':
      return <ColorSliderTab />;
    case 'set':
      return <ColorSetTab />;
    case 'approx':
      return <ApproximateTab />;
    case 'intermediate':
      return <IntermediateTab />;
    case 'history':
      return <ColorHistoryTab />;
  }
};

const TabBarStrip: React.FC<{
  active: PaletteTabId;
  onSelect: (tab: PaletteTabId) => void;
  ariaLabel: string;
}> = ({ active, onSelect, ariaLabel }) => (
  <div className="palette-tab-bar" role="tablist" aria-label={ariaLabel}>
    {PALETTE_TABS.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={active === t.id}
        type="button"
        title={t.label}
        onClick={() => onSelect(t.id)}
        className={`palette-tab-btn ${active === t.id ? 'active' : ''}`}
      >
        {t.shortLabel}
      </button>
    ))}
  </div>
);

export const RightDock: React.FC = () => {
  const rightDockOpen = useWorkspaceStore((s) => s.rightDockOpen);
  const rightDockWidth = useWorkspaceStore((s) => s.rightDockWidth);
  const paletteLayout = useWorkspaceStore((s) => s.paletteLayout);
  const singleTab = useWorkspaceStore((s) => s.singleTab);
  const topTab = useWorkspaceStore((s) => s.topTab);
  const bottomTab = useWorkspaceStore((s) => s.bottomTab);
  const layerPanelOpen = useWorkspaceStore((s) => s.layerPanelOpen);

  const setSingleTab = useWorkspaceStore((s) => s.setSingleTab);
  const setTopTab = useWorkspaceStore((s) => s.setTopTab);
  const setBottomTab = useWorkspaceStore((s) => s.setBottomTab);
  const setRightDockWidth = useWorkspaceStore((s) => s.setRightDockWidth);
  const toggleLayerPanel = useWorkspaceStore((s) => s.toggleLayerPanel);

  const layers = useCanvasStore((s) => s.layers);
  const activeLayerId = useCanvasStore((s) => s.activeLayerId);
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const resizeStartRef = useRef<{ startX: number; origWidth: number } | null>(null);

  if (!rightDockOpen) return null;

  return (
    <aside
      aria-label="右側カラーパレット＆レイヤードック"
      style={{
        position: 'relative',
        width: rightDockWidth,
        height: '100%',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 45,
      }}
    >
      {/* Drag Handle on Left Edge to Resize Right Dock Width */}
      <div
        title="ドラッグして右側パレット幅を調整"
        onPointerDown={(e) => {
          resizeStartRef.current = { startX: e.clientX, origWidth: rightDockWidth };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!resizeStartRef.current) return;
          const delta = resizeStartRef.current.startX - e.clientX;
          setRightDockWidth(resizeStartRef.current.origWidth + delta);
        }}
        onPointerUp={(e) => {
          resizeStartRef.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        style={{
          position: 'absolute',
          left: -4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'ew-resize',
          touchAction: 'none',
          zIndex: 10,
        }}
      />

      {/* Persistent Main / Sub / Transparent Color Header + 1-pane / 2-pane Switch */}
      <ColorSwatchHeader />

      {/* Color Palette Area (Single 6-Tab Mode OR 2-Pane Split Mode) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {paletteLayout === 'single' ? (
          <>
            <TabBarStrip
              active={singleTab}
              onSelect={setSingleTab}
              ariaLabel="カラーパレットタブ"
            />
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <PalettePaneContent tab={singleTab} />
            </div>
          </>
        ) : (
          <>
            {/* Upper Pane (e.g., Color Circle pinned) */}
            <div
              style={{
                flex: topTab === 'circle' ? '0 0 218px' : '1 1 48%',
                minHeight: 168,
                display: 'flex',
                flexDirection: 'column',
                borderBottom: '2px solid var(--border-strong)',
                overflow: 'hidden',
              }}
            >
              <TabBarStrip
                active={topTab}
                onSelect={setTopTab}
                ariaLabel="上段カラーパレットタブ"
              />
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <PalettePaneContent tab={topTab} compact />
              </div>
            </div>

            {/* Lower Pane (e.g., Color Set / Approximate / Intermediate / Slider / History) */}
            <div
              style={{
                flex: '1 1 50%',
                minHeight: 140,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <TabBarStrip
                active={bottomTab}
                onSelect={setBottomTab}
                ariaLabel="下段カラーパレットタブ"
              />
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <PalettePaneContent tab={bottomTab} compact />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Collapsible Layer Panel Drawer at Bottom of Right Dock */}
      <div
        style={{
          borderTop: '2px solid var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          height: layerPanelOpen ? 256 : 32,
          flexShrink: 0,
          transition: 'height 0.16s ease',
          background: 'var(--bg-panel)',
        }}
      >
        <button
          type="button"
          onClick={toggleLayerPanel}
          style={{
            width: '100%',
            height: 32,
            borderRadius: 0,
            border: 'none',
            borderBottom: layerPanelOpen ? '1px solid var(--border-color)' : 'none',
            background: 'var(--bg-panel-header)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={13} />
            <span>レイヤー：{activeLayer?.name ?? ''}</span>
          </span>
          {layerPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {layerPanelOpen && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <LayerPanel />
          </div>
        )}
      </div>
    </aside>
  );
};
