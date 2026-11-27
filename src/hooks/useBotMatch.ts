import { useCallback, useEffect, useRef, useState } from 'react';
import { type BotDifficulty, computeBotShot } from '../shared/botAi.ts';
import {
  clampCueBallPosition,
  cloneBalls,
  createInitialRack,
  isCueBallPositionValid,
  simulateFullShot,
} from '../shared/physics.ts';
import { evaluateShotRules, isPlayerOnEightBall } from '../shared/rules.ts';
import type {
  AimPreviewState,
  MatchState,
  PlayerSeat,
  RoomState,
  ShotStartPayload,
  Vector2D,
} from '../shared/types.ts';

function createFreshBotMatch(
  breaker: PlayerSeat,
  matchNumber: number,
  playerName: string,
  botName: string
): MatchState {
  const breakerName = breaker === 'host' ? playerName : botName;
  return {
    matchNumber,
    phase: 'AIMING',
    balls: createInitialRack(),
    currentTurn: breaker,
    breaker,
    isBreakShot: true,
    isTableOpen: true,
    groups: { host: null, guest: null },
    ballInHand: 'BEHIND_HEAD_STRING',
    calledPocket: null,
    lastFoul: null,
    lastEventMessage: `${breakerName} to break.`,
    result: null,
    shotCount: 0,
    activeShotId: null,
  };
}

const BOT_NAMES: Record<BotDifficulty, string> = {
  CASUAL: 'Eddie (Bot)',
  PRO: 'Regency Pro (Bot)',
  MASTER: 'The Shark (Bot)',
};

export function useBotMatch() {
  const [active, setActive] = useState(false);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('PRO');
  const [playerName, setPlayerName] = useState('You');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [botAim, setBotAim] = useState<AimPreviewState | null>(null);
  const [botBallPos, setBotBallPos] = useState<Vector2D | null>(null);
  const [botPocketCall, setBotPocketCall] = useState<number | null>(null);
  const [activeShot, setActiveShot] = useState<ShotStartPayload | null>(null);

  const roomRef = useRef<RoomState | null>(null);
  roomRef.current = room;
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    for (const t of botTimersRef.current) {
      clearTimeout(t);
    }
    botTimersRef.current = [];
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const startBotMatch = useCallback(
    (name: string, diff: BotDifficulty) => {
      clearAllTimers();
      const cleanName = name.trim().slice(0, 16) || 'Player 1';
      const botName = BOT_NAMES[diff];
      setPlayerName(cleanName);
      setDifficulty(diff);
      setBotAim(null);
      setBotBallPos(null);
      setBotPocketCall(null);
      setActiveShot(null);
      const nextRoom: RoomState = {
        roomCode: 'BOT',
        locked: true,
        host: {
          seat: 'host',
          name: cleanName,
          connected: true,
          rematchReady: false,
        },
        guest: {
          seat: 'guest',
          name: botName,
          connected: true,
          rematchReady: false,
        },
        match: createFreshBotMatch('host', 1, cleanName, botName),
      };
      roomRef.current = nextRoom;
      setRoom(nextRoom);
      setActive(true);
    },
    [clearAllTimers]
  );

  const exitBotMatch = useCallback(() => {
    clearAllTimers();
    roomRef.current = null;
    setActive(false);
    setRoom(null);
    setActiveShot(null);
    setBotAim(null);
    setBotBallPos(null);
    setBotPocketCall(null);
  }, [clearAllTimers]);

  const runShot = useCallback(
    (
      shooter: PlayerSeat,
      angle: number,
      power: number,
      calledPocket: number | null,
      cueBallPos: Vector2D
    ) => {
      const prev = roomRef.current;
      if (!prev || !prev.match || prev.match.phase !== 'AIMING') return;
      const match = prev.match;
      if (match.currentTurn !== shooter) return;
      if (!match.isBreakShot && isPlayerOnEightBall(match, shooter) && calledPocket === null) {
        return;
      }

      const preShotBalls = cloneBalls(match.balls);
      const cue = preShotBalls.find((b) => b.id === 0);
      if (!cue) return;

      let validPos = { x: cue.x, y: cue.y };
      if (match.ballInHand !== 'NONE') {
        const behindHead = match.ballInHand === 'BEHIND_HEAD_STRING';
        validPos = isCueBallPositionValid(
          cueBallPos.x,
          cueBallPos.y,
          preShotBalls,
          behindHead
        )
          ? cueBallPos
          : clampCueBallPosition(cueBallPos.x, cueBallPos.y, preShotBalls, behindHead);
        cue.x = validPos.x;
        cue.y = validPos.y;
        cue.pocketed = false;
      }

      const clampedPower = Math.max(0.03, Math.min(1, power));
      const { finalBalls, events, simFrames } = simulateFullShot(
        preShotBalls,
        angle,
        clampedPower,
        validPos
      );

      const names: Record<PlayerSeat, string> = {
        host: prev.host.name,
        guest: prev.guest?.name ?? 'Bot',
      };
      const nextMatch = evaluateShotRules(
        match,
        finalBalls,
        events,
        calledPocket,
        names
      );

      const shotId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const payload: ShotStartPayload = {
        shotId,
        shooter,
        angle,
        power: clampedPower,
        calledPocket,
        cueBallPos: validPos,
        preShotBalls,
        simFrames,
      };

      const simulatingRoom: RoomState = {
        ...prev,
        match: {
          ...match,
          phase: 'SIMULATING',
          activeShotId: shotId,
          balls: preShotBalls,
        },
      };
      roomRef.current = simulatingRoom;
      setRoom(simulatingRoom);
      setActiveShot(payload);
      setBotAim(null);
      setBotBallPos(null);
      setBotPocketCall(null);

      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      const durationMs = Math.ceil((simFrames / 60) * 1000) + 340;
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        setActiveShot(null);
        setRoom((curr) => {
          if (!curr) return curr;
          const settled = { ...curr, match: nextMatch };
          roomRef.current = settled;
          return settled;
        });
      }, durationMs);
    },
    []
  );

  const executeHumanShot = useCallback(
    (angle: number, power: number, calledPocket: number | null, cueBallPos: Vector2D) => {
      runShot('host', angle, power, calledPocket, cueBallPos);
    },
    [runShot]
  );

  const updateHumanBallInHand = useCallback((x: number, y: number) => {
    setRoom((prev) => {
      if (!prev || !prev.match || prev.match.currentTurn !== 'host') return prev;
      if (prev.match.ballInHand === 'NONE') return prev;
      const behindHead = prev.match.ballInHand === 'BEHIND_HEAD_STRING';
      const clamped = clampCueBallPosition(x, y, prev.match.balls, behindHead);
      const nextBalls = prev.match.balls.map((b) =>
        b.id === 0 ? { ...b, x: clamped.x, y: clamped.y, pocketed: false } : b
      );
      return { ...prev, match: { ...prev.match, balls: nextBalls } };
    });
  }, []);

  const requestBotRematch = useCallback(() => {
    clearAllTimers();
    setBotAim(null);
    setBotBallPos(null);
    setBotPocketCall(null);
    setActiveShot(null);
    setRoom((prev) => {
      if (!prev || !prev.match) return prev;
      const nextBreaker: PlayerSeat = prev.match.breaker === 'host' ? 'guest' : 'host';
      const nextNum = prev.match.matchNumber + 1;
      const botName = prev.guest?.name ?? BOT_NAMES[difficulty];
      return {
        ...prev,
        match: createFreshBotMatch(nextBreaker, nextNum, playerName, botName),
      };
    });
  }, [clearAllTimers, difficulty, playerName]);

  // Bot turn orchestration whenever it is guest's turn in AIMING phase
  const matchPhase = room?.match?.phase;
  const currentTurn = room?.match?.currentTurn;
  const shotCount = room?.match?.shotCount;

  useEffect(() => {
    if (!active || !room?.match) return;
    if (matchPhase !== 'AIMING' || currentTurn !== 'guest') return;

    for (const t of botTimersRef.current) clearTimeout(t);
    botTimersRef.current = [];

    const snapshot = room.match;
    const decision = computeBotShot(snapshot, 'guest', difficulty);

    // Step 1: If bot has ball-in-hand, visibly place cue ball after 450ms
    const tPlace = setTimeout(() => {
      if (snapshot.ballInHand !== 'NONE') {
        setBotBallPos(decision.cueBallPos);
        setRoom((prev) => {
          if (!prev || !prev.match || prev.match.currentTurn !== 'guest') return prev;
          const nextBalls = prev.match.balls.map((b) =>
            b.id === 0
              ? {
                  ...b,
                  x: decision.cueBallPos.x,
                  y: decision.cueBallPos.y,
                  pocketed: false,
                }
              : b
          );
          return { ...prev, match: { ...prev.match, balls: nextBalls } };
        });
      }
      setBotPocketCall(decision.calledPocket);
      setBotAim({
        angle: decision.angle,
        power: 0.12,
        calledPocket: decision.calledPocket,
      });
    }, 480);

    // Step 2: Pull back cue power smoothly
    const tPull = setTimeout(() => {
      setBotAim({
        angle: decision.angle,
        power: decision.power,
        calledPocket: decision.calledPocket,
      });
    }, 950);

    // Step 3: Bot takes the shot
    const tShoot = setTimeout(() => {
      runShot(
        'guest',
        decision.angle,
        decision.power,
        decision.calledPocket,
        decision.cueBallPos
      );
    }, 1350);

    botTimersRef.current = [tPlace, tPull, tShoot];

    return () => {
      for (const t of botTimersRef.current) clearTimeout(t);
      botTimersRef.current = [];
    };
  }, [active, currentTurn, difficulty, matchPhase, runShot, shotCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    active,
    difficulty,
    room,
    botAim,
    botBallPos,
    botPocketCall,
    activeShot,
    startBotMatch,
    exitBotMatch,
    executeHumanShot,
    updateHumanBallInHand,
    requestBotRematch,
  };
}
