import type Phaser from 'phaser';
import { COLORS } from '../constants';
import type { Medal } from '../score/medals';

/** Draws a medal (ribbon, disc, ring, star) centred on (x, y) with disc radius `r`, using Graphics only. */
export function drawMedal(g: Phaser.GameObjects.Graphics, x: number, y: number, medal: Medal, r: number): void {
  const c = COLORS.medal[medal];
  // Ribbon: two tails hanging under the disc.
  g.fillStyle(COLORS.medalRibbon, 1);
  g.fillTriangle(x - r * 0.75, y, x - r * 0.05, y, x - r * 0.6, y + r * 1.55);
  g.fillStyle(COLORS.medalRibbonDark, 1);
  g.fillTriangle(x + r * 0.05, y, x + r * 0.75, y, x + r * 0.6, y + r * 1.55);
  // Disc with an edge and an inner ring.
  g.fillStyle(c.edge, 1).fillCircle(x, y, r);
  g.fillStyle(c.face, 1).fillCircle(x, y, r * 0.86);
  g.lineStyle(Math.max(1, r * 0.08), c.edge, 1).strokeCircle(x, y, r * 0.64);
  // Five-point star.
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r * 0.5 : r * 0.22;
    pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  g.fillStyle(c.star, 1).fillPoints(pts, true);
}
