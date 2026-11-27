import type {
  BallState,
  PocketDef,
  ShotCollisionAudioEvent,
  ShotEvents,
  Vector2D,
} from './types.ts';

export const TABLE_WIDTH = 1000;
export const TABLE_HEIGHT = 500;
export const BALL_RADIUS = 13.5;
export const HEAD_STRING_X = 250;
export const FOOT_SPOT_X = 750;
export const FOOT_SPOT_Y = 250;

export const MAX_SHOT_SPEED = 24.5; // pixels per 60Hz frame
export const MIN_SHOT_SPEED = 1.4;
export const SUBSTEPS = 8;
export const FRICTION_DECAY = 0.9865; // exponential rolling drag per 60Hz frame
export const LINEAR_DECEL = 0.0115; // Coulomb friction stop per 60Hz frame
export const SETTLE_SPEED = 0.045;
export const BALL_RESTITUTION = 0.96;
export const CUSHION_RESTITUTION = 0.82;
export const MAX_SIM_FRAMES = 900; // 15s hard cap

export const POCKETS: PocketDef[] = [
  { id: 0, name: 'Top Left', x: 10, y: 10, visualRadius: 26, captureRadius: 24, isCorner: true },
  { id: 1, name: 'Top Side', x: 500, y: -4, visualRadius: 24, captureRadius: 22, isCorner: false },
  { id: 2, name: 'Top Right', x: 990, y: 10, visualRadius: 26, captureRadius: 24, isCorner: true },
  { id: 3, name: 'Bottom Left', x: 10, y: 490, visualRadius: 26, captureRadius: 24, isCorner: true },
  { id: 4, name: 'Bottom Side', x: 500, y: 504, visualRadius: 24, captureRadius: 22, isCorner: false },
  { id: 5, name: 'Bottom Right', x: 990, y: 490, visualRadius: 26, captureRadius: 24, isCorner: true },
];

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Cushion boundary segments with realistic pocket openings and angled pocket jaws
const CUSHION_SEGMENTS: Segment[] = [
  // Top left rail
  { x1: 42, y1: 0, x2: 472, y2: 0 },
  // Top right rail
  { x1: 528, y1: 0, x2: 958, y2: 0 },
  // Bottom left rail
  { x1: 42, y1: TABLE_HEIGHT, x2: 472, y2: TABLE_HEIGHT },
  // Bottom right rail
  { x1: 528, y1: TABLE_HEIGHT, x2: 958, y2: TABLE_HEIGHT },
  // Left rail
  { x1: 0, y1: 42, x2: 0, y2: TABLE_HEIGHT - 42 },
  // Right rail
  { x1: TABLE_WIDTH, y1: 42, x2: TABLE_WIDTH, y2: TABLE_HEIGHT - 42 },

  // Corner pocket angled jaws (top-left)
  { x1: 42, y1: 0, x2: 20, y2: -20 },
  { x1: 0, y1: 42, x2: -20, y2: 20 },
  // Corner pocket angled jaws (top-right)
  { x1: 958, y1: 0, x2: 980, y2: -20 },
  { x1: TABLE_WIDTH, y1: 42, x2: TABLE_WIDTH + 20, y2: 20 },
  // Corner pocket angled jaws (bottom-left)
  { x1: 42, y1: TABLE_HEIGHT, x2: 20, y2: TABLE_HEIGHT + 20 },
  { x1: 0, y1: TABLE_HEIGHT - 42, x2: -20, y2: TABLE_HEIGHT - 20 },
  // Corner pocket angled jaws (bottom-right)
  { x1: 958, y1: TABLE_HEIGHT, x2: 980, y2: TABLE_HEIGHT + 20 },
  { x1: TABLE_WIDTH, y1: TABLE_HEIGHT - 42, x2: TABLE_WIDTH + 20, y2: TABLE_HEIGHT - 20 },

  // Side pocket angled jaws (top-side)
  { x1: 472, y1: 0, x2: 478, y2: -24 },
  { x1: 528, y1: 0, x2: 522, y2: -24 },
  // Side pocket angled jaws (bottom-side)
  { x1: 472, y1: TABLE_HEIGHT, x2: 478, y2: TABLE_HEIGHT + 24 },
  { x1: 528, y1: TABLE_HEIGHT, x2: 522, y2: TABLE_HEIGHT + 24 },
];

export function cloneBalls(balls: BallState[]): BallState[] {
  return balls.map((b) => ({ ...b }));
}

// Standard WPA 15-ball rack with 8-ball in center and one solid + one stripe on back corners
const RACK_ORDER: number[] = [
  1,
  9, 2,
  10, 8, 3,
  4, 11, 5, 12,
  13, 6, 14, 7, 15,
];

export function createInitialRack(): BallState[] {
  const balls: BallState[] = [
    {
      id: 0,
      x: HEAD_STRING_X,
      y: FOOT_SPOT_Y,
      vx: 0,
      vy: 0,
      pocketed: false,
      pocketId: null,
    },
  ];

  const gap = 0.4;
  const diameter = BALL_RADIUS * 2 + gap;
  const rowStepX = diameter * Math.cos(Math.PI / 6); // sqrt(3)/2 * diameter

  let index = 0;
  for (let row = 0; row < 5; row++) {
    const countInRow = row + 1;
    const x = FOOT_SPOT_X + row * rowStepX;
    const startY = FOOT_SPOT_Y - (row * diameter) / 2;

    for (let col = 0; col < countInRow; col++) {
      const id = RACK_ORDER[index++];
      const y = startY + col * diameter;
      balls.push({
        id,
        x,
        y,
        vx: 0,
        vy: 0,
        pocketed: false,
        pocketId: null,
      });
    }
  }

  return balls;
}

export function isCueBallPositionValid(
  x: number,
  y: number,
  balls: BallState[],
  behindHeadString: boolean
): boolean {
  const minX = BALL_RADIUS + 2;
  const maxX = behindHeadString ? HEAD_STRING_X : TABLE_WIDTH - BALL_RADIUS - 2;
  const minY = BALL_RADIUS + 2;
  const maxY = TABLE_HEIGHT - BALL_RADIUS - 2;

  if (x < minX || x > maxX || y < minY || y > maxY) {
    return false;
  }

  for (const b of balls) {
    if (b.id === 0 || b.pocketed) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    const minDist = BALL_RADIUS * 2 + 0.5;
    if (dx * dx + dy * dy < minDist * minDist) {
      return false;
    }
  }
  return true;
}

export function clampCueBallPosition(
  x: number,
  y: number,
  balls: BallState[],
  behindHeadString: boolean
): Vector2D {
  const minX = BALL_RADIUS + 2;
  const maxX = behindHeadString ? HEAD_STRING_X : TABLE_WIDTH - BALL_RADIUS - 2;
  const minY = BALL_RADIUS + 2;
  const maxY = TABLE_HEIGHT - BALL_RADIUS - 2;

  let cx = Math.max(minX, Math.min(maxX, x));
  let cy = Math.max(minY, Math.min(maxY, y));

  // Push out from any overlapping balls iteratively
  const minDist = BALL_RADIUS * 2 + 1.0;
  for (let iter = 0; iter < 12; iter++) {
    let pushed = false;
    for (const b of balls) {
      if (b.id === 0 || b.pocketed) continue;
      const dx = cx - b.x;
      const dy = cy - b.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        if (dist < 0.001) {
          cx += minDist;
        } else {
          const push = minDist - dist;
          cx += (dx / dist) * push;
          cy += (dy / dist) * push;
        }
        cx = Math.max(minX, Math.min(maxX, cx));
        cy = Math.max(minY, Math.min(maxY, cy));
        pushed = true;
      }
    }
    if (!pushed) break;
  }

  return { x: cx, y: cy };
}

export function findSafeCueBallSpot(
  balls: BallState[],
  behindHeadString: boolean
): Vector2D {
  const candidates: Vector2D[] = [
    { x: HEAD_STRING_X, y: FOOT_SPOT_Y },
    { x: 180, y: 250 },
    { x: 180, y: 170 },
    { x: 180, y: 330 },
    { x: 120, y: 250 },
  ];

  for (const c of candidates) {
    if (isCueBallPositionValid(c.x, c.y, balls, behindHeadString)) {
      return c;
    }
  }

  const maxSearchX = behindHeadString ? HEAD_STRING_X : TABLE_WIDTH - BALL_RADIUS - 10;
  for (let gx = 60; gx <= maxSearchX; gx += 20) {
    for (let gy = 60; gy <= TABLE_HEIGHT - 60; gy += 20) {
      if (isCueBallPositionValid(gx, gy, balls, behindHeadString)) {
        return { x: gx, y: gy };
      }
    }
  }

  return clampCueBallPosition(160, 250, balls, behindHeadString);
}

export function spotEightBall(balls: BallState[]): BallState[] {
  const next = cloneBalls(balls);
  const eight = next.find((b) => b.id === 8);
  if (!eight) return next;

  let sx = FOOT_SPOT_X;
  let sy = FOOT_SPOT_Y;
  const minDist = BALL_RADIUS * 2 + 0.5;

  // Move right toward foot rail along center line until spot is free
  while (sx < TABLE_WIDTH - BALL_RADIUS - 4) {
    let blocked = false;
    for (const b of next) {
      if (b.id === 8 || b.pocketed) continue;
      const dx = sx - b.x;
      const dy = sy - b.y;
      if (dx * dx + dy * dy < minDist * minDist) {
        blocked = true;
        break;
      }
    }
    if (!blocked) break;
    sx += 2;
  }

  eight.x = sx;
  eight.y = sy;
  eight.vx = 0;
  eight.vy = 0;
  eight.pocketed = false;
  eight.pocketId = null;
  return next;
}

export function applyCueStrike(
  balls: BallState[],
  angle: number,
  power: number,
  cueBallPos?: Vector2D
): BallState[] {
  const next = cloneBalls(balls);
  const cue = next.find((b) => b.id === 0);
  if (!cue) return next;

  const clampedPower = Math.max(0.03, Math.min(1, power));
  const speed = MIN_SHOT_SPEED + clampedPower * (MAX_SHOT_SPEED - MIN_SHOT_SPEED);

  if (cueBallPos) {
    cue.x = cueBallPos.x;
    cue.y = cueBallPos.y;
  }
  cue.pocketed = false;
  cue.pocketId = null;
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;

  return next;
}

function resolveBallCushionCollisions(
  ball: BallState,
  events: ShotEvents,
  frame: number,
  audioBuffer: ShotCollisionAudioEvent[]
): void {
  let hitCushion = false;
  let maxImpact = 0;

  for (const seg of CUSHION_SEGMENTS) {
    const abx = seg.x2 - seg.x1;
    const aby = seg.y2 - seg.y1;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) continue;

    const apx = ball.x - seg.x1;
    const apy = ball.y - seg.y1;
    let t = (apx * abx + apy * aby) / abLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;

    const closestX = seg.x1 + t * abx;
    const closestY = seg.y1 + t * aby;

    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < BALL_RADIUS * BALL_RADIUS) {
      const dist = Math.sqrt(distSq);
      let nx = 0;
      let ny = 0;
      if (dist > 1e-6) {
        nx = dx / dist;
        ny = dy / dist;
      } else {
        // Fallback normal perpendicular to segment
        const len = Math.sqrt(abLenSq);
        nx = -aby / len;
        ny = abx / len;
      }

      const overlap = BALL_RADIUS - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        const impulse = -(1 + CUSHION_RESTITUTION) * vn;
        ball.vx += impulse * nx;
        ball.vy += impulse * ny;
        hitCushion = true;
        maxImpact = Math.max(maxImpact, Math.abs(vn));
      }
    }
  }

  if (hitCushion) {
    if (events.firstContactBallId !== null) {
      events.cushionAfterContact = true;
    }
    if (ball.id !== 0 && !events.breakCushionBallIds.includes(ball.id)) {
      events.breakCushionBallIds.push(ball.id);
    }
    if (maxImpact > 0.35) {
      audioBuffer.push({
        frame,
        type: 'cushion',
        intensity: Math.min(1, maxImpact / 14),
      });
    }
  }
}

export function stepPhysicsFrame(
  balls: BallState[],
  events: ShotEvents,
  frame: number
): boolean {
  const dt = 1 / SUBSTEPS;
  const subAudio: ShotCollisionAudioEvent[] = [];

  for (let step = 0; step < SUBSTEPS; step++) {
    // 1. Advance positions
    for (const b of balls) {
      if (b.pocketed) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    // 2. Check pocket capture & table boundaries
    for (const b of balls) {
      if (b.pocketed) continue;

      let captured = false;
      for (const p of POCKETS) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (dx * dx + dy * dy <= p.captureRadius * p.captureRadius) {
          b.pocketed = true;
          b.pocketId = p.id;
          b.vx = 0;
          b.vy = 0;
          b.x = p.x;
          b.y = p.y;
          if (b.id === 0) {
            events.cueScratched = true;
          } else {
            events.pocketed.push({
              ballId: b.id,
              pocketId: p.id,
              order: events.pocketed.length,
            });
          }
          subAudio.push({ frame, type: 'pocket', intensity: 0.9 });
          captured = true;
          break;
        }
      }

      if (captured) continue;

      // Safety out-of-bounds check (cue ball leaving table)
      if (b.x < -38 || b.x > TABLE_WIDTH + 38 || b.y < -38 || b.y > TABLE_HEIGHT + 38) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        if (b.id === 0) {
          events.cueLeftTable = true;
          events.cueScratched = true;
        }
        continue;
      }

      // 3. Ball-to-cushion collisions
      resolveBallCushionCollisions(b, events, frame, subAudio);
    }

    // 4. Ball-to-ball elastic collisions
    const minDist = BALL_RADIUS * 2;
    const minDistSq = minDist * minDist;

    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;

      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq) {
          const dist = Math.sqrt(distSq);
          let nx = 1;
          let ny = 0;
          if (dist > 1e-6) {
            nx = dx / dist;
            ny = dy / dist;
          }

          // Separate overlap symmetrically
          const overlap = minDist - dist;
          a.x -= nx * (overlap * 0.5);
          a.y -= ny * (overlap * 0.5);
          b.x += nx * (overlap * 0.5);
          b.y += ny * (overlap * 0.5);

          // Record first object ball hit by cue ball
          if (events.firstContactBallId === null) {
            if (a.id === 0 && b.id !== 0) {
              events.firstContactBallId = b.id;
            } else if (b.id === 0 && a.id !== 0) {
              events.firstContactBallId = a.id;
            }
          }

          // Relative velocity along collision normal
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const jImpulse = (-(1 + BALL_RESTITUTION) * velAlongNormal) * 0.5;
            const ix = jImpulse * nx;
            const iy = jImpulse * ny;
            a.vx -= ix;
            a.vy -= iy;
            b.vx += ix;
            b.vy += iy;

            const impact = Math.abs(velAlongNormal);
            if (impact > 0.2) {
              subAudio.push({
                frame,
                type: 'ball',
                intensity: Math.min(1, impact / 18),
              });
            }
          }
        }
      }
    }
  }

  // Deduplicate/cap audio events per frame so break doesn't clip speaker
  if (subAudio.length > 0) {
    const strongestBall = subAudio
      .filter((e) => e.type === 'ball')
      .sort((a, b) => b.intensity - a.intensity)[0];
    if (strongestBall) events.audioEvents.push(strongestBall);

    const strongestCushion = subAudio
      .filter((e) => e.type === 'cushion')
      .sort((a, b) => b.intensity - a.intensity)[0];
    if (strongestCushion) events.audioEvents.push(strongestCushion);

    for (const p of subAudio.filter((e) => e.type === 'pocket')) {
      events.audioEvents.push(p);
    }
  }

  // 5. Apply rolling friction once per frame and check settling
  let anyMoving = false;
  for (const b of balls) {
    if (b.pocketed) continue;

    b.vx *= FRICTION_DECAY;
    b.vy *= FRICTION_DECAY;

    const speed = Math.hypot(b.vx, b.vy);
    if (speed <= SETTLE_SPEED) {
      b.vx = 0;
      b.vy = 0;
    } else {
      const nextSpeed = Math.max(0, speed - LINEAR_DECEL);
      if (nextSpeed <= SETTLE_SPEED) {
        b.vx = 0;
        b.vy = 0;
      } else {
        const scale = nextSpeed / speed;
        b.vx *= scale;
        b.vy *= scale;
        anyMoving = true;
      }
    }
  }

  return anyMoving;
}

export function createEmptyShotEvents(): ShotEvents {
  return {
    firstContactBallId: null,
    cushionAfterContact: false,
    breakCushionBallIds: [],
    pocketed: [],
    cueScratched: false,
    cueLeftTable: false,
    audioEvents: [],
  };
}

export function simulateFullShot(
  preShotBalls: BallState[],
  angle: number,
  power: number,
  cueBallPos?: Vector2D
): { finalBalls: BallState[]; events: ShotEvents; simFrames: number } {
  const balls = applyCueStrike(preShotBalls, angle, power, cueBallPos);
  const events = createEmptyShotEvents();

  let frame = 0;
  let moving = true;
  while (moving && frame < MAX_SIM_FRAMES) {
    moving = stepPhysicsFrame(balls, events, frame);
    frame++;
  }

  // Ensure velocities are zeroed if hard cap reached
  for (const b of balls) {
    b.vx = 0;
    b.vy = 0;
  }

  return { finalBalls: balls, events, simFrames: frame };
}

export interface AimRayHit {
  ghostX: number;
  ghostY: number;
  hitBall: BallState | null;
  targetDirX: number;
  targetDirY: number;
  hitPocketId: number | null;
}

export function computeAimPreview(
  balls: BallState[],
  angle: number
): AimRayHit {
  const cue = balls.find((b) => b.id === 0 && !b.pocketed);
  if (!cue) {
    return {
      ghostX: 0,
      ghostY: 0,
      hitBall: null,
      targetDirX: 0,
      targetDirY: 0,
      hitPocketId: null,
    };
  }

  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Distance to inner cushion walls
  let minT = Infinity;
  if (dx > 1e-6) minT = Math.min(minT, (TABLE_WIDTH - BALL_RADIUS - cue.x) / dx);
  else if (dx < -1e-6) minT = Math.min(minT, (BALL_RADIUS - cue.x) / dx);
  if (dy > 1e-6) minT = Math.min(minT, (TABLE_HEIGHT - BALL_RADIUS - cue.y) / dy);
  else if (dy < -1e-6) minT = Math.min(minT, (BALL_RADIUS - cue.y) / dy);

  let hitBall: BallState | null = null;
  const sumR = BALL_RADIUS * 2;
  const sumRSq = sumR * sumR;

  for (const b of balls) {
    if (b.id === 0 || b.pocketed) continue;
    const ocX = b.x - cue.x;
    const ocY = b.y - cue.y;
    const proj = ocX * dx + ocY * dy;
    if (proj <= 0) continue;

    const perpSq = ocX * ocX + ocY * ocY - proj * proj;
    if (perpSq >= sumRSq) continue;

    const thc = Math.sqrt(sumRSq - perpSq);
    const t = proj - thc;
    if (t >= 0 && t < minT) {
      minT = t;
      hitBall = b;
    }
  }

  const ghostX = cue.x + dx * minT;
  const ghostY = cue.y + dy * minT;

  let targetDirX = 0;
  let targetDirY = 0;
  let hitPocketId: number | null = null;

  if (hitBall) {
    const tx = hitBall.x - ghostX;
    const ty = hitBall.y - ghostY;
    const len = Math.hypot(tx, ty) || 1;
    targetDirX = tx / len;
    targetDirY = ty / len;

    // Check if target ball trajectory points cleanly toward a pocket
    let bestPocketDist = 42;
    for (const p of POCKETS) {
      const px = p.x - hitBall.x;
      const py = p.y - hitBall.y;
      const proj = px * targetDirX + py * targetDirY;
      if (proj <= 0) continue;
      const perp = Math.hypot(px - targetDirX * proj, py - targetDirY * proj);
      if (perp < bestPocketDist) {
        bestPocketDist = perp;
        hitPocketId = p.id;
      }
    }
  }

  return {
    ghostX,
    ghostY,
    hitBall,
    targetDirX,
    targetDirY,
    hitPocketId,
  };
}
