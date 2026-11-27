import React, { useCallback, useEffect, useRef } from 'react';
import {
  BALL_RADIUS,
  FOOT_SPOT_X,
  FOOT_SPOT_Y,
  HEAD_STRING_X,
  POCKETS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  clampCueBallPosition,
  computeAimPreview,
} from '../shared/physics.ts';
import { getBallGroup, isPlayerOnEightBall } from '../shared/rules.ts';
import type {
  BallState,
  MatchState,
  PlayerSeat,
  Vector2D,
} from '../shared/types.ts';

export const RAIL_PAD = 60;
export const LOGICAL_WIDTH = TABLE_WIDTH + RAIL_PAD * 2; // 1120
export const LOGICAL_HEIGHT = TABLE_HEIGHT + RAIL_PAD * 2; // 620

const BALL_COLORS: Record<number, string> = {
  0: '#FAF7EE',
  1: '#EAB308',
  2: '#1D4ED8',
  3: '#DC2626',
  4: '#7E22CE',
  5: '#EA580C',
  6: '#15803D',
  7: '#881337',
  8: '#15181C',
  9: '#EAB308',
  10: '#1D4ED8',
  11: '#DC2626',
  12: '#7E22CE',
  13: '#EA580C',
  14: '#15803D',
  15: '#881337',
};

function createBallSprite(id: number, scale = 4): HTMLCanvasElement {
  const size = Math.ceil(BALL_RADIUS * 2 * scale + 8);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const r = BALL_RADIUS * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  const color = BALL_COLORS[id] || '#FAF7EE';
  const isStripe = id >= 9 && id <= 15;

  // Base ivory or solid color
  ctx.fillStyle = isStripe ? '#FAF6E8' : color;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Horizontal stripe band for 9-15
  if (isStripe) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - r, cy - r * 0.53, r * 2, r * 1.06);
    // Subtle crisp band border
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = scale * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.53);
    ctx.lineTo(cx + r, cy - r * 0.53);
    ctx.moveTo(cx - r, cy + r * 0.53);
    ctx.lineTo(cx + r, cy + r * 0.53);
    ctx.stroke();
  }

  // Spherical limb shading (overhead billiard lamp light)
  const shade = ctx.createRadialGradient(
    cx - r * 0.3,
    cy - r * 0.34,
    r * 0.08,
    cx,
    cy,
    r * 1.05
  );
  shade.addColorStop(0, 'rgba(255,255,255,0.15)');
  shade.addColorStop(0.52, 'rgba(0,0,0,0.03)');
  shade.addColorStop(0.84, 'rgba(0,0,0,0.28)');
  shade.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Subtle emerald felt bounce light on lower rim
  const bounce = ctx.createRadialGradient(
    cx + r * 0.25,
    cy + r * 0.45,
    0,
    cx + r * 0.25,
    cy + r * 0.45,
    r * 0.72
  );
  bounce.addColorStop(0, 'rgba(20, 130, 86, 0.24)');
  bounce.addColorStop(1, 'rgba(20, 130, 86, 0)');
  ctx.fillStyle = bounce;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Number medallion (balls 1..15)
  if (id > 0) {
    const medR = r * 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy, medR, 0, Math.PI * 2);
    ctx.fillStyle = '#FCF8EC';
    ctx.fill();
    ctx.lineWidth = scale * 0.55;
    ctx.strokeStyle = 'rgba(15,15,15,0.25)';
    ctx.stroke();

    ctx.fillStyle = '#111315';
    ctx.font = `800 ${Math.round(r * 0.61)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(id), cx, cy + scale * 0.4);
  } else {
    // Classic red/gold casino pro-cup alignment spot on cue ball
    ctx.beginPath();
    ctx.arc(cx + r * 0.28, cy - r * 0.22, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(185, 28, 28, 0.6)';
    ctx.fill();
  }

  // Sharp glossy specular highlight
  const gloss = ctx.createRadialGradient(
    cx - r * 0.36,
    cy - r * 0.38,
    0,
    cx - r * 0.34,
    cy - r * 0.35,
    r * 0.46
  );
  gloss.addColorStop(0, 'rgba(255,255,255,0.78)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.2)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(cx - r * 0.34, cy - r * 0.35, r * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Crisp circular outline
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.35, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  ctx.lineWidth = scale * 0.6;
  ctx.stroke();

  return canvas;
}

function createStaticTableCanvas(dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(LOGICAL_WIDTH * dpr);
  canvas.height = Math.round(LOGICAL_HEIGHT * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const tx = RAIL_PAD;
  const ty = RAIL_PAD;

  // 1. Rich Burled Mahogany Wooden Rails
  const woodGrad = ctx.createLinearGradient(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  woodGrad.addColorStop(0, '#542B1A');
  woodGrad.addColorStop(0.28, '#3B1B0E');
  woodGrad.addColorStop(0.55, '#4A2415');
  woodGrad.addColorStop(0.82, '#34170B');
  woodGrad.addColorStop(1, '#261007');

  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 28);
  ctx.fill();

  // Organic walnut/mahogany grain lines
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 28);
  ctx.clip();
  for (let y = 3; y < LOGICAL_HEIGHT; y += 7) {
    ctx.strokeStyle =
      y % 14 === 0 ? 'rgba(255, 208, 150, 0.04)' : 'rgba(15, 6, 3, 0.16)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      LOGICAL_WIDTH * 0.3,
      y + Math.sin(y * 0.08) * 3.5,
      LOGICAL_WIDTH * 0.7,
      y - Math.cos(y * 0.09) * 3.5,
      LOGICAL_WIDTH,
      y
    );
    ctx.stroke();
  }
  ctx.restore();

  // Outer bevel & brass pinstripe trim
  ctx.strokeStyle = 'rgba(255, 224, 158, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, LOGICAL_WIDTH - 3, LOGICAL_HEIGHT - 3, 27);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(7, 7, LOGICAL_WIDTH - 14, LOGICAL_HEIGHT - 14, 22);
  ctx.stroke();

  // 2. Ornate Cast Brass Corner Plates & Rivets
  const cornerBrassGrad = ctx.createLinearGradient(0, 0, 86, 86);
  cornerBrassGrad.addColorStop(0, '#F7DA84');
  cornerBrassGrad.addColorStop(0.45, '#CFA339');
  cornerBrassGrad.addColorStop(1, '#825F15');

  const drawRivet = (rx: number, ry: number) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = '#4B360A';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rx - 0.5, ry - 0.5, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#F7DA84';
    ctx.fill();
  };

  const drawCornerPlate = (cx: number, cy: number, sx: number, sy: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.fillStyle = cornerBrassGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(86, 0);
    ctx.lineTo(86, 22);
    ctx.arcTo(22, 22, 22, 86, 18);
    ctx.lineTo(22, 86);
    ctx.lineTo(0, 86);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 245, 200, 0.56)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Engraved Art-Deco brass filigree scroll lines
    ctx.strokeStyle = 'rgba(92, 62, 10, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(18, 18);
    ctx.moveTo(26, 8);
    ctx.lineTo(66, 8);
    ctx.moveTo(8, 26);
    ctx.lineTo(8, 66);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 244, 195, 0.38)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(26, 6.8);
    ctx.lineTo(66, 6.8);
    ctx.moveTo(6.8, 26);
    ctx.lineTo(6.8, 66);
    ctx.stroke();

    drawRivet(74, 11);
    drawRivet(11, 74);
    drawRivet(13, 13);
    ctx.restore();
  };

  drawCornerPlate(2, 2, 1, 1);
  drawCornerPlate(LOGICAL_WIDTH - 2, 2, -1, 1);
  drawCornerPlate(2, LOGICAL_HEIGHT - 2, 1, -1);
  drawCornerPlate(LOGICAL_WIDTH - 2, LOGICAL_HEIGHT - 2, -1, -1);

  // Brass side pocket plates with engraved double trim
  const drawSidePlate = (x: number, y: number, isTop: boolean) => {
    ctx.save();
    ctx.fillStyle = cornerBrassGrad;
    ctx.beginPath();
    if (isTop) {
      ctx.roundRect(x - 48, y, 96, 28, [0, 0, 10, 10]);
    } else {
      ctx.roundRect(x - 48, y - 28, 96, 28, [10, 10, 0, 0]);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 244, 195, 0.48)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(92, 62, 10, 0.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (isTop) {
      ctx.roundRect(x - 44, y + 3, 88, 22, [0, 0, 7, 7]);
    } else {
      ctx.roundRect(x - 44, y - 25, 88, 22, [7, 7, 0, 0]);
    }
    ctx.stroke();

    const ry = isTop ? y + 14 : y - 14;
    drawRivet(x - 37, ry);
    drawRivet(x + 37, ry);
    ctx.restore();
  };
  drawSidePlate(tx + TABLE_WIDTH / 2, 2, true);
  drawSidePlate(tx + TABLE_WIDTH / 2, LOGICAL_HEIGHT - 2, false);

  // Engraved "GRAND REGENCY" brass nameplate inlaid onto lower center mahogany rail
  const plaqueW = 148;
  const plaqueH = 18;
  const plaqueX = tx + TABLE_WIDTH * 0.75 - plaqueW / 2;
  const plaqueY = LOGICAL_HEIGHT - 28;
  const plaqueGrad = ctx.createLinearGradient(plaqueX, plaqueY, plaqueX + plaqueW, plaqueY + plaqueH);
  plaqueGrad.addColorStop(0, '#DFB54B');
  plaqueGrad.addColorStop(0.5, '#F8DE8C');
  plaqueGrad.addColorStop(1, '#A97E1F');
  ctx.save();
  ctx.fillStyle = plaqueGrad;
  ctx.beginPath();
  ctx.roundRect(plaqueX, plaqueY, plaqueW, plaqueH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 24, 6, 0.75)';
  ctx.lineWidth = 1;
  ctx.stroke();
  drawRivet(plaqueX + 8, plaqueY + plaqueH / 2);
  drawRivet(plaqueX + plaqueW - 8, plaqueY + plaqueH / 2);
  ctx.fillStyle = '#2B1A06';
  ctx.font = '800 8.5px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GRAND REGENCY', plaqueX + plaqueW / 2, plaqueY + plaqueH / 2 + 0.5);
  ctx.restore();

  // Iconic square blue billiards chalk cube resting neatly on the top-left wooden rail apron
  ctx.save();
  const chalkX = tx + 168;
  const chalkY = 12;
  ctx.translate(chalkX, chalkY);
  ctx.rotate(-0.14);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(-7, -6, 17, 17);
  ctx.fillStyle = '#D9C7A3';
  ctx.beginPath();
  ctx.roundRect(-8, -8, 16, 16, 2);
  ctx.fill();
  ctx.fillStyle = '#1D4ED8';
  ctx.beginPath();
  ctx.roundRect(-6.5, -6.5, 13, 13, 1.5);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#1E3A8A';
  ctx.fill();
  ctx.restore();

  // Inner brass inlay line framing the cushions
  ctx.strokeStyle = 'rgba(229, 192, 92, 0.52)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(tx - 17, ty - 17, TABLE_WIDTH + 34, TABLE_HEIGHT + 34, 14);
  ctx.stroke();

  // Cushion rail under-channel
  ctx.fillStyle = '#052A1B';
  ctx.beginPath();
  ctx.roundRect(tx - 14, ty - 14, TABLE_WIDTH + 28, TABLE_HEIGHT + 28, 12);
  ctx.fill();

  // 3. Lush Emerald Baize Felt Surface with Overhead Lamp Glow
  ctx.save();
  ctx.translate(tx, ty);

  const feltGrad = ctx.createRadialGradient(
    TABLE_WIDTH / 2,
    TABLE_HEIGHT / 2,
    40,
    TABLE_WIDTH / 2,
    TABLE_HEIGHT / 2,
    TABLE_WIDTH * 0.66
  );
  feltGrad.addColorStop(0, '#106B48');
  feltGrad.addColorStop(0.55, '#0C5539');
  feltGrad.addColorStop(1, '#073A26');
  ctx.fillStyle = feltGrad;
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  // Subtle warm Tiffany overhead lamp sheen in center
  const lampSheen = ctx.createRadialGradient(
    TABLE_WIDTH / 2,
    TABLE_HEIGHT / 2,
    10,
    TABLE_WIDTH / 2,
    TABLE_HEIGHT / 2,
    340
  );
  lampSheen.addColorStop(0, 'rgba(255, 236, 179, 0.055)');
  lampSheen.addColorStop(1, 'rgba(255, 236, 179, 0)');
  ctx.fillStyle = lampSheen;
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  // Fine woven baize texture
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let gx = 4; gx < TABLE_WIDTH; gx += 6) {
    for (let gy = gx % 12 === 0 ? 3 : 6; gy < TABLE_HEIGHT; gy += 6) {
      ctx.fillRect(gx, gy, 1.4, 1.4);
    }
  }

  // Head string (baulk line)
  ctx.strokeStyle = 'rgba(245, 239, 226, 0.24)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(HEAD_STRING_X, 6);
  ctx.lineTo(HEAD_STRING_X, TABLE_HEIGHT - 6);
  ctx.stroke();

  // Head spot & Foot spot with fine brass/ivory rings
  const drawSpot = (sx: number, sy: number) => {
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 239, 226, 0.36)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.65)';
    ctx.fill();
  };
  drawSpot(HEAD_STRING_X, FOOT_SPOT_Y);
  drawSpot(FOOT_SPOT_X, FOOT_SPOT_Y);

  // Classic Regency crossed-cue & diamond crest inlaid subtly on center felt
  ctx.save();
  ctx.translate(TABLE_WIDTH / 2, TABLE_HEIGHT / 2);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(22, 0);
  ctx.lineTo(0, 28);
  ctx.lineTo(-22, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-26, -15);
  ctx.lineTo(26, 15);
  ctx.moveTo(-26, 15);
  ctx.lineTo(26, -15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 4. Beveled Cushions & Soft Rail Shadows
  const cushionColor = '#0A4B31';
  const cushionEdge = '#17875D';

  const drawCushionBand = (points: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = cushionColor;
    ctx.fill();
    ctx.strokeStyle = cushionEdge;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  };

  drawCushionBand([
    [22, -14],
    [477, -14],
    [472, 0],
    [42, 0],
  ]);
  drawCushionBand([
    [523, -14],
    [978, -14],
    [958, 0],
    [528, 0],
  ]);
  drawCushionBand([
    [42, TABLE_HEIGHT],
    [472, TABLE_HEIGHT],
    [477, TABLE_HEIGHT + 14],
    [22, TABLE_HEIGHT + 14],
  ]);
  drawCushionBand([
    [528, TABLE_HEIGHT],
    [958, TABLE_HEIGHT],
    [978, TABLE_HEIGHT + 14],
    [523, TABLE_HEIGHT + 14],
  ]);
  drawCushionBand([
    [-14, 22],
    [0, 42],
    [0, TABLE_HEIGHT - 42],
    [-14, TABLE_HEIGHT - 22],
  ]);
  drawCushionBand([
    [TABLE_WIDTH + 14, 22],
    [TABLE_WIDTH + 14, TABLE_HEIGHT - 22],
    [TABLE_WIDTH, TABLE_HEIGHT - 42],
    [TABLE_WIDTH, 42],
  ]);

  // Cushion inner ambient occlusion shadow onto felt
  const topShadow = ctx.createLinearGradient(0, 0, 0, 15);
  topShadow.addColorStop(0, 'rgba(0,0,0,0.38)');
  topShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, TABLE_WIDTH, 15);

  const botShadow = ctx.createLinearGradient(0, TABLE_HEIGHT - 15, 0, TABLE_HEIGHT);
  botShadow.addColorStop(0, 'rgba(0,0,0,0)');
  botShadow.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = botShadow;
  ctx.fillRect(0, TABLE_HEIGHT - 15, TABLE_WIDTH, 15);

  const leftShadow = ctx.createLinearGradient(0, 0, 15, 0);
  leftShadow.addColorStop(0, 'rgba(0,0,0,0.34)');
  leftShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftShadow;
  ctx.fillRect(0, 0, 15, TABLE_HEIGHT);

  const rightShadow = ctx.createLinearGradient(TABLE_WIDTH - 15, 0, TABLE_WIDTH, 0);
  rightShadow.addColorStop(0, 'rgba(0,0,0,0)');
  rightShadow.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = rightShadow;
  ctx.fillRect(TABLE_WIDTH - 15, 0, 15, TABLE_HEIGHT);

  // 5. Six Saddle-Stitched Leather-Lined Recessed Pockets
  for (const p of POCKETS) {
    // Stitched dark saddle leather surround
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.visualRadius + 6.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24, 11, 6, 0.94)';
    ctx.fill();

    // Fine gold saddle stitching along leather lip
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.visualRadius + 3.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.restore();

    // Deep pocket cup gradient
    const wellGrad = ctx.createRadialGradient(
      p.x,
      p.y,
      p.visualRadius * 0.2,
      p.x,
      p.y,
      p.visualRadius
    );
    wellGrad.addColorStop(0, '#010202');
    wellGrad.addColorStop(0.72, '#070908');
    wellGrad.addColorStop(1, '#24150E');

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.visualRadius, 0, Math.PI * 2);
    ctx.fillStyle = wellGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(229, 192, 92, 0.48)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();

  // 6. Eighteen Inlaid Mother-of-Pearl / Gold Diamond Rail Sights
  const drawDiamond = (dx: number, dy: number) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = '#EFE0AC';
    ctx.strokeStyle = 'rgba(20, 10, 4, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.4, 0);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-3.4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  const topRailY = ty - 34;
  const botRailY = ty + TABLE_HEIGHT + 34;
  const leftRailX = tx - 34;
  const rightRailX = tx + TABLE_WIDTH + 34;

  [125, 250, 375, 625, 750, 875].forEach((xOff) => {
    drawDiamond(tx + xOff, topRailY);
    drawDiamond(tx + xOff, botRailY);
  });
  [125, 250, 375].forEach((yOff) => {
    drawDiamond(leftRailX, ty + yOff);
    drawDiamond(rightRailX, ty + yOff);
  });

  return canvas;
}

function drawCueStick(
  ctx: CanvasRenderingContext2D,
  cueX: number,
  cueY: number,
  angle: number,
  pullBackPx: number,
  isOpponent: boolean,
  alpha = 1
): void {
  const startDist = BALL_RADIUS + Math.max(1, pullBackPx);
  const stickLen = 290;

  ctx.save();
  ctx.translate(cueX, cueY);
  ctx.rotate(angle + Math.PI);
  ctx.globalAlpha = (isOpponent ? 0.72 : 1) * Math.max(0, Math.min(1, alpha));

  // Cue stick drop shadow onto felt
  ctx.save();
  ctx.translate(3, 5.5);
  ctx.beginPath();
  ctx.moveTo(startDist, -3);
  ctx.lineTo(startDist + stickLen, -7.8);
  ctx.lineTo(startDist + stickLen, 7.8);
  ctx.lineTo(startDist, 3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.fill();
  ctx.restore();

  // Blue Master chalk tip
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.roundRect(startDist, -3.2, 4.2, 6.4, 1.2);
  ctx.fill();

  // Ivory ferrule
  ctx.fillStyle = '#FAF5E8';
  ctx.fillRect(startDist + 4.2, -3.3, 8, 6.6);

  // Birdseye maple shaft with cylindrical highlight
  const shaftGrad = ctx.createLinearGradient(0, -4.5, 0, 4.5);
  shaftGrad.addColorStop(0, '#DFBE86');
  shaftGrad.addColorStop(0.35, '#F6DFB6');
  shaftGrad.addColorStop(0.75, '#C99E62');
  shaftGrad.addColorStop(1, '#9E733E');
  ctx.fillStyle = shaftGrad;
  ctx.beginPath();
  ctx.moveTo(startDist + 12.2, -3.3);
  ctx.lineTo(startDist + 148, -5.3);
  ctx.lineTo(startDist + 148, 5.3);
  ctx.lineTo(startDist + 12.2, 3.3);
  ctx.closePath();
  ctx.fill();

  // Brass joint collar
  ctx.fillStyle = '#E5BE53';
  ctx.fillRect(startDist + 148, -5.5, 6, 11);

  // Rosewood butt with 4-point maple splice & gold rings
  const buttGrad = ctx.createLinearGradient(0, -7.5, 0, 7.5);
  buttGrad.addColorStop(0, '#4E2212');
  buttGrad.addColorStop(0.35, '#6C311B');
  buttGrad.addColorStop(0.7, '#3A170B');
  buttGrad.addColorStop(1, '#1E0A04');
  ctx.fillStyle = buttGrad;
  ctx.beginPath();
  ctx.moveTo(startDist + 154, -5.5);
  ctx.lineTo(startDist + stickLen, -7.8);
  ctx.lineTo(startDist + stickLen, 7.8);
  ctx.lineTo(startDist + 154, 5.5);
  ctx.closePath();
  ctx.fill();

  // Spliced maple point accents near joint
  ctx.fillStyle = '#E3C38D';
  ctx.beginPath();
  ctx.moveTo(startDist + 154, -4.5);
  ctx.lineTo(startDist + 174, -2);
  ctx.lineTo(startDist + 154, -0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(startDist + 154, 4.5);
  ctx.lineTo(startDist + 174, 2);
  ctx.lineTo(startDist + 154, 0.5);
  ctx.closePath();
  ctx.fill();

  // Black Irish linen wrap with mother-of-pearl diamond inlays
  ctx.fillStyle = '#151312';
  ctx.beginPath();
  ctx.moveTo(startDist + 180, -5.9);
  ctx.lineTo(startDist + 246, -7.1);
  ctx.lineTo(startDist + 246, 7.1);
  ctx.lineTo(startDist + 180, 5.9);
  ctx.closePath();
  ctx.fill();

  // Pearl & gold diamond inlays on butt sleeve
  for (const dx of [262, 275]) {
    ctx.fillStyle = '#F7F1DF';
    ctx.beginPath();
    ctx.moveTo(startDist + dx, -3.2);
    ctx.lineTo(startDist + dx + 4, 0);
    ctx.lineTo(startDist + dx, 3.2);
    ctx.lineTo(startDist + dx - 4, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Gold inlay rings & rubber bumper
  ctx.fillStyle = '#F3D06B';
  ctx.fillRect(startDist + 178, -5.9, 2.4, 11.8);
  ctx.fillRect(startDist + 246, -7.1, 2.4, 14.2);
  ctx.fillRect(startDist + stickLen - 9, -7.7, 3.5, 15.4);

  ctx.fillStyle = '#111111';
  ctx.fillRect(startDist + stickLen - 4, -7.4, 4, 14.8);

  ctx.restore();
}

export interface PocketAnimationMap {
  [ballId: number]: { startTime: number; pocketX: number; pocketY: number };
}

export interface CueStrikeAnim {
  origin: Vector2D;
  angle: number;
  pullBackPx: number;
  alpha: number;
  isOpponent: boolean;
}

export interface PoolCanvasProps {
  match: MatchState;
  balls: BallState[];
  mySeat: PlayerSeat;
  aimAngle: number;
  power: number;
  calledPocket: number | null;
  strikeAnim: CueStrikeAnim | null;
  pocketAnims: PocketAnimationMap;
  isSimulating: boolean;
  onAimChange: (angle: number) => void;
  onCueBallMove: (pos: Vector2D) => void;
  onCallPocket: (pocketId: number | null) => void;
}

export const PoolCanvas: React.FC<PoolCanvasProps> = ({
  match,
  balls,
  mySeat,
  aimAngle,
  power,
  calledPocket,
  strikeAnim,
  pocketAnims,
  isSimulating,
  onAimChange,
  onCueBallMove,
  onCallPocket,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticTableRef = useRef<HTMLCanvasElement | null>(null);
  const ballSpritesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const dragModeRef = useRef<'none' | 'aim' | 'ball'>('none');
  const pointerDownPosRef = useRef<Vector2D | null>(null);
  const movedDuringDragRef = useRef(false);

  const isMyTurn = !isSimulating && match.currentTurn === mySeat && match.phase === 'AIMING';
  const canPlaceCueBall = isMyTurn && match.ballInHand !== 'NONE';
  const mustCallEightPocket =
    isMyTurn && !match.isBreakShot && isPlayerOnEightBall(match, mySeat);

  useEffect(() => {
    if (ballSpritesRef.current.size === 0) {
      for (let id = 0; id <= 15; id++) {
        ballSpritesRef.current.set(id, createBallSprite(id, 4));
      }
    }
  }, []);

  const toTableCoords = useCallback((clientX: number, clientY: number): Vector2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const lx = ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH - RAIL_PAD;
    const ly = ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT - RAIL_PAD;
    return { x: lx, y: ly };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isMyTurn) return;
      const pt = toTableCoords(e.clientX, e.clientY);
      if (!pt) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      pointerDownPosRef.current = pt;
      movedDuringDragRef.current = false;

      const cue = balls.find((b) => b.id === 0 && !b.pocketed);
      if (canPlaceCueBall && cue) {
        const distToCue = Math.hypot(pt.x - cue.x, pt.y - cue.y);
        if (distToCue <= BALL_RADIUS * 2.8) {
          dragModeRef.current = 'ball';
          return;
        }
      }

      dragModeRef.current = 'aim';
      if (cue) {
        const nearPocket = POCKETS.some((p) => Math.hypot(pt.x - p.x, pt.y - p.y) <= 44);
        if (!nearPocket && Math.hypot(pt.x - cue.x, pt.y - cue.y) > 8) {
          onAimChange(Math.atan2(pt.y - cue.y, pt.x - cue.x));
        }
      }
    },
    [balls, canPlaceCueBall, isMyTurn, onAimChange, toTableCoords]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isMyTurn || dragModeRef.current === 'none') return;
      const pt = toTableCoords(e.clientX, e.clientY);
      if (!pt) return;

      if (pointerDownPosRef.current) {
        const d = Math.hypot(
          pt.x - pointerDownPosRef.current.x,
          pt.y - pointerDownPosRef.current.y
        );
        if (d > 6) movedDuringDragRef.current = true;
      }

      if (dragModeRef.current === 'ball') {
        const behindHead = match.ballInHand === 'BEHIND_HEAD_STRING';
        const clamped = clampCueBallPosition(pt.x, pt.y, balls, behindHead);
        onCueBallMove(clamped);
      } else if (dragModeRef.current === 'aim') {
        const cue = balls.find((b) => b.id === 0 && !b.pocketed);
        if (cue) {
          const dx = pt.x - cue.x;
          const dy = pt.y - cue.y;
          if (Math.hypot(dx, dy) > 8) {
            onAimChange(Math.atan2(dy, dx));
          }
        }
      }
    },
    [balls, isMyTurn, match.ballInHand, onAimChange, onCueBallMove, toTableCoords]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (
        isMyTurn &&
        !match.isBreakShot &&
        !movedDuringDragRef.current &&
        dragModeRef.current !== 'ball'
      ) {
        const pt = toTableCoords(e.clientX, e.clientY);
        if (pt) {
          const clickedPocket = POCKETS.find(
            (p) => Math.hypot(pt.x - p.x, pt.y - p.y) <= 46
          );
          if (clickedPocket) {
            onCallPocket(calledPocket === clickedPocket.id ? null : clickedPocket.id);
          }
        }
      }

      dragModeRef.current = 'none';
      pointerDownPosRef.current = null;
    },
    [calledPocket, isMyTurn, match.isBreakShot, onCallPocket, toTableCoords]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const targetW = Math.round(LOGICAL_WIDTH * dpr);
    const targetH = Math.round(LOGICAL_HEIGHT * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      staticTableRef.current = createStaticTableCanvas(dpr);
    }
    if (!staticTableRef.current) {
      staticTableRef.current = createStaticTableCanvas(dpr);
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Blit pre-rendered mahogany & emerald baize table
    ctx.drawImage(staticTableRef.current, 0, 0);

    // 2. Transform into table playing coordinates
    ctx.scale(dpr, dpr);
    ctx.translate(RAIL_PAD, RAIL_PAD);

    // 3. Ball-in-hand zone highlight
    if (!isSimulating && match.phase === 'AIMING' && match.ballInHand !== 'NONE') {
      if (match.ballInHand === 'BEHIND_HEAD_STRING') {
        ctx.save();
        ctx.fillStyle = 'rgba(212, 175, 55, 0.085)';
        ctx.fillRect(2, 2, HEAD_STRING_X - 2, TABLE_HEIGHT - 4);
        ctx.strokeStyle = 'rgba(243, 208, 107, 0.48)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(3, 3, HEAD_STRING_X - 4, TABLE_HEIGHT - 6);
        ctx.restore();
      }
    }

    // 4. Pocket-calling indicators
    if (!isSimulating && match.phase === 'AIMING' && !match.isBreakShot) {
      if (mustCallEightPocket && calledPocket === null) {
        const pulse = 0.55 + 0.35 * Math.sin(performance.now() * 0.005);
        for (const p of POCKETS) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.visualRadius + 5.5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(243, 208, 107, ${pulse})`;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (calledPocket !== null) {
        const p = POCKETS[calledPocket];
        if (p) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.visualRadius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#F3D06B';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.visualRadius + 11.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(243, 208, 107, 0.45)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 5. Render pocket drop animations
    const now = performance.now();
    for (const [idStr, anim] of Object.entries(pocketAnims)) {
      const elapsed = now - anim.startTime;
      const progress = Math.min(1, elapsed / 240);
      if (progress >= 1) continue;
      const id = Number(idStr);
      const sprite = ballSpritesRef.current.get(id);
      if (!sprite) continue;

      const scale = 1 - progress * 0.65;
      const alpha = 1 - progress;
      const drawR = BALL_RADIUS * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        sprite,
        anim.pocketX - drawR,
        anim.pocketY - drawR,
        drawR * 2,
        drawR * 2
      );
      ctx.restore();
    }

    // 6. Render active balls on table with soft contact AO + directional shadow
    for (const b of balls) {
      if (b.pocketed) continue;

      // Contact AO ring
      ctx.beginPath();
      ctx.arc(b.x + 0.5, b.y + 0.8, BALL_RADIUS * 1.04, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fill();

      // Soft directional felt drop shadow
      ctx.beginPath();
      ctx.ellipse(b.x + 2.8, b.y + 3.4, BALL_RADIUS * 0.96, BALL_RADIUS * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.fill();

      // Ball-in-hand cue ball placement ring
      if (b.id === 0 && !isSimulating && match.phase === 'AIMING' && match.ballInHand !== 'NONE') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_RADIUS + 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = isMyTurn ? 'rgba(243, 208, 107, 0.92)' : 'rgba(243, 208, 107, 0.38)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.restore();
      }

      const sprite = ballSpritesRef.current.get(b.id);
      if (sprite) {
        ctx.drawImage(
          sprite,
          b.x - BALL_RADIUS,
          b.y - BALL_RADIUS,
          BALL_RADIUS * 2,
          BALL_RADIUS * 2
        );
      }
    }

    // 7. Aiming ray & wooden cue stick (never travels with moving cue ball)
    const cue = balls.find((b) => b.id === 0 && !b.pocketed);
    if (strikeAnim) {
      drawCueStick(
        ctx,
        strikeAnim.origin.x,
        strikeAnim.origin.y,
        strikeAnim.angle,
        strikeAnim.pullBackPx,
        strikeAnim.isOpponent,
        strikeAnim.alpha
      );
    } else if (cue && !isSimulating && match.phase === 'AIMING') {
      const preview = computeAimPreview(balls, aimAngle);
      let isLegalTarget = true;

      if (preview.hitBall && !match.isBreakShot) {
        const shooter = match.currentTurn;
        const hitId = preview.hitBall.id;
        const shooterGroup = match.groups[shooter];
        const onEight = isPlayerOnEightBall(match, shooter);

        if (match.isTableOpen) {
          isLegalTarget = hitId !== 8;
        } else if (onEight) {
          isLegalTarget = hitId === 8;
        } else if (shooterGroup) {
          isLegalTarget = getBallGroup(hitId) === shooterGroup;
        }
      }

      const guideColor = isLegalTarget
        ? 'rgba(250, 245, 232, 0.78)'
        : 'rgba(239, 68, 68, 0.88)';

      // Main aiming dashed line
      ctx.save();
      ctx.strokeStyle = guideColor;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(preview.ghostX, preview.ghostY);
      ctx.stroke();

      // Ghost ball circle
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(preview.ghostX, preview.ghostY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = isLegalTarget
        ? 'rgba(243, 208, 107, 0.88)'
        : 'rgba(239, 68, 68, 0.92)';
      ctx.lineWidth = 1.7;
      ctx.stroke();

      // Subtle center dot in ghost ball
      ctx.beginPath();
      ctx.arc(preview.ghostX, preview.ghostY, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = isLegalTarget
        ? 'rgba(243, 208, 107, 0.9)'
        : 'rgba(239, 68, 68, 0.9)';
      ctx.fill();

      // Target ball trajectory line
      if (preview.hitBall) {
        const pathLen = 58;
        ctx.beginPath();
        ctx.moveTo(preview.hitBall.x, preview.hitBall.y);
        ctx.lineTo(
          preview.hitBall.x + preview.targetDirX * pathLen,
          preview.hitBall.y + preview.targetDirY * pathLen
        );
        ctx.strokeStyle = isLegalTarget
          ? 'rgba(243, 208, 107, 0.9)'
          : 'rgba(239, 68, 68, 0.88)';
        ctx.lineWidth = 2.1;
        ctx.stroke();
      }
      ctx.restore();

      drawCueStick(
        ctx,
        cue.x,
        cue.y,
        aimAngle,
        8 + power * 92,
        !isMyTurn,
        1
      );
    }

    ctx.restore();
  }, [
    aimAngle,
    balls,
    calledPocket,
    isMyTurn,
    isSimulating,
    match,
    mustCallEightPocket,
    pocketAnims,
    power,
    strikeAnim,
  ]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="touch-game-surface w-full h-full max-w-full max-h-full object-contain drop-shadow-[0_20px_42px_rgba(0,0,0,0.85)] cursor-crosshair"
      style={{ aspectRatio: `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}` }}
    />
  );
};
