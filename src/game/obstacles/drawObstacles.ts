import Phaser from 'phaser';
import { COLORS } from '../constants';
import { DATE, type Obstacle, type ObstacleField } from './obstacleField';
import { type Part, obstacleParts } from './obstacleShapes';

/** Above the background (-100), below the falcon (10). */
export const OBSTACLE_DEPTH = 0;

/** Bottom pieces are drawn a little into the sand, so they look planted. */
const PLANTED = 8;

export interface ObstacleView {
  /** Shows the obstacles of `field`: adds new ones, moves them, removes the ones that left the field. */
  sync(field: ObstacleField | null): void;
  /** How many obstacles are drawn now. */
  count(): number;
  /** How many dates are drawn now (caught ones are gone). */
  datesDrawn(): number;
}

function drawTowerPart(g: Phaser.GameObjects.Graphics, p: Part, groundY: number): void {
  const height = p.side === 'bottom' && p.y + p.height >= groundY ? p.height + PLANTED : p.height;
  if (height <= 0) return;
  if (p.role === 'shaft') {
    g.fillStyle(COLORS.towerStone, 1);
    g.fillRect(p.x, p.y, p.width, height);
    g.fillStyle(COLORS.towerShade, 1);
    g.fillRect(p.x + p.width * 0.65, p.y, p.width * 0.35, height);
    // Window slits with a round top, spaced along the shaft, starting next to the cap.
    g.fillStyle(COLORS.towerWindow, 1);
    const cx = p.x + p.width * 0.4;
    const fromCap = p.side === 'bottom' ? (k: number) => p.y + 28 + k * 80 : (k: number) => p.y + p.height - 48 - k * 80;
    for (let k = 0; ; k++) {
      const y = fromCap(k);
      if (y < p.y + 6 || y + 22 > p.y + p.height - 6) break;
      g.fillRect(cx - 4, y + 4, 8, 18);
      g.fillCircle(cx, y + 4, 4);
    }
    g.lineStyle(2, COLORS.towerOutline, 1);
    g.strokeRect(p.x, p.y, p.width, height);
    return;
  }
  // The cap at the gap edge: a light band with crenellations on the side facing the gap.
  g.fillStyle(COLORS.towerTrim, 1);
  g.fillRect(p.x, p.y, p.width, height);
  g.fillStyle(COLORS.towerShade, 1);
  const notchH = Math.min(8, height / 3);
  const notchY = p.side === 'bottom' ? p.y : p.y + height - notchH;
  for (let k = 0; k < 4; k++) g.fillRect(p.x + 8 + k * 20, notchY, 8, notchH);
  const bandY = p.side === 'bottom' ? p.y + height - 5 : p.y;
  g.fillRect(p.x, bandY, p.width, 5);
  g.lineStyle(2, COLORS.towerOutline, 1);
  g.strokeRect(p.x, p.y, p.width, height);
}

function leaf(
  g: Phaser.GameObjects.Graphics,
  base: { x: number; y: number },
  tip: { x: number; y: number },
  width: number,
): void {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  const mx = base.x + dx * 0.45;
  const my = base.y + dy * 0.45;
  g.fillPoints(
    [
      { x: base.x, y: base.y },
      { x: mx + nx, y: my + ny },
      { x: tip.x, y: tip.y },
      { x: mx - nx, y: my - ny },
    ],
    true,
  );
}

function drawPalmPart(g: Phaser.GameObjects.Graphics, p: Part, groundY: number): void {
  const height = p.side === 'bottom' && p.y + p.height >= groundY ? p.height + PLANTED : p.height;
  if (height <= 0) return;
  if (p.role === 'trunk') {
    g.fillStyle(COLORS.palmTrunk, 1);
    g.fillRect(p.x, p.y, p.width, height);
    // Rings: little chevrons along the trunk.
    g.lineStyle(2, COLORS.palmTrunkRing, 1);
    const dir = p.side === 'bottom' ? -1 : 1;
    for (let y = p.y + 10; y < p.y + height - 4; y += 14) {
      g.lineBetween(p.x + 2, y, p.x + p.width / 2, y + 4 * dir);
      g.lineBetween(p.x + p.width / 2, y + 4 * dir, p.x + p.width - 2, y);
    }
    g.lineStyle(2, COLORS.palmTrunkRing, 1);
    g.strokeRect(p.x, p.y, p.width, height);
    return;
  }
  // The crown at the gap edge: fronds fanning out from the top of the trunk, all inside the part's rectangle.
  const w = p.width;
  const h = height;
  // `at(share)` measures from the gap edge, so the same fan works hanging from above and rising from below.
  const at = (share: number) => (p.side === 'bottom' ? p.y + h * share : p.y + h * (1 - share));
  const base = { x: p.x + w / 2, y: at(0.62) };
  const outer = [
    { x: p.x + 1, y: at(0.98) },
    { x: p.x + 2, y: at(0.4) },
    { x: p.x + w - 2, y: at(0.4) },
    { x: p.x + w - 1, y: at(0.98) },
  ];
  const inner = [
    { x: p.x + w * 0.12, y: at(0.08) },
    { x: p.x + w * 0.38, y: at(0.0) },
    { x: p.x + w * 0.62, y: at(0.0) },
    { x: p.x + w * 0.88, y: at(0.08) },
  ];
  g.fillStyle(COLORS.palmLeafDark, 1);
  for (const tip of outer) leaf(g, base, tip, 14);
  g.fillStyle(COLORS.palmLeaf, 1);
  for (const tip of inner) leaf(g, base, tip, 13);
  g.fillStyle(COLORS.palmTrunkRing, 1);
  g.fillCircle(base.x, base.y, 6);
}

/** A date: a brown oval with a darker side, a shine and a small cap, centred on (0, 0). */
function drawDate(g: Phaser.GameObjects.Graphics): void {
  const rx = DATE.radius * 0.72;
  const ry = DATE.radius;
  g.fillStyle(COLORS.dateBody, 1);
  g.fillEllipse(0, 0, rx * 2, ry * 2);
  g.fillStyle(COLORS.dateShade, 1);
  g.fillEllipse(rx * 0.35, ry * 0.15, rx * 1.1, ry * 1.6);
  g.fillStyle(COLORS.dateShine, 1);
  g.fillEllipse(-rx * 0.4, -ry * 0.35, rx * 0.4, ry * 0.7);
  g.lineStyle(2, COLORS.dateOutline, 1);
  g.strokeEllipse(0, 0, rx * 2, ry * 2);
  g.lineBetween(0, -ry, 3, -ry - 5);
}

interface Shown {
  container: Phaser.GameObjects.Container;
  date: Phaser.GameObjects.Graphics | null;
}

function drawObstacle(scene: Phaser.Scene, o: Obstacle, groundY: number): Shown {
  const g = scene.add.graphics();
  for (const part of obstacleParts(o.kind, o.width, o.gapTop, o.gapBottom, groundY)) {
    if (o.kind === 'tower') drawTowerPart(g, part, groundY);
    else drawPalmPart(g, part, groundY);
  }
  const date = scene.add.graphics();
  drawDate(date);
  date.setPosition(DATE.offsetX, o.date.y);
  const container = scene.add.container(Math.round(o.x), 0, [g, date]).setDepth(OBSTACLE_DEPTH);
  return { container, date: o.date.caught ? null : date };
}

/** The towers and palm trees: each drawn once, then only moved; removed once it leaves the field. */
export function createObstacleView(scene: Phaser.Scene, groundY: number): ObstacleView {
  const shown = new Map<number, Shown>();
  return {
    sync(field) {
      const alive = new Set<number>();
      for (const o of field?.obstacles ?? []) {
        alive.add(o.id);
        const existing = shown.get(o.id);
        if (existing) {
          existing.container.x = o.x;
          if (o.date.caught && existing.date) {
            existing.date.destroy();
            existing.date = null;
          }
        } else {
          const made = drawObstacle(scene, o, groundY);
          if (o.date.caught) made.date?.destroy();
          shown.set(o.id, made);
        }
      }
      for (const [id, item] of shown) {
        if (alive.has(id)) continue;
        item.container.destroy();
        shown.delete(id);
      }
    },
    count: () => shown.size,
    datesDrawn() {
      let n = 0;
      for (const item of shown.values()) if (item.date) n++;
      return n;
    },
  };
}
