import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  clampCueBallPosition,
  cloneBalls,
  createInitialRack,
  isCueBallPositionValid,
  simulateFullShot,
} from './src/shared/physics.ts';
import { evaluateShotRules, isPlayerOnEightBall } from './src/shared/rules.ts';
import type {
  ClientMessage,
  MatchState,
  PlayerSeat,
  RoomState,
  ServerMessage,
  ShotStartPayload,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CLEANUP_MS = 15 * 60 * 1000;

interface ServerPlayer {
  seat: PlayerSeat;
  name: string;
  reconnectToken: string;
  connected: boolean;
  rematchReady: boolean;
  ws: WebSocket | null;
  lastSeenAt: number;
}

interface ServerRoom {
  roomCode: string;
  locked: boolean;
  host: ServerPlayer;
  guest: ServerPlayer | null;
  match: MatchState | null;
  shotTimer: ReturnType<typeof setTimeout> | null;
  updatedAt: number;
}

interface SocketMeta {
  roomCode: string | null;
  seat: PlayerSeat | null;
}

const rooms = new Map<string, ServerRoom>();
const socketMeta = new WeakMap<WebSocket, SocketMeta>();

function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 16);
  return trimmed.length > 0 ? trimmed : fallback;
}

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += ROOM_CHARS[bytes[i] % ROOM_CHARS.length];
    }
    if (!rooms.has(code)) {
      return code;
    }
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function createFreshMatch(breaker: PlayerSeat, matchNumber: number, breakerName: string): MatchState {
  return {
    matchNumber,
    phase: 'AIMING',
    balls: createInitialRack(),
    currentTurn: breaker,
    breaker,
    isBreakShot: true,
    isTableOpen: true,
    groups: {
      host: null,
      guest: null,
    },
    ballInHand: 'BEHIND_HEAD_STRING',
    calledPocket: null,
    lastFoul: null,
    lastEventMessage: `${breakerName} to break. Drag the cue ball behind the line or shoot!`,
    result: null,
    shotCount: 0,
    activeShotId: null,
  };
}

function toPublicRoomState(room: ServerRoom): RoomState {
  return {
    roomCode: room.roomCode,
    locked: room.locked,
    host: {
      seat: 'host',
      name: room.host.name,
      connected: room.host.connected,
      rematchReady: room.host.rematchReady,
    },
    guest: room.guest
      ? {
          seat: 'guest',
          name: room.guest.name,
          connected: room.guest.connected,
          rematchReady: room.guest.rematchReady,
        }
      : null,
    match: room.match,
  };
}

function sendMsg(ws: WebSocket | null, msg: ServerMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcastRoom(room: ServerRoom, msg: ServerMessage): void {
  sendMsg(room.host.ws, msg);
  if (room.guest) {
    sendMsg(room.guest.ws, msg);
  }
}

function broadcastRoomState(room: ServerRoom): void {
  broadcastRoom(room, {
    type: 'room:state',
    room: toPublicRoomState(room),
  });
}

function clearRoomShotTimer(room: ServerRoom): void {
  if (room.shotTimer) {
    clearTimeout(room.shotTimer);
    room.shotTimer = null;
  }
}

function getPlayer(room: ServerRoom, seat: PlayerSeat): ServerPlayer | null {
  return seat === 'host' ? room.host : room.guest;
}

function getOpponentSeat(seat: PlayerSeat): PlayerSeat {
  return seat === 'host' ? 'guest' : 'host';
}

function detachSocketFromRoom(ws: WebSocket, markDisconnected: boolean): void {
  const meta = socketMeta.get(ws);
  if (!meta || !meta.roomCode || !meta.seat) return;

  const room = rooms.get(meta.roomCode);
  if (room) {
    const player = getPlayer(room, meta.seat);
    if (player && player.ws === ws) {
      player.ws = null;
      if (markDisconnected) {
        player.connected = false;
        player.lastSeenAt = Date.now();
        room.updatedAt = Date.now();
        broadcastRoomState(room);
      }
    }
  }

  socketMeta.set(ws, { roomCode: null, seat: null });
}

function handleClientMessage(ws: WebSocket, raw: string): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    sendMsg(ws, { type: 'room:error', message: 'Invalid message format.' });
    return;
  }

  if (!msg || typeof msg.type !== 'string') return;

  // 1. CREATE ROOM (HOST) — enters the table immediately without waiting in a lobby
  if (msg.type === 'room:create') {
    detachSocketFromRoom(ws, true);
    const roomCode = generateRoomCode();
    const token = generateToken();
    const hostName = sanitizeName(msg.playerName, 'Player 1');

    const initialMatch = createFreshMatch('host', 1, hostName);
    initialMatch.lastEventMessage =
      'Table ready — share your code or warm up while waiting for Player 2.';

    const room: ServerRoom = {
      roomCode,
      locked: false,
      host: {
        seat: 'host',
        name: hostName,
        reconnectToken: token,
        connected: true,
        rematchReady: false,
        ws,
        lastSeenAt: Date.now(),
      },
      guest: null,
      match: initialMatch,
      shotTimer: null,
      updatedAt: Date.now(),
    };

    rooms.set(roomCode, room);
    socketMeta.set(ws, { roomCode, seat: 'host' });

    sendMsg(ws, {
      type: 'room:joined',
      roomCode,
      seat: 'host',
      reconnectToken: token,
      room: toPublicRoomState(room),
    });
    return;
  }

  // 2. JOIN ROOM (GUEST) — joins straight onto the host's table and locks the room
  if (msg.type === 'room:join') {
    const code = typeof msg.roomCode === 'string' ? msg.roomCode.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      sendMsg(ws, { type: 'room:error', message: 'Enter a valid 6-character room code.' });
      return;
    }

    const room = rooms.get(code);
    if (!room) {
      sendMsg(ws, { type: 'room:error', message: `Room ${code} was not found.` });
      return;
    }

    if (room.locked || room.guest !== null) {
      sendMsg(ws, {
        type: 'room:error',
        message: 'This match is already in progress and locked to new players.',
      });
      return;
    }

    detachSocketFromRoom(ws, true);
    const token = generateToken();
    const guestName = sanitizeName(msg.playerName, 'Player 2');

    room.guest = {
      seat: 'guest',
      name: guestName,
      reconnectToken: token,
      connected: true,
      rematchReady: false,
      ws,
      lastSeenAt: Date.now(),
    };
    room.locked = true;
    room.host.rematchReady = false;
    room.guest.rematchReady = false;

    // If host warmed up (took shots or simulating), reset to a fresh fair Match #1 rack
    if (
      !room.match ||
      room.match.shotCount > 0 ||
      room.match.phase === 'SIMULATING' ||
      room.match.phase === 'GAME_OVER'
    ) {
      clearRoomShotTimer(room);
      room.match = createFreshMatch('host', 1, room.host.name);
    }
    room.match.lastEventMessage = `${guestName} joined! ${room.host.name} to break.`;
    room.updatedAt = Date.now();
    socketMeta.set(ws, { roomCode: code, seat: 'guest' });

    sendMsg(ws, {
      type: 'room:joined',
      roomCode: code,
      seat: 'guest',
      reconnectToken: token,
      room: toPublicRoomState(room),
    });
    broadcastRoomState(room);
    return;
  }

  // 3. RECONNECT TO EXISTING ROOM
  if (msg.type === 'room:reconnect') {
    const code = typeof msg.roomCode === 'string' ? msg.roomCode.trim().toUpperCase() : '';
    const token = typeof msg.reconnectToken === 'string' ? msg.reconnectToken : '';
    const room = rooms.get(code);

    if (!room || !token) {
      sendMsg(ws, {
        type: 'room:error',
        code: 'RECONNECT_FAILED',
        message: 'Previous room session has expired.',
      });
      return;
    }

    let targetSeat: PlayerSeat | null = null;
    if (room.host.reconnectToken === token) {
      targetSeat = 'host';
    } else if (room.guest && room.guest.reconnectToken === token) {
      targetSeat = 'guest';
    }

    if (!targetSeat) {
      sendMsg(ws, {
        type: 'room:error',
        code: 'RECONNECT_FAILED',
        message: 'Could not verify room session.',
      });
      return;
    }

    const player = getPlayer(room, targetSeat);
    if (!player) return;

    if (player.ws && player.ws !== ws) {
      socketMeta.set(player.ws, { roomCode: null, seat: null });
    }

    player.ws = ws;
    player.connected = true;
    player.lastSeenAt = Date.now();
    room.updatedAt = Date.now();
    socketMeta.set(ws, { roomCode: code, seat: targetSeat });

    sendMsg(ws, {
      type: 'room:joined',
      roomCode: code,
      seat: targetSeat,
      reconnectToken: player.reconnectToken,
      room: toPublicRoomState(room),
    });
    broadcastRoomState(room);
    return;
  }

  // All following actions require active room membership
  const meta = socketMeta.get(ws);
  if (!meta || !meta.roomCode || !meta.seat) {
    sendMsg(ws, { type: 'room:error', message: 'Not connected to a room.' });
    return;
  }

  const room = rooms.get(meta.roomCode);
  if (!room) {
    sendMsg(ws, { type: 'room:error', message: 'Room no longer exists.' });
    return;
  }

  const seat = meta.seat;
  const player = getPlayer(room, seat);
  const oppSeat = getOpponentSeat(seat);
  const opponent = getPlayer(room, oppSeat);
  room.updatedAt = Date.now();

  // 4. LEAVE ROOM GRACEFULLY
  if (msg.type === 'room:leave') {
    if (seat === 'host') {
      if (room.guest && room.guest.ws) {
        sendMsg(room.guest.ws, {
          type: 'room:opponent_left',
          message: `${room.host.name} left the room.`,
        });
        socketMeta.set(room.guest.ws, { roomCode: null, seat: null });
      }
      clearRoomShotTimer(room);
      rooms.delete(room.roomCode);
    } else {
      if (room.match) {
        sendMsg(room.host.ws, {
          type: 'room:opponent_left',
          message: `${room.guest?.name ?? 'Opponent'} left the match.`,
        });
        clearRoomShotTimer(room);
        rooms.delete(room.roomCode);
      } else {
        room.guest = null;
        broadcastRoomState(room);
      }
    }
    socketMeta.set(ws, { roomCode: null, seat: null });
    return;
  }

  // 5. HOST STARTS MATCH
  if (msg.type === 'match:start') {
    if (seat !== 'host') {
      sendMsg(ws, { type: 'room:error', message: 'Only the host can start the match.' });
      return;
    }
    if (!room.guest || !room.guest.connected || !room.host.connected) {
      sendMsg(ws, { type: 'room:error', message: 'Both players must be connected to start.' });
      return;
    }
    if (room.match !== null) return;

    room.locked = true;
    room.host.rematchReady = false;
    room.guest.rematchReady = false;
    room.match = createFreshMatch('host', 1, room.host.name);
    broadcastRoomState(room);
    return;
  }

  // 6. REAL-TIME AIMING & PLACEMENT RELAY (Active player -> Opponent)
  if (msg.type === 'aim:update') {
    if (!room.match || room.match.phase !== 'AIMING' || room.match.currentTurn !== seat) {
      return;
    }
    if (
      typeof msg.preview?.angle !== 'number' ||
      !Number.isFinite(msg.preview.angle) ||
      typeof msg.preview?.power !== 'number' ||
      !Number.isFinite(msg.preview.power)
    ) {
      return;
    }
    sendMsg(opponent?.ws ?? null, {
      type: 'aim:remote',
      seat,
      preview: {
        angle: msg.preview.angle,
        power: Math.max(0, Math.min(1, msg.preview.power)),
        calledPocket:
          typeof msg.preview.calledPocket === 'number' ? msg.preview.calledPocket : null,
        cueBallX: msg.preview.cueBallX,
        cueBallY: msg.preview.cueBallY,
      },
    });
    return;
  }

  if (msg.type === 'ballinhand:update') {
    if (
      !room.match ||
      room.match.phase !== 'AIMING' ||
      room.match.currentTurn !== seat ||
      room.match.ballInHand === 'NONE'
    ) {
      return;
    }
    if (
      typeof msg.x !== 'number' ||
      !Number.isFinite(msg.x) ||
      typeof msg.y !== 'number' ||
      !Number.isFinite(msg.y)
    ) {
      return;
    }
    const behindHeadString = room.match.ballInHand === 'BEHIND_HEAD_STRING';
    const clamped = clampCueBallPosition(msg.x, msg.y, room.match.balls, behindHeadString);
    const cue = room.match.balls.find((b) => b.id === 0);
    if (cue) {
      cue.x = clamped.x;
      cue.y = clamped.y;
      cue.pocketed = false;
    }
    sendMsg(opponent?.ws ?? null, {
      type: 'ballinhand:remote',
      seat,
      x: clamped.x,
      y: clamped.y,
    });
    return;
  }

  if (msg.type === 'pocket:call') {
    if (!room.match || room.match.phase !== 'AIMING' || room.match.currentTurn !== seat) {
      return;
    }
    const pid =
      msg.pocketId !== null &&
      Number.isInteger(msg.pocketId) &&
      msg.pocketId >= 0 &&
      msg.pocketId <= 5
        ? msg.pocketId
        : null;
    room.match.calledPocket = pid;
    sendMsg(opponent?.ws ?? null, {
      type: 'pocket:remote',
      seat,
      pocketId: pid,
    });
    return;
  }

  // 7. SERVER-AUTHORITATIVE SHOT EXECUTION
  if (msg.type === 'shot:execute') {
    const match = room.match;
    if (!match || match.phase !== 'AIMING' || match.currentTurn !== seat) {
      sendMsg(ws, { type: 'room:error', message: 'Wait for your turn before shooting.' });
      return;
    }

    if (
      typeof msg.angle !== 'number' ||
      !Number.isFinite(msg.angle) ||
      typeof msg.power !== 'number' ||
      !Number.isFinite(msg.power)
    ) {
      sendMsg(ws, { type: 'room:error', message: 'Invalid shot parameters.' });
      return;
    }

    const power = Math.max(0.03, Math.min(1, msg.power));
    const calledPocket =
      msg.calledPocket !== null &&
      Number.isInteger(msg.calledPocket) &&
      msg.calledPocket >= 0 &&
      msg.calledPocket <= 5
        ? msg.calledPocket
        : null;

    if (!match.isBreakShot && isPlayerOnEightBall(match, seat) && calledPocket === null) {
      sendMsg(ws, {
        type: 'room:error',
        message: 'Tap a pocket on the table to call your 8-ball shot first.',
      });
      return;
    }

    const preShotBalls = cloneBalls(match.balls);
    const cue = preShotBalls.find((b) => b.id === 0);
    if (!cue) return;

    let cuePos = { x: cue.x, y: cue.y };
    if (match.ballInHand !== 'NONE' && msg.cueBallPos) {
      const behindHead = match.ballInHand === 'BEHIND_HEAD_STRING';
      if (
        typeof msg.cueBallPos.x === 'number' &&
        Number.isFinite(msg.cueBallPos.x) &&
        typeof msg.cueBallPos.y === 'number' &&
        Number.isFinite(msg.cueBallPos.y)
      ) {
        if (isCueBallPositionValid(msg.cueBallPos.x, msg.cueBallPos.y, preShotBalls, behindHead)) {
          cuePos = { x: msg.cueBallPos.x, y: msg.cueBallPos.y };
        } else {
          cuePos = clampCueBallPosition(
            msg.cueBallPos.x,
            msg.cueBallPos.y,
            preShotBalls,
            behindHead
          );
        }
        cue.x = cuePos.x;
        cue.y = cuePos.y;
        cue.pocketed = false;
      }
    }

    // Run deterministic physics & WPA rules validation on server
    const { finalBalls, events, simFrames } = simulateFullShot(
      preShotBalls,
      msg.angle,
      power,
      cuePos
    );

    const playerNames: Record<PlayerSeat, string> = {
      host: room.host.name,
      guest: room.guest?.name ?? 'Player 2',
    };

    const nextMatchState = evaluateShotRules(
      match,
      finalBalls,
      events,
      calledPocket,
      playerNames
    );

    const shotId = crypto.randomBytes(6).toString('hex');
    match.phase = 'SIMULATING';
    match.activeShotId = shotId;
    match.balls = preShotBalls;

    const payload: ShotStartPayload = {
      shotId,
      shooter: seat,
      angle: msg.angle,
      power,
      calledPocket,
      cueBallPos: cuePos,
      preShotBalls,
      simFrames,
    };

    broadcastRoom(room, { type: 'shot:start', payload });

    clearRoomShotTimer(room);
    const durationMs = Math.ceil((simFrames / 60) * 1000) + 340;
    room.shotTimer = setTimeout(() => {
      room.shotTimer = null;
      const currentRoom = rooms.get(room.roomCode);
      if (!currentRoom) return;
      currentRoom.match = nextMatchState;
      currentRoom.updatedAt = Date.now();
      broadcastRoom(currentRoom, { type: 'shot:settled', match: nextMatchState });
    }, durationMs);
    return;
  }

  // 8. REMATCH REQUEST
  if (msg.type === 'rematch:request') {
    if (!room.match || room.match.phase !== 'GAME_OVER') return;

    // Allow host to re-rack warm-up table if guest hasn't joined yet
    if (!room.guest) {
      room.host.rematchReady = false;
      room.match = createFreshMatch('host', 1, room.host.name);
      room.match.lastEventMessage =
        'Table ready — share your code or warm up while waiting for Player 2.';
      broadcastRoomState(room);
      return;
    }

    if (!room.guest.connected || !room.host.connected) {
      sendMsg(ws, { type: 'room:error', message: 'Opponent is not connected.' });
      return;
    }
    if (player) {
      player.rematchReady = true;
    }

    if (room.host.rematchReady && room.guest.rematchReady) {
      const nextBreaker: PlayerSeat = room.match.breaker === 'host' ? 'guest' : 'host';
      const nextMatchNumber = room.match.matchNumber + 1;
      const breakerName = nextBreaker === 'host' ? room.host.name : room.guest.name;
      room.host.rematchReady = false;
      room.guest.rematchReady = false;
      room.match = createFreshMatch(nextBreaker, nextMatchNumber, breakerName);
    }

    broadcastRoomState(room);
  }
}

// Cleanup abandoned rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const hostAway = !room.host.connected;
    const guestAway = !room.guest || !room.guest.connected;
    if (hostAway && guestAway && now - room.updatedAt > ROOM_CLEANUP_MS) {
      clearRoomShotTimer(room);
      rooms.delete(code);
    }
  }
}, 60_000);

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    socketMeta.set(ws, { roomCode: null, seat: null });

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      if (text === '{"type":"ping"}') {
        sendMsg(ws, { type: 'pong' });
        return;
      }
      handleClientMessage(ws, text);
    });

    ws.on('close', () => {
      detachSocketFromRoom(ws, true);
    });

    ws.on('error', () => {
      detachSocketFromRoom(ws, true);
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Grand Regency 8-Ball server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
