/** The game's own coordinate system: portrait 9:16. Phaser scales it to fit any screen. */
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

export const COLORS = {
  skyTop: 0x3b6ea5,
  skyMiddle: 0x86c5e8,
  skyBottom: 0xf9d9a8,
  sun: 0xffe08a,
  sunGlow: 0xfff4d6,
  duneFar: 0xe8b86d,
  duneNear: 0xd9a04f,
  sand: 0xe3b261,
  sandRipple: 0xc98d3f,
  falconBody: 0x7a4a2a,
  falconWing: 0x55301b,
  falconBelly: 0xf3e2c0,
  falconBeak: 0xf2b632,
  falconEye: 0x1d1410,
  falconOutline: 0x3a2414,
  shadow: 0x8a5a24,
  towerStone: 0xc9824a,
  towerShade: 0xa9653a,
  towerTrim: 0xf0d3a0,
  towerWindow: 0x4a2a18,
  towerOutline: 0x6b3b1f,
  palmTrunk: 0x8b5a2b,
  palmTrunkRing: 0x5e3a1a,
  palmLeaf: 0x3f9a4a,
  palmLeafDark: 0x2a6e35,
  dateBody: 0x8a4b1f,
  dateShade: 0x5a2d12,
  dateShine: 0xd89a62,
  dateOutline: 0x3a1c0a,
  button: 0x2f7d4f,
  buttonEdge: 0x1c4f32,
  overlay: 0x1d1410,
  panel: 0xfff4d6,
  panelEdge: 0x3a2414,
  medalRibbon: 0xc0392b,
  medalRibbonDark: 0x8e2a20,
  medal: {
    bronze: { face: 0xcd7f32, edge: 0x8a4f1a, star: 0xf3c89b },
    silver: { face: 0xc9d1d9, edge: 0x7b8794, star: 0xffffff },
    gold: { face: 0xffc629, edge: 0xb8860b, star: 0xfff3b0 },
  },
} as const;

/** Draw order of the score: above the obstacles (0) and the falcon (10), under the game over screen (100). */
export const SCORE_DEPTH = 50;

/** Text styles for the screens. */
export const UI = {
  fontFamily: 'system-ui, "Segoe UI", Tahoma, Arial, sans-serif',
  title: '#fff4d6',
  titleStroke: '#3a2414',
  bestText: '#fff4d6',
  buttonText: '#ffffff',
  switchText: '#fff4d6',
  panelText: '#3a2414',
  newBest: '#b5470d',
} as const;
