import React, { useState } from 'react';
import { ArrowLeft, Check, Copy, Crown, LogIn, PlusCircle, Settings, Users } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine.ts';
import type { ConnectionStatus } from '../hooks/useMultiplayer.ts';
import type { PlayerSeat, RoomState } from '../shared/types.ts';
import { BrassCorners } from './BrassCorners.tsx';

interface HostJoinScreenProps {
  initialName: string;
  connectionStatus: ConnectionStatus;
  room: RoomState | null;
  mySeat: PlayerSeat | null;
  errorMessage: string | null;
  isBusy: boolean;
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onBackToMenu: () => void;
  onOpenSettings: () => void;
  onClearError: () => void;
}

export const HostJoinScreen: React.FC<HostJoinScreenProps> = ({
  initialName,
  connectionStatus,
  room,
  mySeat,
  errorMessage,
  isBusy,
  onCreateRoom,
  onJoinRoom,
  onStartMatch,
  onLeaveRoom,
  onBackToMenu,
  onOpenSettings,
  onClearError,
}) => {
  const [playerName, setPlayerName] = useState<string>(initialName || '');
  const [joinCode, setJoinCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!room) return;
    soundEngine.playMenuClick();
    navigator.clipboard?.writeText(room.roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // LOBBY VIEW
  if (room) {
    const bothConnected = Boolean(room.host.connected && room.guest && room.guest.connected);
    const isHost = mySeat === 'host';

    return (
      <div className="casino-parlor-bg flex h-dvh w-screen flex-col justify-between overflow-hidden px-4 py-3 sm:px-8 sm:py-5">
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuClick();
              onLeaveRoom();
            }}
            className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#1a120e] px-3.5 py-2 text-xs font-semibold text-[#f5efe2] hover:border-[#f3d06b]/55 hover:bg-[#251a14] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4 text-[#d4af37]" />
            <span>Leave Room</span>
          </button>

          <h2 className="font-casino gold-title-gradient text-lg sm:text-2xl font-bold tracking-wide">
            Private Billiards Lobby
          </h2>

          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuClick();
              onOpenSettings();
            }}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#d4af37]/30 bg-[#1a120e] text-[#e6decb] hover:border-[#f3d06b]/55 hover:bg-[#251a14] transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4 text-[#d4af37]" />
          </button>
        </div>

        {/* Center Lobby Cards */}
        <div className="mx-auto my-auto grid w-full max-w-4xl grid-cols-12 items-stretch gap-4">
          {/* Room Code Plaque */}
          <div className="mahogany-panel relative col-span-5 flex flex-col items-center justify-center rounded-2xl border border-[#d4af37]/35 p-4 sm:p-6 text-center">
            <BrassCorners size={16} />
            <div className="text-[11px] font-semibold tracking-[0.2em] text-[#d4af37] uppercase">
              Table Room Code
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5">
              {room.roomCode.split('').map((ch, idx) => (
                <span
                  key={idx}
                  className="font-mono-nums flex h-10 w-8 sm:h-12 sm:w-10 items-center justify-center rounded-lg border border-[#d4af37]/45 bg-[#090c0b] text-lg sm:text-2xl font-bold text-[#f7da84] shadow-inner"
                >
                  {ch}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="mt-3.5 flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#d4af37]/35 bg-[#211712] px-4 py-1.5 text-xs font-semibold text-[#f5efe2] hover:border-[#f3d06b]/60 hover:bg-[#2c1f18] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-[#d4af37]" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-[#9e9484]">
              Share this 6-character code with your opponent. The table locks once play begins.
            </p>
          </div>

          {/* Players & Start Panel */}
          <div className="mahogany-panel relative col-span-7 flex flex-col justify-between rounded-2xl border border-[#d4af37]/30 p-4 sm:p-6">
            <BrassCorners size={16} />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-[#d4af37] uppercase">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Players Seated</span>
                </span>
                <span className="font-mono-nums text-[#e8decb]">
                  {room.guest ? '2 / 2' : '1 / 2'}
                </span>
              </div>

              {/* Host Seat */}
              <div className="flex items-center justify-between rounded-xl border border-[#d4af37]/30 bg-[#1a130f]/95 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Crown className="h-4 w-4 shrink-0 text-[#f3d06b]" />
                  <span className="truncate text-sm font-bold text-[#faf4e6]">
                    {room.host.name}
                  </span>
                  <span className="text-xs font-semibold text-[#d4af37] whitespace-nowrap">
                    · Host {mySeat === 'host' ? '(You)' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-xs">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      room.host.connected ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                  />
                  <span className={room.host.connected ? 'text-emerald-400' : 'text-amber-300'}>
                    {room.host.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Guest Seat */}
              <div className="flex items-center justify-between rounded-xl border border-[#d4af37]/20 bg-[#1a130f]/95 px-4 py-3">
                {room.guest ? (
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="truncate text-sm font-bold text-[#faf4e6]">
                        {room.guest.name}
                      </span>
                      {mySeat === 'guest' && (
                        <span className="text-xs font-semibold text-[#d4af37] whitespace-nowrap">
                          · (You)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-xs">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          room.guest.connected ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                      />
                      <span
                        className={
                          room.guest.connected ? 'text-emerald-400' : 'text-amber-300'
                        }
                      >
                        {room.guest.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex w-full items-center justify-between text-xs text-[#9c9282]">
                    <span>Waiting for second player to join...</span>
                    <span className="font-mono-nums text-[#d4af37]">Open Seat</span>
                  </div>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="mt-2 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                {errorMessage}
              </div>
            )}

            <div className="mt-4">
              {isHost ? (
                <button
                  type="button"
                  disabled={!bothConnected}
                  onClick={() => {
                    soundEngine.playMenuClick();
                    onStartMatch();
                  }}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[#f3d06b]/65 bg-gradient-to-b from-[#11734d] to-[#08422b] px-5 py-2.5 font-casino text-sm sm:text-base font-bold tracking-wider text-[#f7da84] shadow-lg disabled:cursor-not-allowed disabled:opacity-45 hover:from-[#148458] hover:to-[#0b5639]"
                >
                  {bothConnected ? 'START MATCH' : 'WAITING FOR OPPONENT...'}
                </button>
              ) : (
                <div className="flex min-h-[48px] items-center justify-center rounded-xl border border-[#d4af37]/25 bg-[#120d0a] px-4 text-xs sm:text-sm font-medium text-[#d7cfc0]">
                  {bothConnected
                    ? `Waiting for ${room.host.name} (Host) to start the match...`
                    : 'Connecting...'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-center text-[11px] text-[#8d8476]">
          Server status: {connectionStatus === 'connected' ? 'Online' : 'Reconnecting...'}
        </div>
      </div>
    );
  }

  // HOST / JOIN SELECTION VIEW
  const cleanName = playerName.trim();

  return (
    <div className="casino-parlor-bg flex h-dvh w-screen flex-col justify-between overflow-hidden px-4 py-3 sm:px-8 sm:py-5">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuClick();
            onBackToMenu();
          }}
          className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#1a120e] px-3.5 py-2 text-xs font-semibold text-[#f5efe2] hover:border-[#f3d06b]/55 hover:bg-[#251a14] transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4 text-[#d4af37]" />
          <span>Menu</span>
        </button>

        <h2 className="font-casino gold-title-gradient text-lg sm:text-2xl font-bold tracking-wide">
          Online Multiplayer
        </h2>

        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuClick();
            onOpenSettings();
          }}
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#d4af37]/30 bg-[#1a120e] text-[#e6decb] hover:border-[#f3d06b]/55 hover:bg-[#251a14] transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 text-[#d4af37]" />
        </button>
      </div>

      {/* Main Landscape Form */}
      <div className="mx-auto my-auto w-full max-w-4xl space-y-3.5">
        {/* Player Name Bar */}
        <div className="mahogany-panel flex items-center gap-3 rounded-xl border border-[#d4af37]/30 px-4 py-2.5">
          <label
            htmlFor="player-name-input"
            className="shrink-0 text-xs font-semibold tracking-wider text-[#d4af37] uppercase"
          >
            Player Name
          </label>
          <input
            id="player-name-input"
            type="text"
            maxLength={16}
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              if (errorMessage) onClearError();
            }}
            placeholder="Enter your display name"
            className="min-h-[38px] flex-1 rounded-lg border border-[#d4af37]/25 bg-[#0a0c0b] px-3.5 text-sm font-medium text-[#f5efe2] placeholder-[#786f62] focus:border-[#f3d06b] focus:outline-none"
          />
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-500/45 bg-red-950/60 px-4 py-2 text-xs font-medium text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* HOST CARD */}
          <div className="mahogany-panel relative flex flex-col justify-between rounded-2xl border border-[#d4af37]/35 p-4 sm:p-5">
            <BrassCorners size={16} />
            <div>
              <div className="flex items-center gap-2 text-[#f3d06b]">
                <PlusCircle className="h-5 w-5" />
                <h3 className="font-casino text-base sm:text-lg font-bold">Host Table</h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#c6bcac]">
                Enter the table immediately with a 6-character code and warm up while your opponent joins.
              </p>
            </div>
            <button
              type="button"
              disabled={isBusy || connectionStatus !== 'connected'}
              onClick={() => {
                soundEngine.playMenuClick();
                onCreateRoom(cleanName || 'Player 1');
              }}
              className="mt-4 flex min-h-[46px] w-full items-center justify-center rounded-xl border border-[#f3d06b]/65 bg-gradient-to-b from-[#11734d] to-[#08422b] px-4 py-2.5 font-casino text-sm font-bold tracking-wider text-[#f7da84] shadow-md hover:from-[#148458] hover:to-[#0b5639] disabled:opacity-45 whitespace-nowrap"
            >
              {isBusy ? 'CREATING...' : 'HOST ROOM'}
            </button>
          </div>

          {/* JOIN CARD */}
          <div className="mahogany-panel relative flex flex-col justify-between rounded-2xl border border-[#d4af37]/35 p-4 sm:p-5">
            <BrassCorners size={16} />
            <div>
              <div className="flex items-center gap-2 text-[#f3d06b]">
                <LogIn className="h-5 w-5" />
                <h3 className="font-casino text-base sm:text-lg font-bold">Join Table</h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#c6bcac]">
                Enter the 6-character room code shared by the host to enter the match lobby.
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  if (errorMessage) onClearError();
                }}
                placeholder="ABC123"
                aria-label="6-character room code"
                className="font-mono-nums min-h-[46px] w-28 sm:w-32 rounded-xl border border-[#d4af37]/35 bg-[#0a0c0b] px-3 text-center text-sm sm:text-base font-bold tracking-widest text-[#f7da84] placeholder-[#6b6255] focus:border-[#f3d06b] focus:outline-none"
              />
              <button
                type="button"
                disabled={
                  isBusy ||
                  connectionStatus !== 'connected' ||
                  joinCode.trim().length !== 6
                }
                onClick={() => {
                  soundEngine.playMenuClick();
                  onJoinRoom(joinCode, cleanName || 'Player 2');
                }}
                className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl border border-[#d4af37]/55 bg-gradient-to-b from-[#2c1e16] to-[#1d130e] px-4 py-2.5 font-casino text-sm font-bold tracking-wider text-[#f3d06b] shadow-md hover:from-[#38271d] disabled:opacity-45 whitespace-nowrap"
              >
                {isBusy ? 'JOINING...' : 'JOIN'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 text-center text-[11px] text-[#8d8476]">
        {connectionStatus === 'connected'
          ? 'Connected to multiplayer server'
          : 'Connecting to multiplayer server...'}
      </div>
    </div>
  );
};
