import Phaser from 'phaser';
import { COLORS, MUTE, PAUSE_UI, UI_DEPTH } from '../constants';
import { muteSlot } from '../audio/drawMuteButton';
import { type Lang, directionOf, t } from '../i18n/strings';

export interface PauseUi {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

/** Where the button sits: the slot next to the mute button, towards the centre (left of it in LTR, right in RTL). */
export function pauseSlot(lang: Lang): { x: number; y: number } {
  const mute = muteSlot(lang, 'flight');
  const dir = directionOf(lang) === 'rtl' ? 1 : -1;
  return { x: mute.x + dir * (MUTE.size + PAUSE_UI.gap), y: mute.y };
}

export interface PauseButton {
  setLang(lang: Lang): void;
  destroy(): void;
}

/** A square button with two bars (drawn with Graphics) on a button-sized hit area; a click or tap calls `onPress`. */
export function createPauseButton(scene: Phaser.Scene, lang: Lang, onPress: () => void): PauseButton {
  let current = lang;
  const g = scene.add.graphics().setDepth(UI_DEPTH);
  const zone = scene.add.zone(0, 0, MUTE.size, MUTE.size).setDepth(UI_DEPTH + 1).setInteractive({ useHandCursor: true });

  const draw = () => {
    const { x, y } = pauseSlot(current);
    const s = MUTE.size;
    const l = x - s / 2;
    const top = y - s / 2;
    g.clear();
    g.fillStyle(COLORS.shadow, 0.55).fillRoundedRect(l, top + 4, s, s, 14);
    g.fillStyle(COLORS.button, 1).fillRoundedRect(l, top, s, s, 14);
    g.lineStyle(3, COLORS.buttonEdge, 1).strokeRoundedRect(l, top, s, s, 14);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - 12, y - 14, 8, 28, 2);
    g.fillRoundedRect(x + 4, y - 14, 8, 28, 2);
    zone.setPosition(x, y);
    const ui: PauseUi = { x, y, width: s, height: s, label: t(current, 'pause') };
    scene.registry.set('pauseUi', ui);
  };

  zone.on(Phaser.Input.Events.POINTER_DOWN, onPress);
  draw();

  return {
    setLang(next) {
      current = next;
      draw();
    },
    destroy() {
      zone.destroy();
      g.destroy();
    },
  };
}
