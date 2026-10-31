import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './constants';
import { fitOnResize } from './fitOnResize';
import { DesertScene } from './scenes/DesertScene';

export { COLORS, GAME_HEIGHT, GAME_WIDTH };

declare global {
  interface Window {
    __SKY_FALCON__?: Phaser.Game;
  }
}

export function createGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: COLORS.skyMiddle,
    scale: {
      // FIT keeps the 9:16 proportions and shows the whole canvas; Phaser re-fits it when the window changes size.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: { antialias: true },
    scene: [DesertScene],
  };
}

export function createGame(parent: string | HTMLElement): Phaser.Game {
  const game = new Phaser.Game(createGameConfig(parent));
  fitOnResize(game);
  // A hook for the browser tests; harmless to players.
  window.__SKY_FALCON__ = game;
  return game;
}
