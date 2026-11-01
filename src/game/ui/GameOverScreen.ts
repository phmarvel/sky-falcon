import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, UI } from "../constants";
import { createPressGate } from "../falcon/pressGate";
import { drawMedal } from "./drawMedal";
import type { Medal } from "../score/medals";
import { type Lang, directionOf, formatNumber, t } from "../i18n/strings";

/** Seconds of scene time before Play again reacts, so the tap that ended the run cannot restart it. */
export const PLAY_AGAIN_GUARD_MS = 400;

const PANEL = { width: 440, height: 680, top: 60 };
const BUTTON = { x: GAME_WIDTH / 2, y: 665, width: 330, height: 88 };

export interface GameOverInfo {
  score: number;
  best: number;
  isNewBest: boolean;
  /** The medal won in this run, and the best one ever won on this device. */
  medal: Medal | null;
  bestMedal: Medal | null;
  isNewMedal: boolean;
  lang: Lang;
  onPlayAgain: () => void;
}

/** The game over screen: score, best score and Play again, drawn over the run at depth 100. */
export function showGameOver(scene: Phaser.Scene, info: GameOverInfo): void {
  const { score, best, isNewBest, medal, bestMedal, isNewMedal, lang } = info;
  const rtl = directionOf(lang) === "rtl";
  const depth = 100;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const keys = createPressGate();
  let ready = false;
  let done = false;

  const medalText = medal ? `${t(lang, "medal")}: ${t(lang, medal)}` : "";
  const bestMedalText = `${t(lang, "bestMedal")}: ${bestMedal ? t(lang, bestMedal) : t(lang, "noMedal")}`;

  const publish = () =>
    scene.registry.set("gameOver", {
      score,
      best,
      isNewBest,
      medal,
      bestMedal,
      isNewMedal,
      lang,
      dir: directionOf(lang),
      ready,
      texts: {
        title: t(lang, "gameOver"),
        score: `${t(lang, "score")}: ${formatNumber(score, lang)}`,
        bestScore: `${t(lang, "bestScore")}: ${formatNumber(best, lang)}`,
        medal: medalText,
        bestMedal: bestMedalText,
        playAgain: t(lang, "playAgain"),
      },
      ui: { ...BUTTON },
    });

  const g = scene.add.graphics().setDepth(depth);
  objects.push(g);
  g.fillStyle(COLORS.overlay, 0.55).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const left = (GAME_WIDTH - PANEL.width) / 2;
  g.fillStyle(COLORS.panel, 1).fillRoundedRect(
    left,
    PANEL.top,
    PANEL.width,
    PANEL.height,
    28,
  );
  g.lineStyle(5, COLORS.panelEdge, 1).strokeRoundedRect(
    left,
    PANEL.top,
    PANEL.width,
    PANEL.height,
    28,
  );
  const bl = BUTTON.x - BUTTON.width / 2;
  const bt = BUTTON.y - BUTTON.height / 2;
  g.fillStyle(COLORS.shadow, 0.55).fillRoundedRect(
    bl,
    bt + 6,
    BUTTON.width,
    BUTTON.height,
    22,
  );
  g.fillStyle(COLORS.button, 1).fillRoundedRect(
    bl,
    bt,
    BUTTON.width,
    BUTTON.height,
    22,
  );
  g.lineStyle(4, COLORS.buttonEdge, 1).strokeRoundedRect(
    bl,
    bt,
    BUTTON.width,
    BUTTON.height,
    22,
  );

  const text = (y: number, value: string, size: number, color: string) => {
    const label = scene.add
      .text(GAME_WIDTH / 2, y, value, {
        fontFamily: UI.fontFamily,
        fontSize: `${size}px`,
        fontStyle: "bold",
        color,
        rtl,
        align: "center",
        wordWrap: { width: PANEL.width - 40 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    objects.push(label);
    return label;
  };
  text(130, t(lang, "gameOver"), 56, UI.panelText);
  text(205, t(lang, "score"), 32, UI.panelText);
  text(275, formatNumber(score, lang), 88, UI.panelText);
  if (medal) {
    // The medal won in this run; with fewer points than the bronze threshold nothing is drawn here.
    drawMedal(g, GAME_WIDTH / 2, 365, medal, 36);
    text(443, medalText, 32, UI.panelText);
  }
  text(
    493,
    `${t(lang, "bestScore")}: ${formatNumber(best, lang)}`,
    36,
    UI.panelText,
  );
  if (isNewBest) text(530, t(lang, "newBest"), 28, UI.newBest);
  const row = text(578, bestMedalText, 30, UI.panelText);
  if (bestMedal) {
    // The icon sits before the text: left in LTR, right in RTL.
    const gap = row.width / 2 + 30;
    drawMedal(g, GAME_WIDTH / 2 + (rtl ? gap : -gap), 572, bestMedal, 16);
  }
  text(BUTTON.y - 2, t(lang, "playAgain"), 40, UI.buttonText);

  const play = () => {
    if (!ready || done) return;
    done = true;
    cleanup();
    info.onPlayAgain();
  };
  const onSpaceDown = (event: KeyboardEvent) => {
    if (keys.down("SPACE", event.repeat)) play();
  };
  const onSpaceUp = () => keys.up("SPACE");

  const hit = scene.add
    .zone(BUTTON.x, BUTTON.y, BUTTON.width, BUTTON.height)
    .setDepth(depth + 2)
    .setInteractive({ useHandCursor: true });
  objects.push(hit);
  hit.on(Phaser.Input.Events.POINTER_DOWN, play);
  const keyboard = scene.input.keyboard;
  keyboard?.addCapture("SPACE");
  keyboard?.on("keydown-SPACE", onSpaceDown);
  keyboard?.on("keyup-SPACE", onSpaceUp);

  function cleanup(): void {
    keyboard?.off("keydown-SPACE", onSpaceDown);
    keyboard?.off("keyup-SPACE", onSpaceUp);
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  publish();
  scene.time.delayedCall(PLAY_AGAIN_GUARD_MS, () => {
    ready = true;
    publish();
  });
}
