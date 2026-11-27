import {
  BALL_RADIUS,
  FOOT_SPOT_Y,
  HEAD_STRING_X,
  POCKETS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  clampCueBallPosition,
  isCueBallPositionValid,
  simulateFullShot,
} from './physics.ts';
import { getBallGroup, isPlayerOnEightBall } from './rules.ts';
import type { BallState, MatchState, PlayerSeat, Vector2D } from './types.ts';

export type BotDifficulty = 'CASUAL' | 'PRO' | 'MASTER';

export interface BotDecision {
  cueBallPos: Vector2D;
  angle: number;
  power: number;
  calledPocket: number | null;
}

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isPathClear(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  balls: BallState[],
  ignoreIds: number[]
): boolean {
  const clearance = BALL_RADIUS * 2 - 1.5;
  for (const b of balls) {
    if (b.pocketed || ignoreIds.includes(b.id)) continue;
    const dist = pointToSegmentDist(b.x, b.y, x1, y1, x2, y2);
    if (dist < clearance) return false;
  }
  return true;
}

function getLegalTargetIds(match: MatchState, botSeat: PlayerSeat): number[] {
  const active = match.balls.filter((b) => !b.pocketed && b.id !== 0);
  if (match.isBreakShot) {
    return [1];
  }
  if (match.isTableOpen) {
    return active.filter((b) => b.id !== 8).map((b) => b.id);
  }
  if (isPlayerOnEightBall(match, botSeat)) {
    return [8];
  }
  const grp = match.groups[botSeat];
  return active.filter((b) => getBallGroup(b.id) === grp).map((b) => b.id);
}

function pickBestCueBallPlacement(
  match: MatchState,
  botSeat: PlayerSeat
): Vector2D {
  const behindHead = match.ballInHand === 'BEHIND_HEAD_STRING';
  const targetIds = getLegalTargetIds(match, botSeat);

  if (match.isBreakShot) {
    return clampCueBallPosition(HEAD_STRING_X - 4, FOOT_SPOT_Y, match.balls, true);
  }

  let bestPos: Vector2D | null = null;
  let bestScore = -Infinity;

  // Try placing behind each legal target aligned with a pocket
  for (const tid of targetIds) {
    const target = match.balls.find((b) => b.id === tid && !b.pocketed);
    if (!target) continue;

    for (const pocket of POCKETS) {
      const toPocketX = pocket.x - target.x;
      const toPocketY = pocket.y - target.y;
      const pDist = Math.hypot(toPocketX, toPocketY) || 1;
      const ux = toPocketX / pDist;
      const uy = toPocketY / pDist;

      // Ghost ball spot behind target
      const ghostX = target.x - ux * (BALL_RADIUS * 2);
      const ghostY = target.y - uy * (BALL_RADIUS * 2);

      if (!isPathClear(target.x, target.y, pocket.x, pocket.y, match.balls, [0, tid])) {
        continue;
      }

      for (const distBack of [90, 145, 200]) {
        const candX = ghostX - ux * distBack;
        const candY = ghostY - uy * distBack;
        if (!isCueBallPositionValid(candX, candY, match.balls, behindHead)) continue;
        if (!isPathClear(candX, candY, ghostX, ghostY, match.balls, [0, tid])) continue;

        const score = 1000 - pDist - distBack * 0.2;
        if (score > bestScore) {
          bestScore = score;
          bestPos = { x: candX, y: candY };
        }
      }
    }
  }

  if (bestPos) return bestPos;

  // Grid fallback search
  const maxX = behindHead ? HEAD_STRING_X - 4 : TABLE_WIDTH - BALL_RADIUS - 12;
  for (let x = 80; x <= maxX; x += 40) {
    for (let y = 70; y <= TABLE_HEIGHT - 70; y += 45) {
      if (isCueBallPositionValid(x, y, match.balls, behindHead)) {
        return { x, y };
      }
    }
  }

  return clampCueBallPosition(160, FOOT_SPOT_Y, match.balls, behindHead);
}

export function computeBotShot(
  match: MatchState,
  botSeat: PlayerSeat,
  difficulty: BotDifficulty
): BotDecision {
  const cueBall = match.balls.find((b) => b.id === 0);
  const cuePos: Vector2D =
    match.ballInHand !== 'NONE'
      ? pickBestCueBallPlacement(match, botSeat)
      : { x: cueBall?.x ?? HEAD_STRING_X, y: cueBall?.y ?? FOOT_SPOT_Y };

  // Opening Break Shot
  if (match.isBreakShot) {
    const apex = match.balls.find((b) => b.id === 1 && !b.pocketed);
    const angle = apex
      ? Math.atan2(apex.y - cuePos.y, apex.x - cuePos.x) + (Math.random() - 0.5) * 0.025
      : 0;
    return {
      cueBallPos: cuePos,
      angle,
      power: 0.92,
      calledPocket: null,
    };
  }

  const targetIds = getLegalTargetIds(match, botSeat);
  const onEight = isPlayerOnEightBall(match, botSeat);

  interface Candidate {
    angle: number;
    power: number;
    pocketId: number;
    score: number;
  }

  const candidates: Candidate[] = [];

  for (const tid of targetIds) {
    const target = match.balls.find((b) => b.id === tid && !b.pocketed);
    if (!target) continue;

    for (const pocket of POCKETS) {
      const toPocketX = pocket.x - target.x;
      const toPocketY = pocket.y - target.y;
      const pocketDist = Math.hypot(toPocketX, toPocketY);
      if (pocketDist < 1) continue;

      const tux = toPocketX / pocketDist;
      const tuy = toPocketY / pocketDist;

      // Ghost ball coordinates for clean cut into pocket
      const ghostX = target.x - tux * (BALL_RADIUS * 2);
      const ghostY = target.y - tuy * (BALL_RADIUS * 2);

      // Keep ghost ball inside table bounds
      if (
        ghostX < BALL_RADIUS ||
        ghostX > TABLE_WIDTH - BALL_RADIUS ||
        ghostY < BALL_RADIUS ||
        ghostY > TABLE_HEIGHT - BALL_RADIUS
      ) {
        continue;
      }

      const toGhostX = ghostX - cuePos.x;
      const toGhostY = ghostY - cuePos.y;
      const cueDist = Math.hypot(toGhostX, toGhostY);
      if (cueDist < 1) continue;

      const cux = toGhostX / cueDist;
      const cuy = toGhostY / cueDist;

      // Alignment dot product (1.0 = dead straight, 0 = 90deg impossible cut)
      const alignment = cux * tux + cuy * tuy;
      if (alignment < 0.34) continue;

      if (!isPathClear(cuePos.x, cuePos.y, ghostX, ghostY, match.balls, [0, tid])) {
        continue;
      }
      if (!isPathClear(target.x, target.y, pocket.x, pocket.y, match.balls, [0, tid])) {
        continue;
      }

      const idealPower = Math.max(
        0.34,
        Math.min(0.84, 0.32 + (cueDist + pocketDist) / 1450 + (1 - alignment) * 0.25)
      );

      const score = alignment * 420 - pocketDist * 0.22 - cueDist * 0.16;
      candidates.push({
        angle: Math.atan2(cuy, cux),
        power: idealPower,
        pocketId: pocket.id,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Verify top candidates with actual physics to avoid accidental scratches or premature 8-ball sinks
  const maxCheck = difficulty === 'MASTER' ? 8 : difficulty === 'PRO' ? 5 : 3;
  for (let i = 0; i < Math.min(maxCheck, candidates.length); i++) {
    const cand = candidates[i];
    const sim = simulateFullShot(match.balls, cand.angle, cand.power, cuePos);
    const scratched = sim.events.cueScratched || sim.events.cueLeftTable;
    const sankEight = sim.events.pocketed.some((p) => p.ballId === 8);
    if (scratched) continue;
    if (sankEight && !onEight) continue;

    // Add difficulty-appropriate aim imperfection
    const jitterDeg =
      difficulty === 'MASTER' ? 0.35 : difficulty === 'PRO' ? 1.5 : 3.6;
    const jitterRad = ((Math.random() - 0.5) * 2 * jitterDeg * Math.PI) / 180;

    return {
      cueBallPos: cuePos,
      angle: cand.angle + jitterRad,
      power: cand.power,
      calledPocket: cand.pocketId,
    };
  }

  // Fallback: hit a legal target ball cleanly with moderate speed so we avoid a foul
  for (const tid of targetIds) {
    const target = match.balls.find((b) => b.id === tid && !b.pocketed);
    if (!target) continue;
    if (isPathClear(cuePos.x, cuePos.y, target.x, target.y, match.balls, [0, tid])) {
      const ang = Math.atan2(target.y - cuePos.y, target.x - cuePos.x);
      return {
        cueBallPos: cuePos,
        angle: ang,
        power: 0.56,
        calledPocket: onEight ? 0 : null,
      };
    }
  }

  // Last resort: bank toward nearest legal target
  const fallbackTarget = match.balls.find((b) => targetIds.includes(b.id) && !b.pocketed);
  const fallbackAngle = fallbackTarget
    ? Math.atan2(fallbackTarget.y - cuePos.y, fallbackTarget.x - cuePos.x)
    : 0;

  return {
    cueBallPos: cuePos,
    angle: fallbackAngle,
    power: 0.62,
    calledPocket: onEight ? 0 : null,
  };
}
