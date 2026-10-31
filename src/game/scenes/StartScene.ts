import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, UI } from '../constants';
import { buildDesertLayout } from '../background/desertLayout';
import { drawDesert } from '../background/drawDesert';
import { createFalcon } from '../falcon/falconPhysics';
import { createFalconView } from '../falcon/drawFalcon';
import { DEFAULT_LANG, type Lang, directionOf, formatNumber, t } from '../i18n/strings';
import { getBestScoreStore } from '../score/bestScore';

const BUTTON = { x: GAME_WIDTH / 2, y: 610, width: 240, height: 84 };

/** The first screen: the name, the best score and Play. The falcon only hovers; nothing moves on until Play. */
export class StartScene extends Phaser.Scene {
  static readonly KEY = 'Start';
  static readonly NEXT = 'Flight';

  private view!: ReturnType<typeof createFalconView>;
  private falconState = createFalcon();
  private started = false;

  constructor() {
    super(StartScene.KEY);
  }

  create(): void {
    this.started = false;
    const lang: Lang = DEFAULT_LANG;
    const layout = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT);
    drawDesert(this, layout);

    this.falconState = createFalcon();
    this.view = createFalconView(this, layout.horizonY);
    this.view.update(this.falconState, this.time.now);

    const rtl = directionOf(lang) === 'rtl';
    const best = getBestScoreStore().load();
    const font = UI.fontFamily;
    const text = (y: number, value: string, size: number, color: string, stroke = true) => {
      const label = this.add
        .text(GAME_WIDTH / 2, y, value, { fontFamily: font, fontSize: `${size}px`, fontStyle: 'bold', color, rtl })
        .setOrigin(0.5)
        .setDepth(20);
      if (stroke) label.setStroke(UI.titleStroke, Math.round(size / 7));
      return label;
    };

    text(190, t(lang, 'title'), 72, UI.title);
    text(280, `${t(lang, 'bestScore')}: ${formatNumber(best, lang)}`, 38, UI.bestText);

    const left = BUTTON.x - BUTTON.width / 2;
    const top = BUTTON.y - BUTTON.height / 2;
    const shape = this.add.graphics().setDepth(20);
    shape.fillStyle(COLORS.shadow, 0.55).fillRoundedRect(left, top + 6, BUTTON.width, BUTTON.height, 22);
    shape.fillStyle(COLORS.button, 1).fillRoundedRect(left, top, BUTTON.width, BUTTON.height, 22);
    shape.lineStyle(4, COLORS.buttonEdge, 1).strokeRoundedRect(left, top, BUTTON.width, BUTTON.height, 22);
    text(BUTTON.y - 2, t(lang, 'play'), 44, UI.buttonText, false);

    // The whole button is the hit area, so a thumb does not have to be exact.
    const hit = this.add
      .zone(BUTTON.x, BUTTON.y, BUTTON.width, BUTTON.height)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.POINTER_DOWN, this.play, this);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.addCapture('SPACE,ENTER');
      keyboard.on('keydown-SPACE', this.onKey, this);
      keyboard.on('keydown-ENTER', this.onKey, this);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keydown-SPACE', this.onKey, this);
      keyboard?.off('keydown-ENTER', this.onKey, this);
    });

    this.registry.set('runOver', false);
    this.registry.set('screen', 'start');
    this.registry.set('score', 0);
    this.registry.set('bestScore', best);
    this.registry.set('startUi', { ...BUTTON });
    // The falcon waits ("ready"): the snapshot lets tests check that it does not fall.
    const { y, vy, phase, flaps, time } = this.falconState;
    this.registry.set('falcon', { y, vy, phase, flaps, time, groundY: layout.horizonY });
    this.registry.set('ready', true);
  }

  update(time: number): void {
    // Never advanced: only the wing and the hover animation play.
    this.view.update(this.falconState, time);
  }

  private onKey(event: KeyboardEvent): void {
    if (!event.repeat) this.play();
  }

  private play(): void {
    if (this.started) return;
    this.started = true;
    this.registry.set('ready', false);
    this.scene.start(StartScene.NEXT);
  }
}
