import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AimPreviewState,
  ClientMessage,
  MatchState,
  PlayerSeat,
  RoomState,
  ServerMessage,
  ShotStartPayload,
  Vector2D,
} from '../shared/types.ts';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface StoredSession {
  roomCode: string;
  reconnectToken: string;
  seat: PlayerSeat;
}

const SESSION_KEY = 'gr8b_room_session';
const NAME_KEY = 'gr8b_player_name';

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.roomCode && parsed.reconnectToken && parsed.seat) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSession(session: StoredSession | null): void {
  try {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

export function loadSavedPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

export interface UseMultiplayerOptions {
  onShotStart?: (payload: ShotStartPayload) => void;
  onShotSettled?: (match: MatchState) => void;
  onRemoteAim?: (seat: PlayerSeat, preview: AimPreviewState) => void;
  onRemoteBallInHand?: (seat: PlayerSeat, x: number, y: number) => void;
  onRemotePocketCall?: (seat: PlayerSeat, pocketId: number | null) => void;
  onOpponentLeft?: (message: string) => void;
}

export function useMultiplayer(options: UseMultiplayerOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [mySeat, setMySeat] = useState<PlayerSeat | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const send = useCallback((msg: ClientMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      const existing = loadSession();
      if (existing) {
        ws.send(
          JSON.stringify({
            type: 'room:reconnect',
            roomCode: existing.roomCode,
            reconnectToken: existing.reconnectToken,
          } satisfies ClientMessage)
        );
      }
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('{"type":"ping"}');
        }
      }, 20_000);
    };

    ws.onmessage = (evt) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(evt.data as string) as ServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case 'room:joined': {
          setIsBusy(false);
          setErrorMessage(null);
          setMySeat(msg.seat);
          setRoom(msg.room);
          saveSession({
            roomCode: msg.roomCode,
            reconnectToken: msg.reconnectToken,
            seat: msg.seat,
          });
          break;
        }
        case 'room:state': {
          setIsBusy(false);
          setRoom(msg.room);
          break;
        }
        case 'room:error': {
          setIsBusy(false);
          if (msg.code === 'RECONNECT_FAILED') {
            saveSession(null);
            setRoom(null);
            setMySeat(null);
          } else {
            setErrorMessage(msg.message);
          }
          break;
        }
        case 'room:opponent_left': {
          setIsBusy(false);
          saveSession(null);
          setRoom(null);
          setMySeat(null);
          optionsRef.current.onOpponentLeft?.(msg.message);
          break;
        }
        case 'aim:remote': {
          optionsRef.current.onRemoteAim?.(msg.seat, msg.preview);
          break;
        }
        case 'ballinhand:remote': {
          optionsRef.current.onRemoteBallInHand?.(msg.seat, msg.x, msg.y);
          break;
        }
        case 'pocket:remote': {
          optionsRef.current.onRemotePocketCall?.(msg.seat, msg.pocketId);
          break;
        }
        case 'shot:start': {
          optionsRef.current.onShotStart?.(msg.payload);
          break;
        }
        case 'shot:settled': {
          setRoom((prev) => (prev ? { ...prev, match: msg.match } : prev));
          optionsRef.current.onShotSettled?.(msg.match);
          break;
        }
        case 'pong':
          break;
      }
    };

    ws.onclose = () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      wsRef.current = null;
      setConnectionStatus('reconnecting');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 1400);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const createRoom = useCallback(
    (playerName: string) => {
      setErrorMessage(null);
      setIsBusy(true);
      savePlayerName(playerName);
      if (!send({ type: 'room:create', playerName })) {
        setIsBusy(false);
        setErrorMessage('Connecting to server — please wait a moment and try again.');
      }
    },
    [send]
  );

  const joinRoom = useCallback(
    (roomCode: string, playerName: string) => {
      setErrorMessage(null);
      setIsBusy(true);
      savePlayerName(playerName);
      if (!send({ type: 'room:join', roomCode: roomCode.trim().toUpperCase(), playerName })) {
        setIsBusy(false);
        setErrorMessage('Connecting to server — please wait a moment and try again.');
      }
    },
    [send]
  );

  const leaveRoom = useCallback(() => {
    send({ type: 'room:leave' });
    saveSession(null);
    setRoom(null);
    setMySeat(null);
    setErrorMessage(null);
  }, [send]);

  const startMatch = useCallback(() => {
    setErrorMessage(null);
    send({ type: 'match:start' });
  }, [send]);

  const sendAimUpdate = useCallback(
    (preview: AimPreviewState) => {
      send({ type: 'aim:update', preview });
    },
    [send]
  );

  const sendBallInHandUpdate = useCallback(
    (x: number, y: number) => {
      send({ type: 'ballinhand:update', x, y });
    },
    [send]
  );

  const sendCallPocket = useCallback(
    (pocketId: number | null) => {
      send({ type: 'pocket:call', pocketId });
    },
    [send]
  );

  const executeShot = useCallback(
    (angle: number, power: number, calledPocket: number | null, cueBallPos: Vector2D) => {
      send({ type: 'shot:execute', angle, power, calledPocket, cueBallPos });
    },
    [send]
  );

  const requestRematch = useCallback(() => {
    send({ type: 'rematch:request' });
  }, [send]);

  const clearError = useCallback(() => setErrorMessage(null), []);

  return {
    connectionStatus,
    room,
    mySeat,
    errorMessage,
    isBusy,
    createRoom,
    joinRoom,
    leaveRoom,
    startMatch,
    sendAimUpdate,
    sendBallInHandUpdate,
    sendCallPocket,
    executeShot,
    requestRematch,
    clearError,
  };
}
