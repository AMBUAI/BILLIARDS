import {
  cloneBalls,
  findSafeCueBallSpot,
  spotEightBall,
} from './physics.ts';
import type {
  BallGroup,
  BallState,
  MatchState,
  PlayerSeat,
  ShotEvents,
} from './types.ts';

export function getBallGroup(ballId: number): BallGroup | null {
  if (ballId >= 1 && ballId <= 7) return 'SOLIDS';
  if (ballId >= 9 && ballId <= 15) return 'STRIPES';
  return null;
}

export function getRemainingGroupBalls(
  balls: BallState[],
  group: BallGroup
): number[] {
  return balls
    .filter((b) => !b.pocketed && getBallGroup(b.id) === group)
    .map((b) => b.id);
}

export function getOpponent(seat: PlayerSeat): PlayerSeat {
  return seat === 'host' ? 'guest' : 'host';
}

export function isPlayerOnEightBall(
  match: MatchState,
  seat: PlayerSeat
): boolean {
  const group = match.groups[seat];
  if (!group) return false;
  return getRemainingGroupBalls(match.balls, group).length === 0;
}

export function evaluateShotRules(
  prevState: MatchState,
  postBalls: BallState[],
  events: ShotEvents,
  calledPocket: number | null,
  playerNames: Record<PlayerSeat, string>
): MatchState {
  const shooter = prevState.currentTurn;
  const opponent = getOpponent(shooter);
  const shooterName = playerNames[shooter];
  const opponentName = playerNames[opponent];

  let nextBalls = cloneBalls(postBalls);
  let nextTurn: PlayerSeat = opponent;
  let nextIsTableOpen = prevState.isTableOpen;
  const nextGroups = { ...prevState.groups };
  let nextBallInHand: MatchState['ballInHand'] = 'NONE';
  let nextLastFoul: MatchState['lastFoul'] = null;
  let nextMessage = '';
  let nextResult: MatchState['result'] = null;

  const eightBallPocketEvent = events.pocketed.find((p) => p.ballId === 8);
  const objectBallsPocketed = events.pocketed.filter((p) => p.ballId !== 8);

  // ------------------------------------------------------------------
  // CASE 1: BREAK SHOT (WPA 8-Ball Rules)
  // ------------------------------------------------------------------
  if (prevState.isBreakShot) {
    const breakScratch = events.cueScratched || events.cueLeftTable;
    const hitCount = events.breakCushionBallIds.length;
    const legalBreak =
      events.pocketed.length > 0 || hitCount >= 4;

    // 8-ball pocketed on break never gives an accidental win; spot it!
    if (eightBallPocketEvent) {
      nextBalls = spotEightBall(nextBalls);
    }

    if (breakScratch) {
      nextTurn = opponent;
      nextBallInHand = 'BEHIND_HEAD_STRING';
      nextLastFoul = {
        reason: events.cueLeftTable
          ? 'Cue ball left the table on the break.'
          : 'Scratch on the break shot.',
        committedBy: shooter,
        ballInHandAwarded: 'BEHIND_HEAD_STRING',
      };
      nextMessage = `${shooterName} scratched on the break. ${opponentName} has ball-in-hand behind the head string.`;
    } else if (!legalBreak) {
      nextTurn = opponent;
      nextBallInHand = 'BEHIND_HEAD_STRING';
      nextLastFoul = {
        reason:
          'Illegal break: fewer than 4 object balls reached a cushion and no ball was pocketed.',
        committedBy: shooter,
        ballInHandAwarded: 'BEHIND_HEAD_STRING',
      };
      nextMessage = `Illegal break by ${shooterName}. ${opponentName} gets ball-in-hand behind the head string.`;
    } else if (objectBallsPocketed.length > 0) {
      // Legal break with at least one object ball pocketed -> shooter continues, table stays OPEN
      nextTurn = shooter;
      nextMessage = eightBallPocketEvent
        ? `8-ball spotted on legal break. Table remains open — ${shooterName} continues.`
        : `Solid break! Table remains open — ${shooterName} shoots again.`;
    } else {
      // Legal dry break
      nextTurn = opponent;
      nextMessage = eightBallPocketEvent
        ? `8-ball spotted on break. Table is open — ${opponentName}'s turn.`
        : `Clean break. Table is open — ${opponentName}'s turn.`;
    }

    // Reposition scratched cue ball safely behind head string for placement
    if (breakScratch || !legalBreak) {
      const cue = nextBalls.find((b) => b.id === 0);
      if (cue) {
        const spot = findSafeCueBallSpot(nextBalls, true);
        cue.x = spot.x;
        cue.y = spot.y;
        cue.pocketed = false;
        cue.pocketId = null;
      }
    }

    return {
      ...prevState,
      phase: 'AIMING',
      balls: nextBalls,
      currentTurn: nextTurn,
      isBreakShot: false,
      isTableOpen: true, // WPA: break NEVER assigns groups
      groups: nextGroups,
      ballInHand: nextBallInHand,
      calledPocket: null,
      lastFoul: nextLastFoul,
      lastEventMessage: nextMessage,
      result: null,
      shotCount: prevState.shotCount + 1,
      activeShotId: null,
    };
  }

  // ------------------------------------------------------------------
  // CASE 2: STANDARD PLAY (Post-Break)
  // ------------------------------------------------------------------
  const shooterGroup = prevState.groups[shooter];
  const shooterOnEight = isPlayerOnEightBall(prevState, shooter);

  // Detect standard fouls
  let foulReason: string | null = null;

  if (events.cueLeftTable) {
    foulReason = 'Cue ball left the playing surface.';
  } else if (events.cueScratched) {
    foulReason = 'Scratch: cue ball was pocketed.';
  } else if (events.firstContactBallId === null) {
    foulReason = 'Foul: cue ball failed to contact any object ball.';
  } else {
    const firstBall = events.firstContactBallId;
    const firstGroup = getBallGroup(firstBall);

    if (prevState.isTableOpen) {
      if (firstBall === 8) {
        foulReason = 'Foul: cannot hit the 8-ball first while the table is open.';
      }
    } else if (shooterOnEight) {
      if (firstBall !== 8) {
        foulReason = 'Foul: must strike the 8-ball first after clearing your group.';
      }
    } else if (shooterGroup && firstGroup !== shooterGroup) {
      foulReason =
        firstBall === 8
          ? 'Foul: cannot hit the 8-ball first before clearing your group.'
          : `Foul: hit opponent's ${firstGroup?.toLowerCase()} ball first.`;
    }

    // Cushion or pocket rule after legal first contact
    if (!foulReason && events.pocketed.length === 0 && !events.cushionAfterContact) {
      foulReason = 'Foul: no ball was pocketed and no ball contacted a cushion after impact.';
    }
  }

  // Check 8-ball pocketed outcome FIRST (win or immediate loss-of-game!)
  if (eightBallPocketEvent) {
    if (!shooterOnEight) {
      // Premature 8-ball pocket -> shooter loses!
      nextResult = {
        winner: opponent,
        loser: shooter,
        reason: `${shooterName} pocketed the 8-ball prematurely before clearing their group.`,
        isPrematureEightBall: true,
      };
    } else if (foulReason) {
      // Foul on the 8-ball shot (e.g., scratch) -> shooter loses!
      nextResult = {
        winner: opponent,
        loser: shooter,
        reason: `${shooterName} committed a foul (${foulReason.replace(/^Foul:\s*/i, '')}) while pocketing the 8-ball.`,
        isPrematureEightBall: false,
      };
    } else if (calledPocket === null || eightBallPocketEvent.pocketId !== calledPocket) {
      // Wrong pocket on the 8-ball -> shooter loses!
      nextResult = {
        winner: opponent,
        loser: shooter,
        reason: `${shooterName} pocketed the 8-ball in an uncalled pocket.`,
        isPrematureEightBall: false,
      };
    } else {
      // Clean legal 8-ball pocket in called pocket -> shooter WINS!
      nextResult = {
        winner: shooter,
        loser: opponent,
        reason: `${shooterName} legally pocketed the 8-ball in the called pocket!`,
        isPrematureEightBall: false,
      };
    }

    return {
      ...prevState,
      phase: 'GAME_OVER',
      balls: nextBalls,
      currentTurn: shooter,
      isBreakShot: false,
      isTableOpen: nextIsTableOpen,
      groups: nextGroups,
      ballInHand: 'NONE',
      calledPocket: null,
      lastFoul: foulReason
        ? {
            reason: foulReason,
            committedBy: shooter,
            ballInHandAwarded: 'NONE',
          }
        : null,
      lastEventMessage: nextResult.reason,
      result: nextResult,
      shotCount: prevState.shotCount + 1,
      activeShotId: null,
    };
  }

  // If a standard foul occurred (without pocketing 8-ball)
  if (foulReason) {
    nextTurn = opponent;
    nextBallInHand = 'ANYWHERE';
    nextLastFoul = {
      reason: foulReason,
      committedBy: shooter,
      ballInHandAwarded: 'ANYWHERE',
    };
    nextMessage = `${foulReason} ${opponentName} has ball-in-hand.`;

    // Restore cue ball if scratched so opponent can drag & place it
    const cue = nextBalls.find((b) => b.id === 0);
    if (cue && (cue.pocketed || events.cueScratched)) {
      const spot = findSafeCueBallSpot(nextBalls, false);
      cue.x = spot.x;
      cue.y = spot.y;
      cue.pocketed = false;
      cue.pocketId = null;
    }

    return {
      ...prevState,
      phase: 'AIMING',
      balls: nextBalls,
      currentTurn: nextTurn,
      isBreakShot: false,
      isTableOpen: nextIsTableOpen,
      groups: nextGroups,
      ballInHand: nextBallInHand,
      calledPocket: null,
      lastFoul: nextLastFoul,
      lastEventMessage: nextMessage,
      result: null,
      shotCount: prevState.shotCount + 1,
      activeShotId: null,
    };
  }

  // Legal shot with NO foul: evaluate group assignment & turn continuation
  if (prevState.isTableOpen) {
    // On an open table, a legally pocketed ball in the called pocket (or any pocket if none explicitly called) assigns groups.
    const legalOpenPocketed = objectBallsPocketed.find((p) =>
      calledPocket !== null ? p.pocketId === calledPocket : true
    );

    if (legalOpenPocketed) {
      const claimedGroup = getBallGroup(legalOpenPocketed.ballId);
      if (claimedGroup) {
        nextGroups[shooter] = claimedGroup;
        nextGroups[opponent] = claimedGroup === 'SOLIDS' ? 'STRIPES' : 'SOLIDS';
        nextIsTableOpen = false;
        nextTurn = shooter;
        nextMessage = `${shooterName} claims ${claimedGroup}! Continues shooting.`;
      } else {
        nextTurn = opponent;
        nextMessage = `Table remains open — ${opponentName}'s turn.`;
      }
    } else if (objectBallsPocketed.length > 0) {
      // Pocketed a ball, but NOT in the explicitly called pocket -> no group claimed, turn passes
      nextTurn = opponent;
      nextMessage = `Ball missed the called pocket. Table remains open — ${opponentName}'s turn.`;
    } else {
      nextTurn = opponent;
      nextMessage = `Clean shot. Table remains open — ${opponentName}'s turn.`;
    }
  } else {
    // Groups already assigned
    const legalOwnPocketed = objectBallsPocketed.some((p) => {
      const grp = getBallGroup(p.ballId);
      if (grp !== shooterGroup) return false;
      return calledPocket !== null ? p.pocketId === calledPocket : true;
    });

    if (legalOwnPocketed) {
      nextTurn = shooter;
      const remaining = shooterGroup
        ? getRemainingGroupBalls(nextBalls, shooterGroup).length
        : 0;
      nextMessage =
        remaining === 0
          ? `${shooterName} cleared ${shooterGroup}! Call a pocket for the 8-ball.`
          : `${shooterName} pocketed a ${shooterGroup === 'SOLIDS' ? 'solid' : 'stripe'} and continues.`;
    } else if (objectBallsPocketed.length > 0) {
      nextTurn = opponent;
      nextMessage =
        calledPocket !== null
          ? `Shot missed the called pocket — ${opponentName}'s turn.`
          : `Opponent's ball pocketed — ${opponentName}'s turn.`;
    } else {
      nextTurn = opponent;
      nextMessage = `${opponentName}'s turn.`;
    }
  }

  return {
    ...prevState,
    phase: 'AIMING',
    balls: nextBalls,
    currentTurn: nextTurn,
    isBreakShot: false,
    isTableOpen: nextIsTableOpen,
    groups: nextGroups,
    ballInHand: 'NONE',
    calledPocket: null,
    lastFoul: null,
    lastEventMessage: nextMessage,
    result: null,
    shotCount: prevState.shotCount + 1,
    activeShotId: null,
  };
}
