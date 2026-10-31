import Phaser from 'phaser';
import { COLORS } from '../constants';
import { FALCON, type FalconState, falconTilt } from './falconPhysics';

/** Above the background (-100) and below the text later stories add. */
export const FALCON_DEPTH = 10;

/** Wing angles in degrees: resting slightly down, lifted on a flap. */
const WING_REST = 12;
const WING_LIFT = -70;
const BOB_PIXELS = 8;
const BOB_PERIOD_MS = 1400;

export interface FalconView {
  container: Phaser.GameObjects.Container;
  /** Plays the wing stroke of one flap. */
  flapWing(): void;
  /** After hitting an obstacle: the falcon tumbles from where it is onto the sand. */
  fallFrom(y: number): void;
  /** Places the falcon for this frame. */
  update(state: FalconState, timeMs: number): void;
}

function drawBody(g: Phaser.GameObjects.Graphics): void {
  const outline = COLORS.falconOutline;
  // Tail fan, behind the body.
  g.fillStyle(COLORS.falconWing, 1);
  g.fillTriangle(-20, -2, -42, -12, -40, 10);
  g.lineStyle(2, outline, 1);
  g.strokeTriangle(-20, -2, -42, -12, -40, 10);

  // Body and belly.
  g.fillStyle(COLORS.falconBody, 1);
  g.fillEllipse(0, 0, 56, 32);
  g.strokeEllipse(0, 0, 56, 32);
  g.fillStyle(COLORS.falconBelly, 1);
  g.fillEllipse(6, 6, 34, 16);

  // Head, beak, eye and the dark falcon stripe under the eye.
  g.fillStyle(COLORS.falconBody, 1);
  g.fillCircle(22, -9, 13);
  g.strokeCircle(22, -9, 13);
  g.fillStyle(COLORS.falconBelly, 1);
  g.fillCircle(25, -4, 6);
  g.fillStyle(COLORS.falconBeak, 1);
  g.fillTriangle(32, -14, 44, -7, 32, -4);
  g.lineStyle(1.5, outline, 1);
  g.strokeTriangle(32, -14, 44, -7, 32, -4);
  g.fillStyle(COLORS.falconEye, 1);
  g.fillCircle(26, -12, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(27, -13, 1);
  g.fillStyle(COLORS.falconOutline, 1);
  g.fillTriangle(22, -8, 26, -8, 22, 2);
}

function drawWing(g: Phaser.GameObjects.Graphics): void {
  // Drawn from the shoulder (0, 0) back towards the tail, so rotating the Graphics lifts it.
  const points = [
    { x: 4, y: 0 },
    { x: -8, y: -6 },
    { x: -34, y: -4 },
    { x: -30, y: 2 },
    { x: -36, y: 6 },
    { x: -26, y: 9 },
    { x: -10, y: 8 },
  ];
  g.fillStyle(COLORS.falconWing, 1);
  g.fillPoints(points, true);
  g.lineStyle(2, COLORS.falconOutline, 1);
  g.strokePoints(points, true);
}

/** The falcon, drawn with simple shapes, and its shadow on the sand. */
export function createFalconView(scene: Phaser.Scene, groundY: number): FalconView {
  const shadow = scene.add.ellipse(FALCON.x, groundY + 8, 52, 10, COLORS.shadow, 0.35).setDepth(FALCON_DEPTH - 1);

  const body = scene.add.graphics();
  drawBody(body);
  const wing = scene.add.graphics({ x: -2, y: -4 });
  drawWing(wing);
  wing.angle = WING_REST;

  const container = scene.add.container(FALCON.x, FALCON.startY, [body, wing]).setDepth(FALCON_DEPTH);
  /** 1 right after a flap, easing back to 0. */
  const stroke = { lift: 0 };
  let strokeTween: Phaser.Tweens.Tween | undefined;
  /** Set once the falcon crashed into an obstacle: the drop's y and angle, tweened. */
  let drop: { y: number; angle: number } | undefined;

  return {
    container,
    flapWing() {
      strokeTween?.stop();
      stroke.lift = 1;
      strokeTween = scene.tweens.add({ targets: stroke, lift: 0, duration: 260, ease: 'Quad.easeOut' });
    },
    fallFrom(y) {
      strokeTween?.stop();
      stroke.lift = 0;
      const floor = groundY - FALCON.radius;
      drop = { y, angle: container.angle };
      scene.tweens.add({
        targets: drop,
        y: floor,
        angle: 20,
        duration: 250 + Math.max(floor - y, 0) * 0.9,
        ease: 'Quad.easeIn',
      });
    },
    update(state, timeMs) {
      if (drop) {
        container.setPosition(FALCON.x, drop.y);
        container.angle = drop.angle;
        wing.angle = WING_REST;
        const near = Phaser.Math.Clamp(1 - (groundY - drop.y) / groundY, 0, 1);
        shadow.setScale(0.5 + 0.5 * near, 1).setAlpha(0.12 + 0.3 * near);
        return;
      }
      let y = state.y;
      let lift = stroke.lift;
      if (state.phase === 'ready') {
        // Hovering: a gentle bob and a slow wing beat while waiting for the first flap.
        const wave = Math.sin((timeMs / BOB_PERIOD_MS) * Math.PI * 2);
        y += wave * BOB_PIXELS;
        lift = Math.max(lift, (wave + 1) / 2 * 0.6);
      } else if (state.phase === 'down') {
        lift = 0;
      }
      container.setPosition(FALCON.x, y);
      container.angle = falconTilt(state.vy, state.phase);
      wing.angle = WING_REST + (WING_LIFT - WING_REST) * lift;

      // The shadow grows and darkens as the falcon gets closer to the ground.
      const closeness = Phaser.Math.Clamp(1 - (groundY - y) / groundY, 0, 1);
      shadow.setScale(0.5 + 0.5 * closeness, 1).setAlpha(0.12 + 0.3 * closeness);
    },
  };
}
