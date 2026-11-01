import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, MUTE, UI_DEPTH } from '../constants';
import { type Lang, directionOf, t } from '../i18n/strings';
import type { SoundPlayer } from './soundPlayer';

export interface MuteUi {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The action the button offers now (the text is in the current language). */
  label: string;
}

/**
 * Where the button sits. Top corner at the start of the reading direction's end: right for LTR, left for RTL, which is
 * opposite the score (top centre) on the flight screen. On the start screen the language switch has that corner, so
 * the button takes the other one. The slot next to it, towards the centre, stays free for a pause button.
 */
export function muteSlot(lang: Lang, screen: 'start' | 'flight'): { x: number; y: number } {
  const rtl = directionOf(lang) === 'rtl';
  const right = screen === 'start' ? rtl : !rtl;
  const half = MUTE.size / 2;
  return { x: right ? GAME_WIDTH - MUTE.margin - half : MUTE.margin + half, y: MUTE.y };
}

export interface MuteButton {
  setLang(lang: Lang): void;
  toggle(): void;
  destroy(): void;
}

/** Puts the sound state in the registry (the browser tests read it). */
export function publishSound(scene: Phaser.Scene, player: SoundPlayer): void {
  const r = scene.registry;
  r.set('muted', player.isMuted());
  r.set('lastSound', player.lastSound());
  r.set('soundCount', player.soundCount());
  r.set('soundCounts', player.counts());
}

/** A speaker icon drawn with Graphics on a button-sized hit area. Click or tap toggles the mute. */
export function createMuteButton(
  scene: Phaser.Scene,
  lang: Lang,
  screen: 'start' | 'flight',
  player: SoundPlayer,
): MuteButton {
  let current = lang;
  const g = scene.add.graphics().setDepth(UI_DEPTH);
  const zone = scene.add.zone(0, 0, MUTE.size, MUTE.size).setDepth(UI_DEPTH + 1).setInteractive({ useHandCursor: true });

  const draw = () => {
    const { x, y } = muteSlot(current, screen);
    const muted = player.isMuted();
    const s = MUTE.size;
    const l = x - s / 2;
    const top = y - s / 2;
    g.clear();
    g.fillStyle(COLORS.shadow, 0.55).fillRoundedRect(l, top + 4, s, s, 14);
    g.fillStyle(COLORS.button, 1).fillRoundedRect(l, top, s, s, 14);
    g.lineStyle(3, COLORS.buttonEdge, 1).strokeRoundedRect(l, top, s, s, 14);
    // Speaker: a small box and a cone, left of centre.
    const bx = x - 14;
    g.fillStyle(0xffffff, 1);
    g.fillRect(bx - 6, y - 5, 8, 10);
    g.fillTriangle(bx + 2, y - 5, bx + 2, y + 5, bx + 14, y + 14);
    g.fillTriangle(bx + 2, y - 5, bx + 14, y - 14, bx + 14, y + 14);
    if (muted) {
      g.lineStyle(4, 0xff6b5a, 1);
      g.lineBetween(x + 6, y - 8, x + 20, y + 8);
      g.lineBetween(x + 6, y + 8, x + 20, y - 8);
    } else {
      g.lineStyle(3, 0xffffff, 1);
      g.beginPath();
      g.arc(x + 4, y, 8, -0.9, 0.9);
      g.strokePath();
      g.beginPath();
      g.arc(x + 4, y, 15, -0.9, 0.9);
      g.strokePath();
    }
    zone.setPosition(x, y);
    const ui: MuteUi = { x, y, width: s, height: s, label: t(current, muted ? 'unmute' : 'mute') };
    scene.registry.set('muteUi', ui);
    publishSound(scene, player);
  };

  const toggle = () => {
    player.unlock();
    player.toggleMuted();
    draw();
  };
  zone.on(Phaser.Input.Events.POINTER_DOWN, toggle);
  draw();

  return {
    setLang(next) {
      current = next;
      draw();
    },
    toggle,
    destroy() {
      zone.destroy();
      g.destroy();
    },
  };
}
