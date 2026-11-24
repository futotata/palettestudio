import React, { useRef, useState } from 'react';
import {
  Download,
  FilePlus2,
  Image as ImageIcon,
  ImagePlus,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  RotateCcw,
} from 'lucide-react';
import { SAMPLE_TEMPLATES, SampleTemplateId } from '../../engine/lineArtProcessor';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const TopMenuBar: React.FC = () => {
  const zoom = useCanvasStore((s) => s.zoom);
  const rotationDeg = useCanvasStore((s) => s.rotationDeg);
  const resetRotation = useCanvasStore((s) => s.resetRotation);
  const initDefaultDocument = useCanvasStore((s) => s.initDefaultDocument);
  const importLineArtImage = useCanvasStore((s) => s.importLineArtImage);
  const exportPngDataUrl = useCanvasStore((s) => s.exportPngDataUrl);
  const fitViewport = useCanvasStore((s) => s.fitViewport);

  const rightDockOpen = useWorkspaceStore((s) => s.rightDockOpen);
  const toggleRightDock = useWorkspaceStore((s) => s.toggleRightDock);
  const subViewOpen = useWorkspaceStore((s) => s.subViewOpen);
  const toggleSubView = useWorkspaceStore((s) => s.toggleSubView);
  const penOnlyMode = useWorkspaceStore((s) => s.penOnlyMode);
  const setPenOnlyMode = useWorkspaceStore((s) => s.setPenOnlyMode);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [lineArtModalOpen, setLineArtModalOpen] = useState(false);
  const [convertWhite, setConvertWhite] = useState(true);
  const [markAsRef, setMarkAsRef] = useState(true);
  const [canvasPreset, setCanvasPreset] = useState<'1440x1080' | '1600x1200' | '1200x1600'>(
    '1440x1080'
  );

  const lineArtInputRef = useRef<HTMLInputElement | null>(null);

  const parseSize = () => {
    const [w, h] = canvasPreset.split('x').map(Number);
    return { w, h };
  };

  const startTemplate = (tpl: SampleTemplateId | null) => {
    const { w, h } = parseSize();
    initDefaultDocument(tpl, w, h);
    setTimeout(() => fitViewport(window.innerWidth - 390, window.innerHeight - 48), 20);
    setTemplateModalOpen(false);
  };

  const handleLineArtSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importLineArtImage(file, {
      convertWhiteToTransparent: convertWhite,
      setAsReference: markAsRef,
    });
    e.target.value = '';
    setLineArtModalOpen(false);
  };

  const handleSavePng = () => {
    const dataUrl = exportPngDataUrl();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `palette-practice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <header
      style={{
        height: 40,
        background: 'var(--bg-panel-header)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        gap: 8,
        flexShrink: 0,
        zIndex: 60,
      }}
    >
      {/* Left: App Brand + Practice Templates + Line Art Import + SubView */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13, marginRight: 4, letterSpacing: 0.3 }}>
          Palette Studio
        </span>

        <button
          type="button"
          onClick={() => setTemplateModalOpen(true)}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          <FilePlus2 size={13} /> 練習線画 / 新規
        </button>

        <button
          type="button"
          onClick={() => setLineArtModalOpen(true)}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          <ImagePlus size={13} /> 線画読込
        </button>

        <button
          type="button"
          onClick={toggleSubView}
          className={subViewOpen ? 'btn-active' : ''}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          <ImageIcon size={13} /> サブビュー
        </button>
      </div>

      {/* Center: Zoom & Rotation status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          {Math.round(zoom * 100)}%
        </span>
        {Math.abs(rotationDeg) > 0.5 && (
          <button
            type="button"
            title="回転角度を0°にリセット"
            onClick={resetRotation}
            style={{ fontSize: 10, padding: '2px 6px' }}
          >
            <RotateCcw size={11} /> {Math.round(rotationDeg)}°
          </button>
        )}
      </div>

      {/* Right: Palm Rejection Mode + PNG Save + Right Palette Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          title={
            penOnlyMode
              ? 'ペン専用描画ON（1本指タッチの誤描画を防止中。2本指で移動/拡大縮小）'
              : '指・マウスでも描画可能（Sペン使用時はONにするとパームリジェクションが効きます）'
          }
          onClick={() => setPenOnlyMode(!penOnlyMode)}
          className={penOnlyMode ? 'btn-active' : ''}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          <PenTool size={13} />
          <span>{penOnlyMode ? 'ペン専用ON' : '指・ペン併用'}</span>
        </button>

        <button
          type="button"
          onClick={handleSavePng}
          className="btn-primary"
          style={{ fontSize: 11, padding: '4px 9px' }}
        >
          <Download size={13} /> PNG保存
        </button>

        <button
          type="button"
          title={rightDockOpen ? '右側パレットを折りたたむ' : '右側パレットを開く'}
          onClick={toggleRightDock}
          className="btn-icon"
        >
          {rightDockOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
        </button>
      </div>

      {/* Practice Template / New Canvas Modal */}
      {templateModalOpen && (
        <div className="modal-backdrop" onClick={() => setTemplateModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 600,
              }}
            >
              <span>練習用サンプル線画・新規キャンバス</span>
              <button type="button" onClick={() => setTemplateModalOpen(false)}>
                閉じる
              </button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  キャンバスサイズ：
                </span>
                <select
                  value={canvasPreset}
                  onChange={(e) => setCanvasPreset(e.target.value as typeof canvasPreset)}
                >
                  <option value="1440x1080">横長 1440 × 1080 px (4:3 タブレット標準)</option>
                  <option value="1600x1200">横長 1600 × 1200 px (高精細)</option>
                  <option value="1200x1600">縦長 1200 × 1600 px (ポートレート)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SAMPLE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => startTemplate(tpl.id)}
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{tpl.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {tpl.description}（下塗りベース＋クリッピング乗算影＋参照線画の3層構成）
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => startTemplate(null)}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>白紙キャンバスで始める</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    線画なしの初期レイヤー構成を作成します
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Line-Art Image Import Modal */}
      {lineArtModalOpen && (
        <div className="modal-backdrop" onClick={() => setLineArtModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 600,
              }}
            >
              <span>線画画像の読み込み</span>
              <button type="button" onClick={() => setLineArtModalOpen(false)}>
                閉じる
              </button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={convertWhite}
                  onChange={(e) => setConvertWhite(e.target.checked)}
                />
                <span>
                  白背景を透明に変換する（クリスタの「輝度を透明度に変換」相当・白いフチ残り防止）
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={markAsRef}
                  onChange={(e) => setMarkAsRef(e.target.checked)}
                />
                <span>
                  「参照レイヤー」に設定する（下のレイヤーから線画内をバケツで塗り分け可能）
                </span>
              </label>

              <input
                ref={lineArtInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLineArtSelected}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setLineArtModalOpen(false)}>
                  キャンセル
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => lineArtInputRef.current?.click()}
                >
                  <ImagePlus size={14} /> 画像ファイルを選択
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
