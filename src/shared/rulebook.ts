export interface RuleBookSection {
  id: number;
  title: string;
  body: string[];
}

export const RULE_BOOK_SECTIONS: RuleBookSection[] = [
  {
    id: 1,
    title: '1. Objective of the Game',
    body: [
      'Grand Regency 8-Ball follows standard WPA-style 8-Ball pool rules played with one cue ball and 15 numbered object balls.',
      'One player shoots Solids (balls 1 through 7) and the other shoots Stripes (balls 9 through 15). Once you legally pocket all seven balls in your assigned group, you must call a pocket and legally sink the black 8-ball to win the match.',
    ],
  },
  {
    id: 2,
    title: '2. Table and Ball Setup',
    body: [
      'The 15 object balls are racked in a tight triangle at the foot end of the table with the apex ball on the foot spot. The 8-ball sits in the exact center of the rack, and the two back corners contain one solid and one stripe.',
      'Before the opening break shot, the cue ball is placed behind the head string (the shaded break zone on the left quarter of the table).',
    ],
  },
  {
    id: 3,
    title: '3. Break Shot',
    body: [
      'The breaking player may move the cue ball anywhere behind the head string before taking the opening shot.',
      'For a break to be legal, the breaker must either pocket at least one object ball or drive at least four object balls to one or more cushions.',
      'If the break is illegal or the breaker scratches, the opponent receives ball-in-hand behind the head string.',
      'Pocketing balls on a legal break never assigns Solids or Stripes — the table always remains open. If the 8-ball drops on the break, it is spotted back on the foot spot rather than ending the match.',
    ],
  },
  {
    id: 4,
    title: '4. Open Table',
    body: [
      'Immediately after the break, the table is Open, meaning neither player owns Solids or Stripes yet.',
      'While the table is open, you may strike any solid or stripe first (except the 8-ball) to attempt to sink a ball.',
      'Hitting the 8-ball first while the table is open is a foul.',
    ],
  },
  {
    id: 5,
    title: '5. Solids and Stripes',
    body: [
      'Groups are assigned after the break the moment a player legally pockets a solid (1–7) or a stripe (9–15) without committing a foul.',
      'If you tap a pocket to call your shot, the ball must drop into that called pocket to claim the group. Once claimed, your opponent automatically takes the remaining group for the rest of the match.',
    ],
  },
  {
    id: 6,
    title: '6. Turn System',
    body: [
      'Players alternate turns. You continue shooting as long as you legally pocket a ball from your assigned group (or any solid/stripe on an open table) into a valid pocket without committing a foul.',
      'If you fail to pocket a legal ball, miss your called pocket, or commit a foul, your turn ends and control passes to your opponent.',
    ],
  },
  {
    id: 7,
    title: '7. Legal Shots',
    body: [
      'On every shot after the break, the cue ball must strike one of your own group balls first (or any solid/stripe on an open table, or the 8-ball once your group is cleared).',
      'After that initial contact, at least one ball must either drop into a pocket or touch a cushion rail.',
    ],
  },
  {
    id: 8,
    title: '8. Fouls',
    body: [
      'A standard foul occurs if you commit any of the following:',
      '• Scratch: The cue ball drops into a pocket.',
      '• Table exit: The cue ball leaves the playing surface.',
      '• No hit: The cue ball fails to contact any object ball.',
      '• Wrong ball first: The cue ball contacts an opponent’s ball or an illegal 8-ball first.',
      '• No rail or pocket: No ball is pocketed and no ball touches a cushion after first contact.',
      '• Illegal break: Fewer than 4 object balls reach a cushion and no ball is pocketed on the break.',
    ],
  },
  {
    id: 9,
    title: '9. Ball-in-Hand',
    body: [
      'After any standard foul during normal play, the incoming player receives Ball-in-Hand anywhere on the table. Drag the glowing cue ball to any open position on the felt that does not overlap another ball.',
      'After a scratch or illegal break on the opening break shot, Ball-in-Hand is restricted to the area behind the head string.',
    ],
  },
  {
    id: 10,
    title: '10. 8-Ball Rules',
    body: [
      'You may legally shoot the 8-ball only after every ball in your assigned group has been pocketed.',
      'You MUST call a specific pocket by tapping one of the six pockets on the table before shooting the 8-ball. Shots without a called pocket or sinking the 8-ball in an uncalled pocket result in an immediate loss.',
    ],
  },
  {
    id: 11,
    title: '11. Winning and Losing',
    body: [
      'You WIN immediately when all seven of your group balls are cleared and you legally pocket the 8-ball into your called pocket with no foul.',
      'You LOSE immediately if you:',
      '• Pocket the 8-ball prematurely before clearing your group.',
      '• Pocket the 8-ball into a different pocket than the one you called (or fail to call a pocket).',
      '• Scratch or commit any foul on the same shot that sinks the 8-ball.',
    ],
  },
  {
    id: 12,
    title: '12. Special Situations',
    body: [
      'Sinking your opponent’s ball without a foul is not a foul by itself, though your turn ends unless you also legally pocketed one of your own group balls in the same shot.',
      'Accidental wins are never awarded: sinking the 8-ball on the break spots the 8-ball back on the foot spot, and sinking the 8-ball illegally always awards victory to your opponent.',
      'All match states, fouls, and wins are validated by the game server so both players receive the exact same verified result.',
    ],
  },
];
