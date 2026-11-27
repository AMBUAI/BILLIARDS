export type BallGroup = 'SOLIDS' | 'STRIPES';

export type PlayerSeat = 'host' | 'guest';

export type BallInHandMode = 'NONE' | 'ANYWHERE' | 'BEHIND_HEAD_STRING';

export type MatchPhase = 'WAITING' | 'AIMING' | 'SIMULATING' | 'GAME_OVER';

export interface Vector2D {
  x: number;
  y: number;
}

export interface BallState {
  id: number; // 0 = cue ball, 1-7 = solids, 8 = eight-ball, 9-15 = stripes
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
  pocketId: number | null;
}

export interface PocketDef {
  id: number;
  name: string;
  x: number;
  y: number;
  visualRadius: number;
  captureRadius: number;
  isCorner: boolean;
}

export interface PocketedEvent {
  ballId: number;
  pocketId: number;
  order: number;
}

export interface ShotCollisionAudioEvent {
  frame: number;
  type: 'ball' | 'cushion' | 'pocket';
  intensity: number;
}

export interface ShotEvents {
  firstContactBallId: number | null;
  cushionAfterContact: boolean;
  breakCushionBallIds: number[];
  pocketed: PocketedEvent[];
  cueScratched: boolean;
  cueLeftTable: boolean;
  audioEvents: ShotCollisionAudioEvent[];
}

export interface FoulInfo {
  reason: string;
  committedBy: PlayerSeat;
  ballInHandAwarded: BallInHandMode;
}

export interface MatchResult {
  winner: PlayerSeat;
  loser: PlayerSeat;
  reason: string;
  isPrematureEightBall: boolean;
}

export interface MatchState {
  matchNumber: number;
  phase: MatchPhase;
  balls: BallState[];
  currentTurn: PlayerSeat;
  breaker: PlayerSeat;
  isBreakShot: boolean;
  isTableOpen: boolean;
  groups: Record<PlayerSeat, BallGroup | null>;
  ballInHand: BallInHandMode;
  calledPocket: number | null;
  lastFoul: FoulInfo | null;
  lastEventMessage: string;
  result: MatchResult | null;
  shotCount: number;
  activeShotId: string | null;
}

export interface PlayerInfo {
  seat: PlayerSeat;
  name: string;
  connected: boolean;
  rematchReady: boolean;
}

export interface RoomState {
  roomCode: string;
  locked: boolean;
  host: PlayerInfo;
  guest: PlayerInfo | null;
  match: MatchState | null;
}

export interface AimPreviewState {
  angle: number;
  power: number;
  calledPocket: number | null;
  cueBallX?: number;
  cueBallY?: number;
}

export interface ShotStartPayload {
  shotId: string;
  shooter: PlayerSeat;
  angle: number;
  power: number;
  calledPocket: number | null;
  cueBallPos: Vector2D;
  preShotBalls: BallState[];
  simFrames: number;
}

// Client -> Server messages
export type ClientMessage =
  | { type: 'room:create'; playerName: string }
  | { type: 'room:join'; roomCode: string; playerName: string }
  | { type: 'room:reconnect'; roomCode: string; reconnectToken: string }
  | { type: 'room:leave' }
  | { type: 'match:start' }
  | { type: 'aim:update'; preview: AimPreviewState }
  | { type: 'ballinhand:update'; x: number; y: number }
  | { type: 'pocket:call'; pocketId: number | null }
  | {
      type: 'shot:execute';
      angle: number;
      power: number;
      calledPocket: number | null;
      cueBallPos: Vector2D;
    }
  | { type: 'rematch:request' };

// Server -> Client messages
export type ServerMessage =
  | {
      type: 'room:joined';
      roomCode: string;
      seat: PlayerSeat;
      reconnectToken: string;
      room: RoomState;
    }
  | { type: 'room:state'; room: RoomState }
  | { type: 'room:error'; message: string; code?: string }
  | { type: 'room:opponent_left'; message: string }
  | { type: 'aim:remote'; seat: PlayerSeat; preview: AimPreviewState }
  | { type: 'ballinhand:remote'; seat: PlayerSeat; x: number; y: number }
  | { type: 'pocket:remote'; seat: PlayerSeat; pocketId: number | null }
  | { type: 'shot:start'; payload: ShotStartPayload }
  | { type: 'shot:settled'; match: MatchState }
  | { type: 'pong' };
