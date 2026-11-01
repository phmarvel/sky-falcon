import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PAUSE_UI, UI } from '../constants';
import { type Lang, directionOf, formatNumber, t } from '../i18n/strings';
import type { PauseMode } from '../run/pauseState';

export interface PauseOverlay {
  /** Shows the overlay for `mode` ('paused': title and hint; 'counting': the big `number`), hides it when running. */
  show(mode: PauseMode, number: number | null, lang: Lang): void;
  /** What is shown now (empty strings when hidden); the browser tests read it. */
  texts(): { title: string; hint: string; number: string };
  visible(): boolean;
  destroy(): void;
}

/**
 * Dims the run and says it is paused; a tap anywhere on it calls `onTap` (to resume). The dim layer is interactive,
 * so the tap counts as a press on an object and is not a flap. Depth 90: over the buttons, under the game over screen.
 */
export function createPauseOverlay(scene: Phaser.Scene, onTap: () => void): PauseOverlay {
  const dim = scene.add
    .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.55)
    .setOrigin(0, 0)
    .setDepth(PAUSE_UI.overlayDepth)
    .setInteractive();
  dim.on(Phaser.Input.Events.POINTER_DOWN, onTap);
  const style = (size: number, color: string) => ({
    fontFamily: UI.fontFamily,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: UI.titleStroke,
    strokeThickness: Math.round(size / 8),
    align: 'center',
  });
  const title = scene.add.text(GAME_WIDTH / 2, 360, '', style(64, UI.title)).setOrigin(0.5).setDepth(PAUSE_UI.overlayDepth + 1);
  const hint = scene.add.text(GAME_WIDTH / 2, 450, '', style(34, UI.bestText)).setOrigin(0.5).setDepth(PAUSE_UI.overlayDepth + 1);
  const big = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', style(200, UI.title)).setOrigin(0.5).setDepth(PAUSE_UI.overlayDepth + 1);
  const all = [dim, title, hint, big];
  let shown = { title: '', hint: '', number: '' };
  let rtlNow = false;

  const hide = () => {
    for (const o of all) o.setVisible(false);
    // An invisible object gets no pointer events, so a hidden overlay never swallows a flap.
    shown = { title: '', hint: '', number: '' };
  };
  hide();

  return {
    show(mode, number, lang) {
      if (mode === 'running') return hide();
      const rtl = directionOf(lang) === 'rtl';
      const next =
        mode === 'paused'
          ? { title: t(lang, 'paused'), hint: t(lang, 'resumeHint'), number: '' }
          : { title: '', hint: '', number: number === null ? '' : formatNumber(number, lang) };
      for (const o of all) o.setVisible(true);
      // Text is set only when it changes, so the canvas texture is not redrawn every frame.
      if (next.title !== shown.title) title.setText(next.title);
      if (next.hint !== shown.hint) hint.setText(next.hint);
      if (next.number !== shown.number) big.setText(next.number);
      if (rtl !== rtlNow) {
        for (const text of [title, hint, big]) text.setRTL(rtl);
        rtlNow = rtl;
      }
      title.setVisible(next.title !== '');
      hint.setVisible(next.hint !== '');
      big.setVisible(next.number !== '');
      shown = next;
    },
    texts: () => ({ ...shown }),
    visible: () => dim.visible,
    destroy() {
      for (const o of all) o.destroy();
    },
  };
}
