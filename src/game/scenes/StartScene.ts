import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, UI } from '../constants';
import { buildDesertLayout } from '../background/desertLayout';
import { drawDesert } from '../background/drawDesert';
import { createFalcon } from '../falcon/falconPhysics';
import { createFalconView } from '../falcon/drawFalcon';
import { getLangStore } from '../i18n/langStore';
import { applyPageLang } from '../i18n/pageLang';
import { type Lang, directionOf, formatNumber, otherLang, t } from '../i18n/strings';
import { type MuteButton, createMuteButton } from '../audio/drawMuteButton';
import { getSoundPlayer } from '../audio/soundPlayer';
import { getBestScoreStore } from '../score/bestScore';
import { getBestMedalStore } from '../score/bestMedal';
import type { Medal } from '../score/medals';
import { drawMedal } from '../ui/drawMedal';

const BUTTON = { x: GAME_WIDTH / 2, y: 610, width: 240, height: 84 };
const SWITCH = { width: 160, height: 72, y: 60, margin: 20 };

/** The language switch sits in the top corner at the end of the reading direction's start: right for LTR, left for RTL. */
function switchUi(lang: Lang) {
  const x = directionOf(lang) === 'rtl' ? SWITCH.margin + SWITCH.width / 2 : GAME_WIDTH - SWITCH.margin - SWITCH.width / 2;
  return { x, y: SWITCH.y, width: SWITCH.width, height: SWITCH.height };
}

/** The first screen: the name, the best score and Play. The falcon only hovers; nothing moves on until Play. */
export class StartScene extends Phaser.Scene {
  static readonly KEY = 'Start';
  static readonly NEXT = 'Flight';

  private view!: ReturnType<typeof createFalconView>;
  private falconState = createFalcon();
  private started = false;
  private lang: Lang = 'en';
  private best = 0;
  private bestMedal: Medal | null = null;
  private texts: Phaser.GameObjects.GameObject[] = [];
  private switchHit!: Phaser.GameObjects.Zone;
  private mute!: MuteButton;

  constructor() {
    super(StartScene.KEY);
  }

  create(): void {
    this.started = false;
    const layout = buildDesertLayout(GAME_WIDTH, GAME_HEIGHT);
    drawDesert(this, layout);

    this.falconState = createFalcon();
    this.view = createFalconView(this, layout.horizonY);
    this.view.update(this.falconState, this.time.now);

    this.best = getBestScoreStore().load();
    this.bestMedal = getBestMedalStore().load();
    this.lang = getLangStore().get();
    this.buildTexts();

    // The whole button is the hit area, so a thumb does not have to be exact.
    const hit = this.add
      .zone(BUTTON.x, BUTTON.y, BUTTON.width, BUTTON.height)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.POINTER_DOWN, this.play, this);
    this.switchHit = this.add.zone(0, 0, SWITCH.width, SWITCH.height).setDepth(21).setInteractive({ useHandCursor: true });
    this.switchHit.on(Phaser.Input.Events.POINTER_DOWN, this.toggleLang, this);
    this.switchHit.setPosition(switchUi(this.lang).x, SWITCH.y);
    const sound = getSoundPlayer();
    this.mute = createMuteButton(this, this.lang, 'start', sound);
    // The first gesture wakes the audio up (browsers allow sound only after one).
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => sound.unlock());
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.addCapture('SPACE,ENTER,L');
      keyboard.on('keydown-M', this.onMuteKey, this);
      keyboard.on('keydown-L', this.onLangKey, this);
      keyboard.on('keydown-SPACE', this.onKey, this);
      keyboard.on('keydown-ENTER', this.onKey, this);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keydown-M', this.onMuteKey, this);
      keyboard?.off('keydown-L', this.onLangKey, this);
      keyboard?.off('keydown-SPACE', this.onKey, this);
      keyboard?.off('keydown-ENTER', this.onKey, this);
    });

    this.registry.set('runOver', false);
    this.registry.set('screen', 'start');
    this.registry.set('score', 0);
    this.registry.set('bestScore', this.best);
    this.registry.set('bestMedal', this.bestMedal);
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

  /** Draws every text and the language switch in `this.lang`; used again after a switch. */
  private buildTexts(): void {
    const { lang } = this;
    this.texts.forEach((o) => o.destroy());
    this.texts = [];
    applyPageLang(lang);
    const rtl = directionOf(lang) === 'rtl';
    const font = UI.fontFamily;
    const text = (x: number, y: number, value: string, size: number, color: string, stroke = true) => {
      const label = this.add
        .text(x, y, value, { fontFamily: font, fontSize: `${size}px`, fontStyle: 'bold', color, rtl })
        .setOrigin(0.5)
        .setDepth(20);
      if (stroke) label.setStroke(UI.titleStroke, Math.round(size / 7));
      this.texts.push(label);
      return label;
    };

    const title = t(lang, 'title');
    const best = `${t(lang, 'bestScore')}: ${formatNumber(this.best, lang)}`;
    const play = t(lang, 'play');
    const other = t(lang, 'switchLanguage');
    text(GAME_WIDTH / 2, 190, title, 72, UI.title);
    text(GAME_WIDTH / 2, 262, best, 38, UI.bestText);
    const medalName = this.bestMedal ? t(lang, this.bestMedal) : t(lang, 'noMedal');
    const bestMedal = `${t(lang, 'bestMedal')}: ${medalName}`;
    const medalLabel = text(GAME_WIDTH / 2, 312, bestMedal, 30, UI.bestText);
    if (this.bestMedal) {
      // The icon sits before the text: left in LTR, right in RTL.
      const medalShape = this.add.graphics().setDepth(20);
      this.texts.push(medalShape);
      const gap = medalLabel.width / 2 + 28;
      drawMedal(medalShape, GAME_WIDTH / 2 + (rtl ? gap : -gap), 305, this.bestMedal, 15);
    }

    const left = BUTTON.x - BUTTON.width / 2;
    const top = BUTTON.y - BUTTON.height / 2;
    const shape = this.add.graphics().setDepth(20);
    this.texts.push(shape);
    shape.fillStyle(COLORS.shadow, 0.55).fillRoundedRect(left, top + 6, BUTTON.width, BUTTON.height, 22);
    shape.fillStyle(COLORS.button, 1).fillRoundedRect(left, top, BUTTON.width, BUTTON.height, 22);
    shape.lineStyle(4, COLORS.buttonEdge, 1).strokeRoundedRect(left, top, BUTTON.width, BUTTON.height, 22);
    text(BUTTON.x, BUTTON.y - 2, play, 44, UI.buttonText, false);

    const sw = switchUi(lang);
    const sl = sw.x - sw.width / 2;
    const st = sw.y - sw.height / 2;
    shape.fillStyle(COLORS.shadow, 0.55).fillRoundedRect(sl, st + 4, sw.width, sw.height, 18);
    shape.fillStyle(COLORS.button, 1).fillRoundedRect(sl, st, sw.width, sw.height, 18);
    shape.lineStyle(3, COLORS.buttonEdge, 1).strokeRoundedRect(sl, st, sw.width, sw.height, 18);
    text(sw.x, sw.y - 1, other, 28, UI.switchText, false);
    this.switchHit?.setPosition(sw.x, sw.y);
    this.mute?.setLang(lang);

    this.registry.set('lang', lang);
    this.registry.set('dir', directionOf(lang));
    this.registry.set('langUi', sw);
    this.registry.set('startTexts', { title, bestScore: best, bestMedal, play, switchLanguage: other });
  }

  private toggleLang(): void {
    if (this.started) return;
    this.lang = otherLang(this.lang);
    getLangStore().set(this.lang);
    this.buildTexts();
  }

  private onLangKey(event: KeyboardEvent): void {
    if (!event.repeat) this.toggleLang();
  }

  private onMuteKey(event: KeyboardEvent): void {
    if (!event.repeat) this.mute.toggle();
  }

  private onKey(event: KeyboardEvent): void {
    getSoundPlayer().unlock();
    if (!event.repeat) this.play();
  }

  private play(): void {
    if (this.started) return;
    this.started = true;
    this.registry.set('ready', false);
    this.scene.start(StartScene.NEXT);
  }
}
