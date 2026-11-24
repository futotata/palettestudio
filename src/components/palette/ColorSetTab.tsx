import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Edit3,
  List,
  Plus,
  RefreshCw,
  SquareDashed,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ColorSet,
  parseColorSetsFromJson,
  serializeColorSetsToJson,
} from '../../color/colorSetSchema';
import { useColorStore } from '../../store/useColorStore';

export const ColorSetTab: React.FC = () => {
  const colorSets = useColorStore((s) => s.colorSets);
  const activeColorSetId = useColorStore((s) => s.activeColorSetId);
  const selectedSwatchIndex = useColorStore((s) => s.selectedSwatchIndex);

  const selectColorSet = useColorStore((s) => s.selectColorSet);
  const setSelectedSwatchIndex = useColorStore((s) => s.setSelectedSwatchIndex);
  const setColorFromHex = useColorStore((s) => s.setColorFromHex);
  const toggleFavoriteColorSet = useColorStore((s) => s.toggleFavoriteColorSet);
  const createColorSet = useColorStore((s) => s.createColorSet);
  const duplicateColorSet = useColorStore((s) => s.duplicateColorSet);
  const renameColorSet = useColorStore((s) => s.renameColorSet);
  const deleteColorSet = useColorStore((s) => s.deleteColorSet);
  const setColorSetColumns = useColorStore((s) => s.setColorSetColumns);
  const addCurrentColorToSet = useColorStore((s) => s.addCurrentColorToSet);
  const replaceSwatchWithCurrent = useColorStore((s) => s.replaceSwatchWithCurrent);
  const addSpacerToSet = useColorStore((s) => s.addSpacerToSet);
  const removeSwatchFromSet = useColorStore((s) => s.removeSwatchFromSet);
  const renameSwatchInSet = useColorStore((s) => s.renameSwatchInSet);
  const importColorSets = useColorStore((s) => s.importColorSets);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [manageOpen, setManageOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [renamingSet, setRenamingSet] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [swatchNameDraft, setSwatchNameDraft] = useState('');
  const [editingSwatchName, setEditingSwatchName] = useState(false);

  // JSON Modal state
  const [jsonModal, setJsonModal] = useState<'export' | 'import' | null>(null);
  const [exportScope, setExportScope] = useState<'current' | 'favorites' | 'all'>('current');
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSet: ColorSet = useMemo(
    () => colorSets.find((cs) => cs.id === activeColorSetId) ?? colorSets[0],
    [colorSets, activeColorSetId]
  );

  const favoriteSets = useMemo(() => colorSets.filter((cs) => cs.favorite), [colorSets]);

  const sortedSets = useMemo(() => {
    const favs = colorSets.filter((cs) => cs.favorite);
    const others = colorSets.filter((cs) => !cs.favorite);
    return [...favs, ...others];
  }, [colorSets]);

  const exportSetsList = useMemo(() => {
    if (exportScope === 'current') return activeSet ? [activeSet] : [];
    if (exportScope === 'favorites') {
      return favoriteSets.length > 0 ? favoriteSets : [activeSet];
    }
    return colorSets;
  }, [exportScope, activeSet, favoriteSets, colorSets]);

  const exportJsonString = useMemo(
    () => serializeColorSetsToJson(exportSetsList),
    [exportSetsList]
  );

  const handleDownloadJson = () => {
    const blob = new Blob([exportJsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName =
      exportScope === 'current'
        ? activeSet.name.replace(/[\\/:*?"<>|]/g, '_')
        : exportScope === 'favorites'
          ? 'favorite-colorsets'
          : 'all-colorsets';
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportJsonString);
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 1800);
    } catch {
      // Clipboard blocked fallback
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    const res = parseColorSetsFromJson(text);
    if (res.ok) {
      const totalColors = res.sets.reduce(
        (acc, s) => acc + s.swatches.filter((sw) => sw !== null).length,
        0
      );
      setImportStatus({
        ok: true,
        msg: `検証OK：${res.sets.length}件のカラーセット（計${totalColors}色）を読み込めます。`,
      });
    } else {
      setImportStatus({ ok: false, msg: res.error ?? '不正なJSONです。' });
    }
    e.target.value = '';
  };

  const executeImport = () => {
    const res = parseColorSetsFromJson(importText);
    if (!res.ok) {
      setImportStatus({ ok: false, msg: res.error ?? 'JSONの解析に失敗しました。' });
      return;
    }
    importColorSets(res.sets, importMode);
    setJsonModal(null);
    setImportText('');
    setImportStatus(null);
  };

  const selectedSwatch =
    selectedSwatchIndex !== null ? activeSet?.swatches[selectedSwatchIndex] ?? null : null;

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
      {/* Quick Chips for Favorite ("よく使う") Color Sets */}
      {favoriteSets.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            paddingBottom: 2,
            flexShrink: 0,
          }}
        >
          {favoriteSets.map((fs) => (
            <button
              key={fs.id}
              type="button"
              onClick={() => selectColorSet(fs.id)}
              className={fs.id === activeSet.id ? 'btn-active' : ''}
              style={{
                padding: '2px 7px',
                fontSize: 10,
                borderRadius: 12,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title="よく使うカラーセットへワンタップ切替"
            >
              <Star size={10} fill="#f5b942" color="#f5b942" />
              <span>{fs.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Color Set Selector + Favorite Toggle + Manage / JSON buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <select
          aria-label="カラーセット選択"
          value={activeSet.id}
          onChange={(e) => selectColorSet(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            height: 28,
            fontSize: 11.5,
            padding: '2px 5px',
            whiteSpace: 'nowrap',
          }}
        >
          {sortedSets.map((cs) => (
            <option key={cs.id} value={cs.id}>
              {cs.favorite ? `★ ${cs.name}` : cs.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          title={
            activeSet.favorite
              ? 'よく使うカラーセット登録を解除'
              : 'よく使うカラーセット（お気に入り★）に登録'
          }
          onClick={() => toggleFavoriteColorSet(activeSet.id)}
          className="btn-icon"
          style={{ minWidth: 28, minHeight: 28 }}
        >
          <Star
            size={14}
            fill={activeSet.favorite ? '#f5b942' : 'none'}
            color={activeSet.favorite ? '#f5b942' : 'var(--text-secondary)'}
          />
        </button>

        <button
          type="button"
          title="セットの新規作成・名前変更・複製・列数設定"
          onClick={() => {
            setManageOpen((v) => !v);
            setRenameDraft(activeSet.name);
          }}
          className={manageOpen ? 'btn-active' : ''}
          style={{ padding: '4px 6px', fontSize: 11 }}
        >
          管理
        </button>

        <button
          type="button"
          title="JSON形式で書き出し"
          onClick={() => setJsonModal('export')}
          className="btn-icon"
          style={{ minWidth: 28, minHeight: 28 }}
        >
          <Download size={14} />
        </button>

        <button
          type="button"
          title="JSON形式から読み込み"
          onClick={() => {
            setImportStatus(null);
            setJsonModal('import');
          }}
          className="btn-icon"
          style={{ minWidth: 28, minHeight: 28 }}
        >
          <Upload size={14} />
        </button>
      </div>

      {/* Collapsible Set Management Drawer */}
      {manageOpen && (
        <div
          style={{
            background: 'var(--bg-panel-header)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {/* Create new set */}
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              placeholder="新しいカラーセット名..."
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              style={{ flex: 1, fontSize: 11 }}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                createColorSet(newSetName || `マイセット ${colorSets.length + 1}`);
                setNewSetName('');
              }}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              <Plus size={12} /> 新規登録
            </button>
          </div>

          {/* Rename / Duplicate / Delete / Columns */}
          {renamingSet ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                style={{ flex: 1, fontSize: 11 }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  renameColorSet(activeSet.id, renameDraft);
                  setRenamingSet(false);
                }}
                style={{ fontSize: 11 }}
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setRenamingSet(false)}
                style={{ fontSize: 11 }}
              >
                取消
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setRenameDraft(activeSet.name);
                  setRenamingSet(true);
                }}
                style={{ fontSize: 11 }}
              >
                <Edit3 size={11} /> 名前変更
              </button>
              <button
                type="button"
                onClick={() => duplicateColorSet(activeSet.id)}
                style={{ fontSize: 11 }}
              >
                <Copy size={11} /> 複製
              </button>
              <button
                type="button"
                disabled={colorSets.length <= 1}
                onClick={() => deleteColorSet(activeSet.id)}
                style={{ fontSize: 11, color: '#ff8b8b' }}
              >
                <Trash2 size={11} /> セット削除
              </button>

              <select
                aria-label="表示列数"
                value={viewMode === 'list' ? 'list' : String(activeSet.columns)}
                onChange={(e) => {
                  if (e.target.value === 'list') {
                    setViewMode('list');
                  } else {
                    setViewMode('grid');
                    setColorSetColumns(activeSet.id, Number(e.target.value));
                  }
                }}
                style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 4px' }}
              >
                <option value="6">6列タイル</option>
                <option value="8">8列タイル</option>
                <option value="12">12列タイル</option>
                <option value="list">色名リスト</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* SwatchGrid / List Area */}
      <div className="scroll-y" style={{ flex: 1, minHeight: 80 }}>
        {activeSet.swatches.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 11,
            }}
          >
            色がまだありません。下の「＋色追加」で現在の描画色を登録できます。
          </div>
        ) : viewMode === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {activeSet.swatches.map((sw, idx) => {
              const isSel = selectedSwatchIndex === idx;
              if (!sw) {
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedSwatchIndex(idx)}
                    style={{
                      height: 16,
                      border: isSel ? '1px dashed var(--accent)' : '1px dashed var(--border-color)',
                      borderRadius: 3,
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 8,
                    }}
                  >
                    ── 区切り（空白マス）──
                  </div>
                );
              }
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedSwatchIndex(idx);
                    setColorFromHex(sw.hex);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 8,
                    padding: '4px 6px',
                    background: isSel ? 'var(--accent-soft)' : 'var(--bg-input)',
                    borderColor: isSel ? 'var(--accent)' : 'var(--border-color)',
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 3,
                      background: sw.hex,
                      border: '1px solid rgba(255,255,255,0.25)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 11 }}>
                    {sw.name || sw.hex}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                    {sw.hex}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${activeSet.columns}, minmax(0, 1fr))`,
              gap: 3,
            }}
          >
            {activeSet.swatches.map((sw, idx) => {
              const isSel = selectedSwatchIndex === idx;
              if (!sw) {
                return (
                  <button
                    key={idx}
                    type="button"
                    title="空白マス（区切り）"
                    onClick={() => setSelectedSwatchIndex(idx)}
                    style={{
                      aspectRatio: '1 / 1',
                      padding: 0,
                      background: 'rgba(0,0,0,0.2)',
                      border: isSel ? '2px solid var(--accent)' : '1px dashed #4a4a4a',
                    }}
                  />
                );
              }
              return (
                <button
                  key={idx}
                  type="button"
                  title={sw.name ? `${sw.name} (${sw.hex})` : sw.hex}
                  onClick={() => {
                    setSelectedSwatchIndex(idx);
                    setColorFromHex(sw.hex);
                  }}
                  style={{
                    aspectRatio: '1 / 1',
                    padding: 0,
                    background: sw.hex,
                    border: isSel ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.45)',
                    boxShadow: isSel ? '0 0 0 1.5px var(--accent)' : 'none',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Selected swatch name editor bar */}
      {editingSwatchName && selectedSwatchIndex !== null && selectedSwatch && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <input
            type="text"
            placeholder="色名メモ（例：1影、ハイライト）"
            value={swatchNameDraft}
            onChange={(e) => setSwatchNameDraft(e.target.value)}
            style={{ flex: 1, fontSize: 11 }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              renameSwatchInSet(selectedSwatchIndex, swatchNameDraft);
              setEditingSwatchName(false);
            }}
            style={{ fontSize: 11 }}
          >
            決定
          </button>
        </div>
      )}

      {/* Bottom Swatch Action Bar (CSP-style bottom icons) */}
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
            title="現在の描画色をセット末尾に追加"
            onClick={addCurrentColorToSet}
            style={{ padding: '4px 7px', fontSize: 11 }}
          >
            <Plus size={13} /> 色追加
          </button>
          <button
            type="button"
            title="選択マスを現在の描画色で上書き"
            disabled={selectedSwatchIndex === null}
            onClick={() => {
              if (selectedSwatchIndex !== null) replaceSwatchWithCurrent(selectedSwatchIndex);
            }}
            className="btn-icon"
            style={{ minWidth: 26, minHeight: 26 }}
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            title="空白（区切り）マスを追加"
            onClick={addSpacerToSet}
            className="btn-icon"
            style={{ minWidth: 26, minHeight: 26 }}
          >
            <SquareDashed size={12} />
          </button>
          {selectedSwatch && (
            <button
              type="button"
              title="選択した色の名前メモを編集"
              onClick={() => {
                setSwatchNameDraft(selectedSwatch.name ?? '');
                setEditingSwatchName((v) => !v);
              }}
              className="btn-icon"
              style={{ minWidth: 26, minHeight: 26 }}
            >
              <Edit3 size={12} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <button
            type="button"
            title={viewMode === 'grid' ? '色名付きリスト表示に切替' : 'タイル表示に切替'}
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className={`btn-icon ${viewMode === 'list' ? 'btn-active' : ''}`}
            style={{ minWidth: 26, minHeight: 26 }}
          >
            <List size={12} />
          </button>
          <button
            type="button"
            title="選択マスを削除"
            disabled={selectedSwatchIndex === null}
            onClick={() => {
              if (selectedSwatchIndex !== null) removeSwatchFromSet(selectedSwatchIndex);
            }}
            className="btn-icon"
            style={{ minWidth: 26, minHeight: 26 }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* JSON Export / Import Modal */}
      {jsonModal && (
        <div className="modal-backdrop" onClick={() => setJsonModal(null)}>
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
              <span>
                {jsonModal === 'export'
                  ? 'カラーセットのJSONエクスポート'
                  : 'カラーセットのJSONインポート'}
              </span>
              <button type="button" onClick={() => setJsonModal(null)}>
                閉じる
              </button>
            </div>

            {jsonModal === 'export' ? (
              <div
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={exportScope === 'current' ? 'btn-active' : ''}
                    onClick={() => setExportScope('current')}
                  >
                    選択中のみ（{activeSet.name}）
                  </button>
                  <button
                    type="button"
                    className={exportScope === 'favorites' ? 'btn-active' : ''}
                    onClick={() => setExportScope('favorites')}
                  >
                    ★お気に入り一括（{favoriteSets.length}件）
                  </button>
                  <button
                    type="button"
                    className={exportScope === 'all' ? 'btn-active' : ''}
                    onClick={() => setExportScope('all')}
                  >
                    全セット一括（{colorSets.length}件）
                  </button>
                </div>

                <textarea
                  readOnly
                  value={exportJsonString}
                  rows={10}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    resize: 'vertical',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={handleCopyJson}>
                    {copiedFlag ? <Check size={14} /> : <Copy size={14} />}
                    {copiedFlag ? 'コピーしました' : 'JSONをコピー'}
                  </button>
                  <button type="button" className="btn-primary" onClick={handleDownloadJson}>
                    <Download size={14} /> JSONファイルを保存
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} /> JSONファイルを選択
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    または下の欄にJSONを直接貼り付け
                  </span>
                </div>

                <textarea
                  placeholder='{"format":"palette-studio-colorset","version":1,"sets":[...]}'
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportStatus(null);
                  }}
                  rows={9}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    resize: 'vertical',
                  }}
                />

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>読込方法：</span>
                  <button
                    type="button"
                    className={importMode === 'append' ? 'btn-active' : ''}
                    onClick={() => setImportMode('append')}
                  >
                    新規セットとして追加
                  </button>
                  <button
                    type="button"
                    className={importMode === 'overwrite' ? 'btn-active' : ''}
                    onClick={() => setImportMode('overwrite')}
                  >
                    同名セットを上書き統合
                  </button>
                </div>

                {importStatus && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      background: importStatus.ok
                        ? 'rgba(46, 204, 113, 0.16)'
                        : 'rgba(229, 83, 83, 0.18)',
                      border: `1px solid ${importStatus.ok ? '#2ecc71' : '#e55353'}`,
                    }}
                  >
                    {importStatus.msg}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setJsonModal(null)}>
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!importText.trim()}
                    onClick={executeImport}
                  >
                    インポート実行
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
