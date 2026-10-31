import Phaser from "phaser";
import { type DesertLayout, skyColorAt } from "./desertLayout";

/** Depth of the background: everything later stories add (falcon, obstacles, text) sits above it. */
export const BACKGROUND_DEPTH = -100;

const SKY_BANDS = 64;

/** Draws the desert layout with simple shapes and returns the Graphics object. */
export function drawDesert(
  scene: Phaser.Scene,
  layout: DesertLayout,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(BACKGROUND_DEPTH);
  const { sky, sun, dunes, sand, width } = layout;

  // Sky: thin bands along the gradient. Works the same in WebGL and Canvas renderers.
  const band = sky.height / SKY_BANDS;
  for (let i = 0; i < SKY_BANDS; i++) {
    g.fillStyle(skyColorAt(sky.stops, (i + 0.5) / SKY_BANDS), 1);
    g.fillRect(0, sky.top + i * band, width, Math.ceil(band) + 1);
  }

  // A soft glow: a few faint rings, wider ones fainter.
  for (const [share, alpha] of [
    [1, 0.12],
    [0.8, 0.18],
    [0.65, 0.25],
  ] as const) {
    g.fillStyle(sun.glowColor, alpha);
    g.fillCircle(sun.x, sun.y, sun.glowRadius * share);
  }
  g.fillStyle(sun.color, 1);
  g.fillCircle(sun.x, sun.y, sun.radius);

  for (const dune of dunes) {
    g.fillStyle(dune.color, 1);
    g.fillPoints(dune.points, true);
  }

  g.fillStyle(sand.color, 1);
  g.fillRect(0, sand.y, width, sand.height);

  g.lineStyle(3, sand.ripples[0]?.color ?? sand.color, 0.5);
  sand.ripples.forEach((ripple, i) => {
    const inset = width * (0.08 + 0.06 * (i % 2));
    g.lineBetween(inset, ripple.y, width - inset * 1.6, ripple.y);
  });

  return g;
}
