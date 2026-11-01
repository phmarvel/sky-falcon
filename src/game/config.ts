import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './constants';
import { getLangStore } from './i18n/langStore';
import { applyPageLang } from './i18n/pageLang';
import { fitOnResize } from './fitOnResize';
import { FlightScene } from './scenes/FlightScene';
import { StartScene } from './scenes/StartScene';
import { pickFirstScene } from './scenes/sceneParam';

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
    // Our sounds are made by src/game/audio; Phaser's own audio manager is not needed and fails where audio is blocked.
    audio: { noAudio: true },
    scale: {
      // FIT keeps the 9:16 proportions and shows the whole canvas; Phaser re-fits it when the window changes size.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: { antialias: true },
    // Phaser starts the first scene in the list: the start screen, or the run with ?scene=flight.
    scene: pickFirstScene(typeof location === 'undefined' ? '' : location.search) === 'Flight'
      ? [FlightScene, StartScene]
      : [StartScene, FlightScene],
  };
}

export function createGame(parent: string | HTMLElement): Phaser.Game {
  applyPageLang(getLangStore().get());
  const game = new Phaser.Game(createGameConfig(parent));
  fitOnResize(game);
  // A hook for the browser tests; harmless to players.
  window.__SKY_FALCON__ = game;
  return game;
}
