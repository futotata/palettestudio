import { readCanvasRegion, writeCanvasRegion } from './gpuReadback';

/**
 * CLIP STUDIO PAINT equivalent of [編集] > [輝度を透明度に変換]
 * Converts white (luminance = 1) to fully transparent (alpha = 0),
 * black (luminance = 0) to opaque black (alpha = originalAlpha),
 * and intermediate grays to proportional semi-transparent black with zero white halo.
 */
export function convertBrightnessToOpacityData(imageData: ImageData): ImageData {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const origAlpha = data[i + 3] / 255;

    if (origAlpha <= 0) continue;

    // ITU-R BT.601 luminance
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const lineOpacity = Math.max(0, Math.min(1, (1 - lum) * origAlpha));

    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = Math.round(lineOpacity * 255);
  }
  return imageData;
}

export function convertCanvasBrightnessToOpacity(canvas: HTMLCanvasElement): void {
  const imgData = readCanvasRegion(canvas, 0, 0, canvas.width, canvas.height);
  convertBrightnessToOpacityData(imgData);
  writeCanvasRegion(canvas, imgData, 0, 0);
}

export type SampleTemplateId = 'sphere-gem-study' | 'character-bust' | 'botanical-ribbon';

export const SAMPLE_TEMPLATES: Array<{ id: SampleTemplateId; name: string; description: string }> = [
  {
    id: 'sphere-gem-study',
    name: '基礎：球体・宝石・円柱ライティング線画',
    description: '順光/逆光・反射光・宝石の透過塗り練習に最適な閉領域線画',
  },
  {
    id: 'character-bust',
    name: '人物：キャラクターバストアップ線画',
    description: '肌・髪・瞳・襟リボンのバケツ下塗り＆クリッピング影練習用',
  },
  {
    id: 'botanical-ribbon',
    name: '質感：リーフ＆クリスタルブローチ線画',
    description: '金属・ガラス・布ドレープ・葉脈の質感塗り分け練習用',
  },
];

/**
 * Draws crisp closed-contour black line art onto a transparent canvas
 * so users can immediately test Reference Layer Bucket Fill + Clipping Mask shading.
 */
export function drawSampleLineArt(
  canvas: HTMLCanvasElement,
  template: SampleTemplateId
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = '#1f1a1c';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = w / 2;
  const cy = h / 2;
  const scale = Math.min(w / 1600, h / 1200);

  if (template === 'sphere-gem-study') {
    ctx.lineWidth = Math.max(3, 4.5 * scale);

    // 1. Main Sphere (left-center)
    const sx = cx - 310 * scale;
    const sy = cy - 40 * scale;
    const sr = 210 * scale;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.stroke();

    // Ground cast shadow contour for sphere (closed loop)
    ctx.lineWidth = Math.max(2.5, 3.2 * scale);
    ctx.beginPath();
    ctx.ellipse(sx + 70 * scale, sy + sr - 8 * scale, 220 * scale, 48 * scale, 0, -0.28, Math.PI + 0.42);
    ctx.stroke();

    // 2. Faceted Octagonal Gem (top-right)
    ctx.lineWidth = Math.max(3, 4.2 * scale);
    const gx = cx + 250 * scale;
    const gy = cy - 170 * scale;
    const gw = 165 * scale;
    const gh = 200 * scale;
    const outer = [
      [gx, gy - gh],
      [gx + gw * 0.78, gy - gh * 0.45],
      [gx + gw, gy + gh * 0.15],
      [gx + gw * 0.65, gy + gh * 0.82],
      [gx, gy + gh],
      [gx - gw * 0.65, gy + gh * 0.82],
      [gx - gw, gy + gh * 0.15],
      [gx - gw * 0.78, gy - gh * 0.45],
    ];
    ctx.beginPath();
    outer.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.stroke();

    // Inner table facet
    ctx.lineWidth = Math.max(2.2, 3 * scale);
    const inner = outer.map(([px, py]) => [gx + (px - gx) * 0.52, gy + (py - gy) * 0.52]);
    ctx.beginPath();
    inner.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.stroke();

    for (let i = 0; i < outer.length; i++) {
      ctx.beginPath();
      ctx.moveTo(outer[i][0], outer[i][1]);
      ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.stroke();
    }

    // 3. Beveled Cylinder / Potion Bottle (bottom-right)
    ctx.lineWidth = Math.max(3, 4.2 * scale);
    const bx = cx + 250 * scale;
    const by = cy + 230 * scale;
    const bw = 150 * scale;
    const bh = 120 * scale;
    ctx.beginPath();
    ctx.ellipse(bx, by - bh, bw, 40 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx - bw, by - bh);
    ctx.lineTo(bx - bw, by + bh * 0.7);
    ctx.ellipse(bx, by + bh * 0.7, bw, 44 * scale, 0, Math.PI, 0, true);
    ctx.lineTo(bx + bw, by - bh);
    ctx.stroke();
  } else if (template === 'character-bust') {
    // Stylized anime/illustration bust with closed shapes for hair, face, eyes, neck, collar & ribbon
    ctx.lineWidth = Math.max(3, 4 * scale);

    // Back hair silhouette (closed)
    ctx.beginPath();
    ctx.moveTo(cx - 260 * scale, cy - 120 * scale);
    ctx.bezierCurveTo(cx - 300 * scale, cy - 390 * scale, cx + 300 * scale, cy - 390 * scale, cx + 260 * scale, cy - 120 * scale);
    ctx.bezierCurveTo(cx + 310 * scale, cy + 120 * scale, cx + 260 * scale, cy + 320 * scale, cx + 190 * scale, cy + 390 * scale);
    ctx.lineTo(cx - 190 * scale, cy + 390 * scale);
    ctx.bezierCurveTo(cx - 260 * scale, cy + 320 * scale, cx - 310 * scale, cy + 120 * scale, cx - 260 * scale, cy - 120 * scale);
    ctx.closePath();
    ctx.stroke();

    // Shoulders & Blouse (closed)
    ctx.beginPath();
    ctx.moveTo(cx - 70 * scale, cy + 175 * scale);
    ctx.quadraticCurveTo(cx - 280 * scale, cy + 215 * scale, cx - 330 * scale, cy + 430 * scale);
    ctx.lineTo(cx + 330 * scale, cy + 430 * scale);
    ctx.quadraticCurveTo(cx + 280 * scale, cy + 215 * scale, cx + 70 * scale, cy + 175 * scale);
    ctx.closePath();
    ctx.stroke();

    // Neck (closed)
    ctx.beginPath();
    ctx.moveTo(cx - 65 * scale, cy + 95 * scale);
    ctx.lineTo(cx - 72 * scale, cy + 205 * scale);
    ctx.quadraticCurveTo(cx, cy + 255 * scale, cx + 72 * scale, cy + 205 * scale);
    ctx.lineTo(cx + 65 * scale, cy + 95 * scale);
    ctx.closePath();
    ctx.stroke();

    // Face contour (closed, clear interior via white erase? No! Keep transparent interior by drawing cleanly)
    // Wait: let's clear interior of face/neck over back-hair lines so closed regions don't intersect!
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(cx - 185 * scale, cy - 130 * scale);
    ctx.bezierCurveTo(cx - 195 * scale, cy + 35 * scale, cx - 115 * scale, cy + 130 * scale, cx, cy + 148 * scale);
    ctx.bezierCurveTo(cx + 115 * scale, cy + 130 * scale, cx + 195 * scale, cy + 35 * scale, cx + 185 * scale, cy - 130 * scale);
    ctx.bezierCurveTo(cx + 175 * scale, cy - 280 * scale, cx - 175 * scale, cy - 280 * scale, cx - 185 * scale, cy - 130 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Stroke Face contour
    ctx.beginPath();
    ctx.moveTo(cx - 185 * scale, cy - 130 * scale);
    ctx.bezierCurveTo(cx - 195 * scale, cy + 35 * scale, cx - 115 * scale, cy + 130 * scale, cx, cy + 148 * scale);
    ctx.bezierCurveTo(cx + 115 * scale, cy + 130 * scale, cx + 195 * scale, cy + 35 * scale, cx + 185 * scale, cy - 130 * scale);
    ctx.bezierCurveTo(cx + 175 * scale, cy - 280 * scale, cx - 175 * scale, cy - 280 * scale, cx - 185 * scale, cy - 130 * scale);
    ctx.closePath();
    ctx.stroke();

    // Bangs across forehead
    ctx.beginPath();
    ctx.moveTo(cx - 190 * scale, cy - 115 * scale);
    ctx.quadraticCurveTo(cx - 130 * scale, cy - 35 * scale, cx - 95 * scale, cy - 145 * scale);
    ctx.quadraticCurveTo(cx - 35 * scale, cy - 15 * scale, cx + 10 * scale, cy - 150 * scale);
    ctx.quadraticCurveTo(cx + 65 * scale, cy - 25 * scale, cx + 115 * scale, cy - 140 * scale);
    ctx.quadraticCurveTo(cx + 155 * scale, cy - 45 * scale, cx + 190 * scale, cy - 115 * scale);
    ctx.stroke();

    // Left & Right Eyes (iris + upper lash)
    for (const dir of [-1, 1]) {
      const ex = cx + dir * 82 * scale;
      const ey = cy - 20 * scale;
      ctx.lineWidth = Math.max(3.5, 5 * scale);
      ctx.beginPath();
      ctx.moveTo(ex - 44 * scale, ey - 8 * scale);
      ctx.quadraticCurveTo(ex, ey - 36 * scale, ex + 44 * scale, ey - 6 * scale);
      ctx.stroke();

      ctx.lineWidth = Math.max(2.5, 3.4 * scale);
      ctx.beginPath();
      ctx.ellipse(ex, ey + 6 * scale, 30 * scale, 36 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Pupil
      ctx.beginPath();
      ctx.ellipse(ex, ey + 10 * scale, 13 * scale, 17 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Eyebrow
      ctx.beginPath();
      ctx.moveTo(ex - 38 * scale, ey - 52 * scale);
      ctx.quadraticCurveTo(ex, ey - 66 * scale, ex + 36 * scale, ey - 50 * scale);
      ctx.stroke();
    }

    // Nose & Gentle Smile
    ctx.lineWidth = Math.max(2.2, 3 * scale);
    ctx.beginPath();
    ctx.moveTo(cx - 4 * scale, cy + 36 * scale);
    ctx.lineTo(cx + 3 * scale, cy + 48 * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 24 * scale, cy + 86 * scale);
    ctx.quadraticCurveTo(cx, cy + 98 * scale, cx + 24 * scale, cy + 86 * scale);
    ctx.stroke();

    // Front Ribbon Bow at collar
    ctx.lineWidth = Math.max(3, 3.8 * scale);
    ctx.beginPath();
    ctx.roundRect(cx - 24 * scale, cy + 235 * scale, 48 * scale, 42 * scale, 12 * scale);
    ctx.stroke();

    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 24 * scale, cy + 245 * scale);
      ctx.bezierCurveTo(
        cx + dir * 135 * scale,
        cy + 195 * scale,
        cx + dir * 150 * scale,
        cy + 315 * scale,
        cx + dir * 24 * scale,
        cy + 272 * scale
      );
      ctx.closePath();
      ctx.stroke();
    }
  } else {
    // Botanical Leaf + Crystal Brooch + Ribbon
    ctx.lineWidth = Math.max(3, 4.2 * scale);

    // Central Oval Brooch Frame & Gem
    ctx.beginPath();
    ctx.ellipse(cx, cy - 30 * scale, 155 * scale, 200 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, cy - 30 * scale, 112 * scale, 152 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Two Large Leaves left & right
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 150 * scale, cy + 20 * scale);
      ctx.bezierCurveTo(
        cx + dir * 320 * scale,
        cy - 180 * scale,
        cx + dir * 460 * scale,
        cy - 40 * scale,
        cx + dir * 490 * scale,
        cy - 130 * scale
      );
      ctx.bezierCurveTo(
        cx + dir * 450 * scale,
        cy + 95 * scale,
        cx + dir * 280 * scale,
        cy + 150 * scale,
        cx + dir * 150 * scale,
        cy + 20 * scale
      );
      ctx.closePath();
      ctx.stroke();

      // Leaf midrib vein
      ctx.lineWidth = Math.max(2, 2.8 * scale);
      ctx.beginPath();
      ctx.moveTo(cx + dir * 160 * scale, cy + 16 * scale);
      ctx.quadraticCurveTo(cx + dir * 330 * scale, cy - 10 * scale, cx + dir * 455 * scale, cy - 95 * scale);
      ctx.stroke();
      ctx.lineWidth = Math.max(3, 4.2 * scale);
    }

    // Flowing Bottom Ribbon Tails
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 35 * scale, cy + 168 * scale);
      ctx.bezierCurveTo(
        cx + dir * 95 * scale,
        cy + 300 * scale,
        cx + dir * 240 * scale,
        cy + 330 * scale,
        cx + dir * 290 * scale,
        cy + 430 * scale
      );
      ctx.lineTo(cx + dir * 195 * scale, cy + 445 * scale);
      ctx.bezierCurveTo(
        cx + dir * 140 * scale,
        cy + 360 * scale,
        cx + dir * 40 * scale,
        cy + 310 * scale,
        cx + dir * 5 * scale,
        cy + 170 * scale
      );
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}
