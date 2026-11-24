import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  ImagePlus,
  Pipette,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { rgbToHex } from '../../color/colorMath';
import { useColorStore } from '../../store/useColorStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

/**
 * Generates a built-in painted lighting & skin/sky study reference card
 * so users can immediately practice Sub-View comparison and Auto-Eyedropper!
 */
function createSampleReferenceDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 360;
  const ctx = c.getContext('2d')!;

  // Warm sunset sky background
  const sky = ctx.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, '#2c2b59');
  sky.addColorStop(0.48, '#8a446f');
  sky.addColorStop(0.82, '#eb7b61');
  sky.addColorStop(1, '#ffd584');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 480, 360);

  // Ground bounce plane
  ctx.fillStyle = '#57435e';
  ctx.fillRect(0, 275, 480, 85);

  // Cast shadow
  ctx.fillStyle = 'rgba(38, 22, 48, 0.65)';
  ctx.beginPath();
  ctx.ellipse(215, 286, 118, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lit Sphere with subsurface terminator & sky bounce light
  const sx = 175;
  const sy = 185;
  const sr = 98;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.clip();

  // Shadow base
  ctx.fillStyle = '#9c6c7c';
  ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);

  // Warm subsurface midtone + key light
  const keyGrad = ctx.createRadialGradient(sx - 38, sy - 42, 10, sx - 18, sy - 20, sr * 1.35);
  keyGrad.addColorStop(0, '#fff2e6');
  keyGrad.addColorStop(0.38, '#fad1bc');
  keyGrad.addColorStop(0.68, '#e89685');
  keyGrad.addColorStop(0.86, '#a96e7d');
  keyGrad.addColorStop(1, '#79678c');
  ctx.fillStyle = keyGrad;
  ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);

  // Cool sky ambient bounce at bottom-right
  const bounceGrad = ctx.createRadialGradient(sx + 58, sy + 68, 4, sx + 45, sy + 55, 82);
  bounceGrad.addColorStop(0, 'rgba(148, 195, 228, 0.65)');
  bounceGrad.addColorStop(1, 'rgba(148, 195, 228, 0)');
  ctx.fillStyle = bounceGrad;
  ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  ctx.restore();

  // Swatch palette legend on right side of card
  const swatches = [
    { hex: '#FFF2E6', label: 'ハイライト' },
    { hex: '#FAD1BC', label: 'ベース明部' },
    { hex: '#E89685', label: '血色境界' },
    { hex: '#A96E7D', label: '1影・2影' },
    { hex: '#94C3E4', label: '反射光' },
  ];
  swatches.forEach((sw, i) => {
    const y = 38 + i * 44;
    ctx.fillStyle = 'rgba(20, 20, 26, 0.68)';
    ctx.fillRect(326, y, 134, 34);
    ctx.fillStyle = sw.hex;
    ctx.fillRect(332, y + 5, 24, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(sw.label, 364, y + 21);
  });

  return c.toDataURL('image/png');
}

export const SubViewPanel: React.FC = () => {
  const subViewOpen = useWorkspaceStore((s) => s.subViewOpen);
  const subViewImages = useWorkspaceStore((s) => s.subViewImages);
  const subViewIndex = useWorkspaceStore((s) => s.subViewIndex);
  const subViewZoom = useWorkspaceStore((s) => s.subViewZoom);
  const subViewPanX = useWorkspaceStore((s) => s.subViewPanX);
  const subViewPanY = useWorkspaceStore((s) => s.subViewPanY);
  const subViewFlipX = useWorkspaceStore((s) => s.subViewFlipX);
  const subViewAutoEyedropper = useWorkspaceStore((s) => s.subViewAutoEyedropper);

  const toggleSubView = useWorkspaceStore((s) => s.toggleSubView);
  const addSubViewImage = useWorkspaceStore((s) => s.addSubViewImage);
  const removeSubViewImage = useWorkspaceStore((s) => s.removeSubViewImage);
  const selectSubViewIndex = useWorkspaceStore((s) => s.selectSubViewIndex);
  const setSubViewTransform = useWorkspaceStore((s) => s.setSubViewTransform);
  const resetSubViewTransform = useWorkspaceStore((s) => s.resetSubViewTransform);
  const toggleSubViewFlipX = useWorkspaceStore((s) => s.toggleSubViewFlipX);
  const toggleSubViewAutoEyedropper = useWorkspaceStore((s) => s.toggleSubViewAutoEyedropper);

  const setColorFromRgba = useColorStore((s) => s.setColorFromRgba);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const [pickedHex, setPickedHex] = useState<string | null>(null);
  const dragPanRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  const currentImg = subViewImages[subViewIndex] ?? null;

  useEffect(() => {
    if (!currentImg) {
      loadedImageRef.current = null;
      const c = canvasRef.current;
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
      return;
    }
    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      renderSubView();
    };
    img.src = currentImg.dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImg?.dataUrl]);

  const renderSubView = () => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#242424';
    ctx.fillRect(0, 0, w, h);

    if (!img) return;

    const fitScale = Math.min(w / img.width, h / img.height) * 0.94;
    const scale = fitScale * subViewZoom;

    ctx.save();
    ctx.translate(w / 2 + subViewPanX, h / 2 + subViewPanY);
    if (subViewFlipX) ctx.scale(-1, 1);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  };

  useEffect(() => {
    if (subViewOpen) renderSubView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subViewOpen, subViewZoom, subViewPanX, subViewPanY, subViewFlipX, currentImg]);

  if (!subViewOpen) return null;

  const sampleColorAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImageRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const px = ctx.getImageData(x, y, 1, 1).data;
    setColorFromRgba({ r: px[0], g: px[1], b: px[2], a: 1 });
    setPickedHex(rgbToHex(px[0], px[1], px[2]));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        addSubViewImage(file.name, reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerCancel={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        width: 268,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 10px 28px rgba(0,0,0,0.48)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px',
          background: 'var(--bg-panel-header)',
          borderBottom: '1px solid var(--border-color)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <span>サブビュー（お手本・資料）</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {pickedHex && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                background: pickedHex,
                color: '#fff',
                textShadow: '0 1px 2px #000',
              }}
            >
              {pickedHex}
            </span>
          )}
          <button
            type="button"
            onClick={toggleSubView}
            className="btn-icon"
            style={{ width: 22, height: 22, minWidth: 22, minHeight: 22, padding: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Canvas or Empty Prompt */}
      <div style={{ position: 'relative', width: '100%', height: 186, background: '#242424' }}>
        <canvas
          ref={canvasRef}
          width={268}
          height={186}
          onPointerDown={(e) => {
            if (!currentImg) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            if (subViewAutoEyedropper) {
              sampleColorAt(e.clientX, e.clientY);
            } else {
              dragPanRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                origX: subViewPanX,
                origY: subViewPanY,
              };
            }
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            if (subViewAutoEyedropper) {
              sampleColorAt(e.clientX, e.clientY);
            } else if (dragPanRef.current) {
              setSubViewTransform(
                subViewZoom,
                dragPanRef.current.origX + (e.clientX - dragPanRef.current.startX),
                dragPanRef.current.origY + (e.clientY - dragPanRef.current.startY)
              );
            }
          }}
          onPointerUp={(e) => {
            dragPanRef.current = null;
            setPickedHex(null);
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.12 : 0.89;
            setSubViewTransform(subViewZoom * factor, subViewPanX, subViewPanY);
          }}
          style={{
            width: '100%',
            height: '100%',
            touchAction: 'none',
            cursor: subViewAutoEyedropper ? 'crosshair' : 'grab',
          }}
        />

        {!currentImg && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 12,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              お手本画像を読み込むと、タッチで直接色をスポイト採取できます
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 11 }}
              >
                <ImagePlus size={13} /> 画像読込
              </button>
              <button
                type="button"
                onClick={() =>
                  addSubViewImage('ライティング練習お手本', createSampleReferenceDataUrl())
                }
                style={{ fontSize: 11 }}
              >
                <Sparkles size={13} /> サンプルお手本
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 6px',
          borderTop: '1px solid var(--border-color)',
          gap: 3,
        }}
      >
        <div style={{ display: 'flex', gap: 3 }}>
          <button
            type="button"
            title="自動でスポイトに切り替え（ON時は触れるだけで色採取、OFF時はドラッグ移動）"
            onClick={toggleSubViewAutoEyedropper}
            className={subViewAutoEyedropper ? 'btn-active' : ''}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            <Pipette size={12} /> スポイト
          </button>
          <button
            type="button"
            title="お手本を左右反転"
            onClick={toggleSubViewFlipX}
            className={`btn-icon ${subViewFlipX ? 'btn-active' : ''}`}
            style={{ minWidth: 24, minHeight: 24 }}
          >
            <FlipHorizontal2 size={12} />
          </button>
          <button
            type="button"
            title="拡大率リセット"
            onClick={resetSubViewTransform}
            className="btn-icon"
            style={{ minWidth: 24, minHeight: 24 }}
          >
            <RotateCcw size={12} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {subViewImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  selectSubViewIndex(
                    (subViewIndex - 1 + subViewImages.length) % subViewImages.length
                  )
                }
                className="btn-icon"
                style={{ minWidth: 22, minHeight: 24 }}
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                onClick={() => selectSubViewIndex((subViewIndex + 1) % subViewImages.length)}
                className="btn-icon"
                style={{ minWidth: 22, minHeight: 24 }}
              >
                <ChevronRight size={12} />
              </button>
            </>
          )}
          <button
            type="button"
            title="資料画像を追加"
            onClick={() => fileRef.current?.click()}
            className="btn-icon"
            style={{ minWidth: 24, minHeight: 24 }}
          >
            <ImagePlus size={12} />
          </button>
          {currentImg && (
            <button
              type="button"
              title="現在の資料を削除"
              onClick={() => removeSubViewImage(currentImg.id)}
              className="btn-icon"
              style={{ minWidth: 24, minHeight: 24 }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
