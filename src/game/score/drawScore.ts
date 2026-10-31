import Phaser from "phaser";
import { GAME_WIDTH, SCORE_DEPTH, UI } from "../constants";
import { type Lang, formatNumber } from "../i18n/strings";

export interface ScoreView {
  /** Shows `score` (redraws only when the shown text changes). */
  set(score: number): void;
  setLang(lang: Lang): void;
  /** The text on screen, e.g. "3" or "٣". */
  text(): string;
  destroy(): void;
}

/** The score at the top centre, light with a thick dark outline so it reads on sky, towers and palms. */
export function createScoreView(scene: Phaser.Scene, lang: Lang): ScoreView {
  let current = lang;
  let score = 0;
  const label = scene.add
    .text(GAME_WIDTH / 2, 64, formatNumber(0, lang), {
      fontFamily: UI.fontFamily,
      fontSize: "64px",
      fontStyle: "bold",
      color: UI.title,
      stroke: UI.titleStroke,
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(SCORE_DEPTH);
  label.setShadow(0, 3, UI.titleStroke, 4, true, true);
  const render = () => {
    const text = formatNumber(score, current);
    if (label.text !== text) label.setText(text);
  };
  return {
    set(next) {
      score = next;
      render();
    },
    setLang(next) {
      current = next;
      render();
    },
    text: () => label.text,
    destroy: () => label.destroy(),
  };
}
