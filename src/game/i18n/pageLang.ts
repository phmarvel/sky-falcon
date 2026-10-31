import { type Lang, directionOf } from "./strings";

/** Keeps the page's `lang` and `dir` in step with the game. */
export function applyPageLang(lang: Lang): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = directionOf(lang);
}
