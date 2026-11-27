import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Home,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings,
  Trophy,
  Users,
  WifiOff,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine.ts';
import {
  POCKETS,
  applyCueStrike,
  cloneBalls,
  createEmptyShotEvents,
  stepPhysicsFrame,
} from '../shared/physics.ts';
import { isPlayerOnEightBall } from '../shared/rules.ts';
import type {
  AimPreviewState,
  BallGroup,
  BallState,
  MatchState,
  PlayerSeat,
  RoomState,
  ShotEvents,
  ShotStartPayload,
  Vector2D,
} from '../shared/types.ts';
import { BallBadge } from './BallBadge.tsx';
import { BrassCorners } from './BrassCorners.tsx';
import type { BotDifficulty } from '../shared/botAi.ts';
import {
  type CueStrikeAnim,
  type PocketAnimationMap,
  PoolCanvas,
} from './PoolCanvas.tsx';
import { PowerBar } from './PowerBar.tsx';

interface GameViewProps {
  room: RoomState;
  mySeat: PlayerSeat;
  match: MatchState;
  remoteAim: AimPreviewState | null;
  remoteBallPos: Vector2D | null;
  remotePocketCall: number | null;
  activeShot: ShotStartPayload | null;
  isBotMatch?: boolean;
  botDifficulty?: BotDifficulty;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSendAim: (preview: AimPreviewState) => void;
  onSendBallInHand: (x: number, y: number) => void;
  onCallPocket: (pocketId: number | null) => void;
  onExecuteShot: (
    angle: number,
    power: number,
    calledPocket: number | null,
    cueBallPos: Vector2D
  ) => void;
  onRequestRematch: () => void;
  onLeaveRoom: () => void;
  onOpenSettings: () => void;
}

const SOLID_IDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPE_IDS = [9, 10, 11, 12, 13, 14, 15];

export const GameView: React.FC<GameViewProps> = ({
  room,
  mySeat,
  match,
  remoteAim,
  remoteBallPos,
  remotePocketCall,
  activeShot,
  isBotMatch = false,
  botDifficulty = 'PRO',
  isFullscreen = false,
  onToggleFullscreen,
  onSendAim,
  onSendBallInHand,
  onCallPocket,
  onExecuteShot,
  onRequestRematch,
  onLeaveRoom,
  onOpenSettings,
}) => {
  const [aimAngle, setAimAngle] = useState<number>(0);
  const [power, setPower] = useState<number>(0);
  const [calledPocket, setCalledPocket] = useState<number | null>(match.calledPocket);
  const [renderBalls, setRenderBalls] = useState<BallState[]>(() => cloneBalls(match.balls));
  const [strikeAnim, setStrikeAnim] = useState<CueStrikeAnim | null>(null);
  const [pocketAnims, setPocketAnims] = useState<PocketAnimationMap>({});
  const [copiedCode, setCopiedCode] = useState(false);
  const [shotPending, setShotPending] = useState(false);

  const aimAngleRef = useRef<number>(0);
  aimAngleRef.current = aimAngle;
  const nudgeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAimSendRef = useRef<number>(0);
  const lastBallSendRef = useRef<number>(0);
  const simFrameLoopRef = useRef<number | null>(null);
  const soundPlayedResultRef = useRef<number>(0);

  const isSimulating = Boolean(activeShot) || match.phase === 'SIMULATING';
  const isMyTurn = !isSimulating && match.currentTurn === mySeat && match.phase === 'AIMING';
  const oppSeat: PlayerSeat = mySeat === 'host' ? 'guest' : 'host';
  const hostPlayer = room.host;
  const guestPlayer = room.guest;
  const waitingForGuest = !isBotMatch && guestPlayer === null;
  const opponentConnected =
    isBotMatch || (mySeat === 'host' ? Boolean(guestPlayer?.connected) : hostPlayer.connected);

  const mustCallPocket =
    isMyTurn && !match.isBreakShot && isPlayerOnEightBall(match, mySeat);

  useEffect(() => {
    if (match.phase !== 'SIMULATING') {
      if (simFrameLoopRef.current !== null) {
        cancelAnimationFrame(simFrameLoopRef.current);
        simFrameLoopRef.current = null;
      }
      setRenderBalls(cloneBalls(match.balls));
      setCalledPocket(match.calledPocket);
      setStrikeAnim(null);
      setPower(0);
      setShotPending(false);
    }
  }, [match]);

  useEffect(() => {
    if (!shotPending) return;
    const timer = setTimeout(() => {
      setShotPending(false);
      setPower(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, [shotPending]);

  useEffect(() => {
    if (match.phase === 'GAME_OVER' && match.result) {
      if (soundPlayedResultRef.current !== match.matchNumber) {
        soundPlayedResultRef.current = match.matchNumber;
        if (match.result.winner === mySeat) {
          soundEngine.playVictory();
        } else {
          soundEngine.playDefeat();
        }
      }
    } else {
      soundPlayedResultRef.current = 0;
    }
  }, [match.matchNumber, match.phase, match.result, mySeat]);

  useEffect(() => {
    if (match.phase === 'AIMING' && !isMyTurn && remoteAim) {
      setAimAngle(remoteAim.angle);
      setPower(remoteAim.power);
      setCalledPocket(remoteAim.calledPocket);
    }
  }, [isMyTurn, match.phase, remoteAim]);

  useEffect(() => {
    if (match.phase === 'AIMING' && !isMyTurn && remoteBallPos) {
      setRenderBalls((prev) =>
        prev.map((b) =>
          b.id === 0 ? { ...b, x: remoteBallPos.x, y: remoteBallPos.y, pocketed: false } : b
        )
      );
    }
  }, [isMyTurn, match.phase, remoteBallPos]);

  useEffect(() => {
    if (match.phase === 'AIMING' && !isMyTurn) {
      setCalledPocket(remotePocketCall);
    }
  }, [isMyTurn, match.phase, remotePocketCall]);

  useEffect(() => {
    if (!activeShot) return;

    if (simFrameLoopRef.current !== null) {
      cancelAnimationFrame(simFrameLoopRef.current);
      simFrameLoopRef.current = null;
    }

    // Freeze balls at pre-shot positions during the brief 75ms cue strike wind-forward
    setRenderBalls(cloneBalls(activeShot.preShotBalls));
    setPower(0);
    setShotPending(false);

    const simBalls = applyCueStrike(
      activeShot.preShotBalls,
      activeShot.angle,
      activeShot.power,
      activeShot.cueBallPos
    );
    const simEvents: ShotEvents = createEmptyShotEvents();
    const localPocketAnims: PocketAnimationMap = {};
    const seenPocketed = new Set<number>();

    const STRIKE_WIND_MS = 75;
    const STICK_FADE_MS = 145;
    const startPullPx = 8 + activeShot.power * 92;
    const isRemoteShooter = activeShot.shooter !== mySeat;

    setStrikeAnim({
      origin: activeShot.cueBallPos,
      angle: activeShot.angle,
      pullBackPx: startPullPx,
      alpha: 1,
      isOpponent: isRemoteShooter,
    });

    let frame = 0;
    let strikeSoundPlayed = false;
    const animStart = performance.now();
    let lastSimTs = animStart + STRIKE_WIND_MS;
    let accumulator = 0;
    const STEP_MS = 1000 / 60;

    const tick = (now: number) => {
      const elapsed = now - animStart;

      // 1. Update cue stick anchored at shot origin (never moves with cue ball)
      if (elapsed < STRIKE_WIND_MS) {
        const t = elapsed / STRIKE_WIND_MS;
        const easeIn = t * t;
        const currentPull = startPullPx * (1 - easeIn) + 2 * easeIn;
        setStrikeAnim({
          origin: activeShot.cueBallPos,
          angle: activeShot.angle,
          pullBackPx: currentPull,
          alpha: 1,
          isOpponent: isRemoteShooter,
        });
      } else {
        if (!strikeSoundPlayed) {
          strikeSoundPlayed = true;
          soundEngine.playCueStrike(activeShot.power, match.isBreakShot);
        }

        const fadeElapsed = elapsed - STRIKE_WIND_MS;
        if (fadeElapsed < STICK_FADE_MS) {
          const ft = fadeElapsed / STICK_FADE_MS;
          setStrikeAnim({
            origin: activeShot.cueBallPos,
            angle: activeShot.angle,
            pullBackPx: 1,
            alpha: 1 - ft,
            isOpponent: isRemoteShooter,
          });
        } else {
          setStrikeAnim(null);
        }

        // 2. Step ball physics only AFTER cue tip impact
        const dt = Math.min(64, Math.max(0, now - lastSimTs));
        lastSimTs = now;
        accumulator += dt;

        let stepped = false;
        let lastAudioCount = simEvents.audioEvents.length;

        while (accumulator >= STEP_MS && frame < activeShot.simFrames) {
          stepPhysicsFrame(simBalls, simEvents, frame);
          frame++;
          accumulator -= STEP_MS;
          stepped = true;

          for (let i = lastAudioCount; i < simEvents.audioEvents.length; i++) {
            const ev = simEvents.audioEvents[i];
            if (ev.type === 'ball') {
              soundEngine.playBallCollision(ev.intensity);
            } else if (ev.type === 'cushion') {
              soundEngine.playCushionBounce(ev.intensity);
            } else if (ev.type === 'pocket') {
              soundEngine.playPocketDrop();
            }
          }
          lastAudioCount = simEvents.audioEvents.length;

          for (const p of simEvents.pocketed) {
            if (!seenPocketed.has(p.ballId)) {
              seenPocketed.add(p.ballId);
              const pocketDef = POCKETS[p.pocketId];
              if (pocketDef) {
                localPocketAnims[p.ballId] = {
                  startTime: now,
                  pocketX: pocketDef.x,
                  pocketY: pocketDef.y,
                };
              }
            }
          }
        }

        if (stepped) {
          setRenderBalls(cloneBalls(simBalls));
          setPocketAnims({ ...localPocketAnims });
        }
      }

      if (frame < activeShot.simFrames || elapsed < STRIKE_WIND_MS + STICK_FADE_MS) {
        simFrameLoopRef.current = requestAnimationFrame(tick);
      } else {
        setStrikeAnim(null);
        simFrameLoopRef.current = null;
      }
    };

    simFrameLoopRef.current = requestAnimationFrame(tick);

    return () => {
      if (simFrameLoopRef.current !== null) {
        cancelAnimationFrame(simFrameLoopRef.current);
        simFrameLoopRef.current = null;
      }
    };
  }, [activeShot]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAimChange = useCallback(
    (nextAngle: number) => {
      setAimAngle(nextAngle);
      const now = performance.now();
      if (now - lastAimSendRef.current > 45) {
        lastAimSendRef.current = now;
        onSendAim({ angle: nextAngle, power, calledPocket });
      }
    },
    [calledPocket, onSendAim, power]
  );

  const stopFineAimHold = useCallback(() => {
    if (nudgeTimerRef.current) {
      clearInterval(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);

  const startFineAimHold = useCallback(
    (delta: number) => {
      if (!isMyTurn) return;
      stopFineAimHold();
      handleAimChange(aimAngleRef.current + delta);
      nudgeTimerRef.current = setInterval(() => {
        handleAimChange(aimAngleRef.current + delta);
      }, 45);
    },
    [handleAimChange, isMyTurn, stopFineAimHold]
  );

  useEffect(() => () => stopFineAimHold(), [stopFineAimHold]);

  const handlePowerChange = useCallback(
    (nextPower: number) => {
      setPower(nextPower);
      const now = performance.now();
      if (now - lastAimSendRef.current > 45 || nextPower === 0) {
        lastAimSendRef.current = now;
        onSendAim({ angle: aimAngle, power: nextPower, calledPocket });
      }
    },
    [aimAngle, calledPocket, onSendAim]
  );

  const handleCueBallMove = useCallback(
    (pos: Vector2D) => {
      setRenderBalls((prev) =>
        prev.map((b) => (b.id === 0 ? { ...b, x: pos.x, y: pos.y, pocketed: false } : b))
      );
      const now = performance.now();
      if (now - lastBallSendRef.current > 45) {
        lastBallSendRef.current = now;
        onSendBallInHand(pos.x, pos.y);
      }
    },
    [onSendBallInHand]
  );

  const handleCallPocket = useCallback(
    (pocketId: number | null) => {
      soundEngine.playMenuClick();
      setCalledPocket(pocketId);
      onCallPocket(pocketId);
    },
    [onCallPocket]
  );

  const handleShoot = useCallback(
    (shotPower: number) => {
      if (!isMyTurn || shotPending) return;
      if (mustCallPocket && calledPocket === null) return;
      const cue = renderBalls.find((b) => b.id === 0);
      if (!cue) return;
      setShotPending(true);
      onExecuteShot(aimAngle, shotPower, calledPocket, { x: cue.x, y: cue.y });
    },
    [aimAngle, calledPocket, isMyTurn, mustCallPocket, onExecuteShot, renderBalls, shotPending]
  );

  const renderPlayerTray = (seat: PlayerSeat) => {
    const player = seat === 'host' ? hostPlayer : guestPlayer;
    if (seat === 'guest' && !player) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-[#d4af37]/20 bg-[#17110d]/95 px-3 py-1 min-w-0">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#c6bcac] truncate">Open Seat</div>
            <div className="mt-0.5 text-[10px] text-[#9c9282]">Waiting for Player 2</div>
          </div>
        </div>
      );
    }

    const name = player?.name ?? 'Opponent';
    const group: BallGroup | null = match.groups[seat];
    const isTurn = match.currentTurn === seat && match.phase !== 'GAME_OVER';
    const isMe = seat === mySeat;

    const groupIds =
      group === 'SOLIDS' ? SOLID_IDS : group === 'STRIPES' ? STRIPE_IDS : [];
    const pocketedSet = new Set(
      renderBalls.filter((b) => b.pocketed).map((b) => b.id)
    );
    const remainingCount = groupIds.filter((id) => !pocketedSet.has(id)).length;
    const onEight = group !== null && remainingCount === 0;

    return (
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-1 transition-all min-w-0 ${
          isTurn
            ? 'border-[#f3d06b]/85 bg-gradient-to-b from-[#0e6040] to-[#083e29] shadow-[0_0_16px_rgba(212,175,55,0.22)]'
            : 'border-[#d4af37]/20 bg-[#17110d]/95 opacity-85'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate max-w-[90px] sm:max-w-[130px] text-xs font-bold text-[#faf4e6]">
              {name}
            </span>
            {isMe && <span className="text-[10px] text-[#f3d06b] font-semibold">(You)</span>}
            {isTurn && (
              <span className="text-[10px] font-extrabold tracking-wide text-[#f7da84] uppercase whitespace-nowrap">
                · Shooting
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-1.5">
            {group ? (
              <>
                <span className="text-[10px] font-semibold tracking-wide text-[#f3d06b]">
                  {onEight ? 'ON 8-BALL' : group}
                </span>
                <div className="hidden sm:flex items-center gap-0.5">
                  {groupIds.map((id) => (
                    <BallBadge key={id} id={id} pocketed={pocketedSet.has(id)} size={14} />
                  ))}
                  {onEight && <BallBadge id={8} pocketed={pocketedSet.has(8)} size={14} />}
                </div>
                <span className="sm:hidden font-mono-nums text-[10px] text-[#e6decb]">
                  ({onEight ? '8' : `${remainingCount} left`})
                </span>
              </>
            ) : (
              <span className="text-[10px] text-[#b4aa9a]">Open Table</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const myReady = mySeat === 'host' ? hostPlayer.rematchReady : Boolean(guestPlayer?.rematchReady);
  const oppReady =
    oppSeat === 'host' ? hostPlayer.rematchReady : Boolean(guestPlayer?.rematchReady);

  return (
    <div className="casino-parlor-bg relative flex h-dvh w-screen flex-col overflow-hidden">
      {/* Mahogany & Brass Scoreboard Top HUD */}
      <header className="flex h-12 sm:h-14 shrink-0 items-center justify-between gap-2 border-b border-[#d4af37]/30 bg-gradient-to-b from-[#1a120e] to-[#110c09] px-2.5 sm:px-4 shadow-md">
        {renderPlayerTray('host')}

        {/* Center Match Status & Foul Notice */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center px-1">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold text-[#d4af37]">
            <span className="font-mono-nums tracking-wider">
              {isBotMatch ? `OFFLINE · ${botDifficulty} BOT` : `ROOM ${room.roomCode}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {match.isBreakShot
                ? 'Break Shot'
                : match.isTableOpen
                ? 'Open Table'
                : 'Groups Assigned'}
            </span>
          </div>
          <div
            className={`truncate max-w-full text-[11px] sm:text-xs font-medium ${
              match.lastFoul ? 'text-amber-300' : 'text-[#eae2d2]'
            }`}
          >
            {match.lastFoul ? (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
                <span className="truncate">{match.lastEventMessage}</span>
              </span>
            ) : (
              match.lastEventMessage
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {renderPlayerTray('guest')}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playMenuClick();
                onToggleFullscreen();
              }}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
              className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl border border-[#d4af37]/35 bg-[#1d1410] text-[#d4af37] hover:border-[#f3d06b]/60 hover:bg-[#2a1e18] transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuClick();
              onOpenSettings();
            }}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl border border-[#d4af37]/35 bg-[#1d1410] text-[#d4af37] hover:border-[#f3d06b]/60 hover:bg-[#2a1e18] transition-colors"
            aria-label="Open Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Waiting for Opponent Room Code Bar OR Disconnected Banner */}
      {waitingForGuest ? (
        <div className="flex shrink-0 items-center justify-center gap-3 border-b border-[#d4af37]/25 bg-[#150f0c]/95 px-3 py-1 text-xs text-[#dfd7c8]">
          <span className="inline-flex items-center gap-1.5 text-[#f3d06b] font-semibold">
            <Users className="h-3.5 w-3.5" />
            <span>Room Code:</span>
          </span>
          <span className="font-mono-nums font-bold tracking-[0.18em] text-[#f7da84]">
            {room.roomCode}
          </span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuClick();
              navigator.clipboard?.writeText(room.roomCode).catch(() => {});
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 1800);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[#d4af37]/35 bg-[#231914] px-2.5 py-0.5 text-[11px] font-semibold text-[#f5efe2] hover:bg-[#31231c]"
          >
            {copiedCode ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-[#d4af37]" />
                <span>Copy</span>
              </>
            )}
          </button>
          <span className="hidden sm:inline text-[#a59b8a]">
            · Feel free to warm up while Player 2 joins
          </span>
        </div>
      ) : (
        !opponentConnected && (
          <div className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/35 bg-amber-950/80 px-3 py-1 text-xs font-medium text-amber-200">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Opponent disconnected — match state preserved while waiting for reconnection.</span>
          </div>
        )
      )}

      {/* Main Landscape Pool Arena */}
      <main className="flex min-h-0 flex-1 items-center justify-between gap-1.5 sm:gap-3 px-2 py-1.5 sm:px-4 sm:py-2">
        {/* Left Precision Aim & Pocket Indicator Rail */}
        <aside className="flex h-full w-12 sm:w-14 shrink-0 flex-col items-center justify-between py-1">
          <div className="text-center">
            <div className="text-[9px] font-semibold tracking-wider text-[#d4af37] uppercase">
              Aim
            </div>
            <div className="font-mono-nums text-[10px] font-bold text-[#faf4e6]">
              {Math.round(((aimAngle * 180) / Math.PI + 360) % 360)}°
            </div>
          </div>

          {/* Press & Hold Fine-Aim Buttons */}
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={!isMyTurn}
              onPointerDown={() => startFineAimHold(-0.008)}
              onPointerUp={stopFineAimHold}
              onPointerLeave={stopFineAimHold}
              onPointerCancel={stopFineAimHold}
              aria-label="Fine aim counter-clockwise"
              className="touch-game-surface flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-[#d4af37]/35 bg-gradient-to-b from-[#211712] to-[#140e0b] text-base font-bold text-[#f3d06b] shadow-md disabled:opacity-30 active:bg-[#2f211a]"
            >
              −
            </button>
            <button
              type="button"
              disabled={!isMyTurn}
              onPointerDown={() => startFineAimHold(0.008)}
              onPointerUp={stopFineAimHold}
              onPointerLeave={stopFineAimHold}
              onPointerCancel={stopFineAimHold}
              aria-label="Fine aim clockwise"
              className="touch-game-surface flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-[#d4af37]/35 bg-gradient-to-b from-[#211712] to-[#140e0b] text-base font-bold text-[#f3d06b] shadow-md disabled:opacity-30 active:bg-[#2f211a]"
            >
              +
            </button>
          </div>

          <div className="flex flex-col items-center gap-1 text-center leading-tight">
            <div className="text-[9px] text-[#a59b8a] uppercase">Pocket</div>
            {/* Compact 6-pocket miniature table call-shot grid */}
            <div
              className="grid grid-cols-3 gap-1 rounded-md border border-[#d4af37]/30 bg-[#083825] p-1 shadow-inner"
              role="group"
              aria-label="Call pocket selector"
            >
              {[0, 1, 2, 3, 4, 5].map((pid) => {
                const isCalled = calledPocket === pid;
                const canClick = isMyTurn && !match.isBreakShot;
                return (
                  <button
                    key={pid}
                    type="button"
                    disabled={!canClick}
                    onClick={() => handleCallPocket(isCalled ? null : pid)}
                    title={POCKETS[pid]?.name ?? `Pocket ${pid + 1}`}
                    aria-label={`Call ${POCKETS[pid]?.name ?? `Pocket ${pid + 1}`}`}
                    className={`h-2.5 w-2.5 rounded-full transition-transform ${
                      isCalled
                        ? 'scale-125 bg-[#f7da84] ring-1 ring-white shadow-[0_0_6px_rgba(247,218,132,0.9)]'
                        : mustCallPocket
                        ? 'bg-[#d4af37]/65 hover:bg-[#f3d06b]'
                        : 'bg-black/75 border border-[#d4af37]/40 hover:border-[#f3d06b]'
                    } disabled:cursor-default`}
                  />
                );
              })}
            </div>
            <div className="max-w-[56px] truncate text-[9px] font-bold text-[#f3d06b]">
              {calledPocket !== null ? POCKETS[calledPocket]?.name : mustCallPocket ? 'Tap!' : 'Auto'}
            </div>
          </div>
        </aside>

        {/* Center Top-Down 2D Pool Table */}
        <section className="flex h-full min-w-0 flex-1 items-center justify-center">
          <PoolCanvas
            match={match}
            balls={renderBalls}
            mySeat={mySeat}
            aimAngle={aimAngle}
            power={power}
            calledPocket={calledPocket}
            strikeAnim={strikeAnim}
            pocketAnims={pocketAnims}
            isSimulating={isSimulating}
            onAimChange={handleAimChange}
            onCueBallMove={handleCueBallMove}
            onCallPocket={handleCallPocket}
          />
        </section>

        {/* Right Pull-Back Cue Power Control */}
        <aside className="flex h-full w-14 shrink-0 items-center justify-center">
          <PowerBar
            disabled={!isMyTurn || shotPending || (mustCallPocket && calledPocket === null)}
            power={power}
            mustCallPocketFirst={mustCallPocket && calledPocket === null}
            onPowerChange={handlePowerChange}
            onShoot={handleShoot}
          />
        </aside>
      </main>

      {/* Match Result & Rematch Casino Plaque */}
      {match.phase === 'GAME_OVER' && match.result && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="mahogany-panel relative w-full max-w-md rounded-2xl border border-[#d4af37]/60 p-5 sm:p-6 text-center">
            <BrassCorners size={18} />
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#f3d06b]/60 bg-gradient-to-b from-[#11734d] to-[#08422b] text-[#f7da84] shadow-lg">
              <Trophy className="h-6 w-6" />
            </div>

            <div className="mt-2.5 text-[11px] font-bold tracking-[0.22em] text-[#d4af37] uppercase">
              Match #{match.matchNumber} Final Result
            </div>

            <h2 className="font-casino gold-title-gradient mt-1 text-2xl sm:text-3xl font-extrabold tracking-wide">
              {match.result.winner === mySeat ? 'WINNER' : 'LOSER'}
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-2.5 rounded-xl border border-[#d4af37]/25 bg-[#0e0a08] p-3 text-xs">
              <div>
                <div className="text-[10px] text-[#a49a89] uppercase">Winner</div>
                <div className="mt-0.5 font-bold text-emerald-400">
                  {match.result.winner === 'host' ? hostPlayer.name : guestPlayer?.name}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#a49a89] uppercase">Loser</div>
                <div className="mt-0.5 font-bold text-[#e5ddcd]">
                  {match.result.loser === 'host' ? hostPlayer.name : guestPlayer?.name}
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs sm:text-sm leading-relaxed text-[#dfd7c8]">
              {match.result.reason}
            </p>

            {/* Rematch readiness status */}
            <div className="mt-2.5 flex min-h-[20px] items-center justify-center gap-2 text-xs text-[#f3d06b]">
              {!isBotMatch && myReady && !oppReady && (
                <span>Waiting for opponent to accept rematch...</span>
              )}
              {!isBotMatch && !myReady && oppReady && (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Opponent wants to play again!
                </span>
              )}
              {isBotMatch && (
                <span className="text-[#c6bcac]">
                  Alternating break — ready for the next rack.
                </span>
              )}
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={waitingForGuest || isBotMatch ? false : myReady || !opponentConnected}
                onClick={() => {
                  soundEngine.playMenuClick();
                  onRequestRematch();
                }}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#f3d06b]/65 bg-gradient-to-b from-[#11734d] to-[#08422b] px-4 py-2.5 font-casino text-xs sm:text-sm font-bold tracking-wider text-[#f7da84] shadow-md hover:from-[#148458] hover:to-[#0b5639] disabled:opacity-50 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                <span>
                  {waitingForGuest
                    ? 'NEW RACK'
                    : isBotMatch
                    ? 'PLAY AGAIN'
                    : myReady
                    ? 'READY'
                    : 'PLAY AGAIN'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playMenuClick();
                  onLeaveRoom();
                }}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#d4af37]/35 bg-[#231914] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#f5efe2] hover:bg-[#31231c] whitespace-nowrap"
              >
                <Home className="h-4 w-4 text-[#d4af37]" />
                <span>RETURN TO MENU</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
