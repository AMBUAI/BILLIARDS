import { useCallback, useEffect, useState } from 'react';
import { type AudioSettings, soundEngine } from './audio/soundEngine.ts';
import { AboutModal } from './components/AboutModal.tsx';
import { BotSetupScreen } from './components/BotSetupScreen.tsx';
import { GameView } from './components/GameView.tsx';
import { HostJoinScreen } from './components/HostJoinScreen.tsx';
import { LandscapeGuard } from './components/LandscapeGuard.tsx';
import { MainMenuScreen } from './components/MainMenuScreen.tsx';
import { RuleBookModal } from './components/RuleBookModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { useBotMatch } from './hooks/useBotMatch.ts';
import { loadSavedPlayerName, useMultiplayer } from './hooks/useMultiplayer.ts';
import type { AimPreviewState, ShotStartPayload, Vector2D } from './shared/types.ts';

type MenuView = 'MENU' | 'HOST_JOIN' | 'BOT_SETUP';

const NOOP_AIM = () => {};
const NOOP_POCKET = () => {};

export default function App() {
  const [menuView, setMenuView] = useState<MenuView>('MENU');
  const [showSettings, setShowSettings] = useState(false);
  const [showRuleBook, setShowRuleBook] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    soundEngine.getSettings()
  );

  const [remoteAim, setRemoteAim] = useState<AimPreviewState | null>(null);
  const [remoteBallPos, setRemoteBallPos] = useState<Vector2D | null>(null);
  const [remotePocketCall, setRemotePocketCall] = useState<number | null>(null);
  const [activeShot, setActiveShot] = useState<ShotStartPayload | null>(null);
  const [opponentLeftNotice, setOpponentLeftNotice] = useState<string | null>(null);

  const botMatch = useBotMatch();

  const mp = useMultiplayer({
    onShotStart: (payload) => {
      setActiveShot(payload);
    },
    onShotSettled: () => {
      setActiveShot(null);
      setRemoteAim(null);
      setRemoteBallPos(null);
      setRemotePocketCall(null);
    },
    onRemoteAim: (_seat, preview) => {
      setRemoteAim(preview);
    },
    onRemoteBallInHand: (_seat, x, y) => {
      setRemoteBallPos({ x, y });
    },
    onRemotePocketCall: (_seat, pocketId) => {
      setRemotePocketCall(pocketId);
    },
    onOpponentLeft: (message) => {
      setActiveShot(null);
      setShowSettings(false);
      setOpponentLeftNotice(message);
      setMenuView('HOST_JOIN');
    },
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Toggle website fullscreen cleanly and request landscape lock when entering fullscreen
  const toggleFullscreen = useCallback(() => {
    const docEl = document.documentElement;
    const orient = window.screen?.orientation as unknown as {
      lock?: (mode: string) => Promise<void>;
    };
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    if (docEl.requestFullscreen) {
      docEl
        .requestFullscreen()
        .then(() => {
          orient?.lock?.('landscape').catch(() => {});
        })
        .catch(() => {});
    } else {
      orient?.lock?.('landscape').catch(() => {});
    }
  }, []);

  // Attempt passive landscape orientation lock on mount where supported
  useEffect(() => {
    const orient = window.screen?.orientation as unknown as {
      lock?: (mode: string) => Promise<void>;
    };
    orient?.lock?.('landscape').catch(() => {});
  }, []);

  // If session restored into a room, jump straight out of MENU
  useEffect(() => {
    if (mp.room && menuView === 'MENU' && !botMatch.active) {
      setMenuView('HOST_JOIN');
    }
  }, [botMatch.active, mp.room, menuView]);

  // Clear local shot playback if server resets or settles the match state
  useEffect(() => {
    if (mp.room?.match && mp.room.match.phase !== 'SIMULATING') {
      setActiveShot(null);
    }
  }, [mp.room?.match]);

  const handleUpdateAudio = useCallback((partial: Partial<AudioSettings>) => {
    const updated = soundEngine.updateSettings(partial);
    setAudioSettings(updated);
  }, []);

  const handleReturnToMenu = useCallback(() => {
    setShowSettings(false);
    setShowRuleBook(false);
    setShowAbout(false);
    setOpponentLeftNotice(null);
    if (botMatch.active) {
      botMatch.exitBotMatch();
    }
    if (mp.room) {
      mp.leaveRoom();
    }
    setMenuView('MENU');
  }, [botMatch, mp]);

  const inBotMatch = Boolean(botMatch.active && botMatch.room && botMatch.room.match);
  const inMultiplayerMatch = Boolean(!inBotMatch && mp.room && mp.room.match && mp.mySeat);
  const inActiveMatch = inBotMatch || inMultiplayerMatch;

  return (
    <LandscapeGuard>
      {/* Opponent Left Toast */}
      {opponentLeftNotice && (
        <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-500/45 bg-[#1b130f]/95 px-4 py-2 text-xs font-medium text-amber-200 shadow-2xl">
          <span>{opponentLeftNotice}</span>
          <button
            type="button"
            onClick={() => setOpponentLeftNotice(null)}
            className="rounded px-2 py-0.5 text-[11px] font-bold text-[#f3d06b] hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary View Routing */}
      {inBotMatch && botMatch.room && botMatch.room.match ? (
        <GameView
          room={botMatch.room}
          mySeat="host"
          match={botMatch.room.match}
          remoteAim={botMatch.botAim}
          remoteBallPos={botMatch.botBallPos}
          remotePocketCall={botMatch.botPocketCall}
          activeShot={botMatch.activeShot}
          isBotMatch
          botDifficulty={botMatch.difficulty}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onSendAim={NOOP_AIM}
          onSendBallInHand={botMatch.updateHumanBallInHand}
          onCallPocket={NOOP_POCKET}
          onExecuteShot={botMatch.executeHumanShot}
          onRequestRematch={botMatch.requestBotRematch}
          onLeaveRoom={handleReturnToMenu}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : inMultiplayerMatch && mp.room && mp.room.match && mp.mySeat ? (
        <GameView
          room={mp.room}
          mySeat={mp.mySeat}
          match={mp.room.match}
          remoteAim={remoteAim}
          remoteBallPos={remoteBallPos}
          remotePocketCall={remotePocketCall}
          activeShot={activeShot}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onSendAim={mp.sendAimUpdate}
          onSendBallInHand={mp.sendBallInHandUpdate}
          onCallPocket={mp.sendCallPocket}
          onExecuteShot={mp.executeShot}
          onRequestRematch={mp.requestRematch}
          onLeaveRoom={handleReturnToMenu}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : menuView === 'BOT_SETUP' ? (
        <BotSetupScreen
          initialName={loadSavedPlayerName()}
          onStartBotMatch={(playerName, difficulty) => {
            setOpponentLeftNotice(null);
            botMatch.startBotMatch(playerName, difficulty);
          }}
          onBackToMenu={() => setMenuView('MENU')}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : menuView === 'HOST_JOIN' || mp.room ? (
        <HostJoinScreen
          initialName={loadSavedPlayerName()}
          connectionStatus={mp.connectionStatus}
          room={mp.room}
          mySeat={mp.mySeat}
          errorMessage={mp.errorMessage}
          isBusy={mp.isBusy}
          onCreateRoom={mp.createRoom}
          onJoinRoom={mp.joinRoom}
          onStartMatch={mp.startMatch}
          onLeaveRoom={mp.leaveRoom}
          onBackToMenu={() => {
            setOpponentLeftNotice(null);
            setMenuView('MENU');
          }}
          onOpenSettings={() => setShowSettings(true)}
          onClearError={mp.clearError}
        />
      ) : (
        <MainMenuScreen
          connectionStatus={mp.connectionStatus}
          isFullscreen={isFullscreen}
          onPlayOnline={() => {
            setOpponentLeftNotice(null);
            setMenuView('HOST_JOIN');
          }}
          onPlayBot={() => {
            setOpponentLeftNotice(null);
            setMenuView('BOT_SETUP');
          }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenRuleBook={() => setShowRuleBook(true)}
          onOpenAbout={() => setShowAbout(true)}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          settings={audioSettings}
          inMatch={inActiveMatch}
          onUpdateSettings={handleUpdateAudio}
          onOpenRuleBook={() => {
            setShowSettings(false);
            setShowRuleBook(true);
          }}
          onReturnToMenu={handleReturnToMenu}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showRuleBook && (
        <RuleBookModal onClose={() => setShowRuleBook(false)} />
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </LandscapeGuard>
  );
}
