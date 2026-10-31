import { COLORS } from "../constants";

export interface Point {
  x: number;
  y: number;
}

export interface GradientStop {
  /** Position from the top of the sky, 0 to 1. */
  at: number;
  color: number;
}

export interface Dune {
  color: number;
  /** A closed outline: the ridge from left to right, then the two bottom corners on the horizon. */
  points: Point[];
  height: number;
}

export interface DesertLayout {
  width: number;
  height: number;
  horizonY: number;
  sky: { top: number; bottom: number; height: number; stops: GradientStop[] };
  sun: {
    x: number;
    y: number;
    radius: number;
    color: number;
    glowColor: number;
    glowRadius: number;
  };
  dunes: Dune[];
  sand: {
    y: number;
    height: number;
    color: number;
    ripples: { y: number; color: number }[];
  };
}

/** Where the horizon sits, as a share of the height. */
export const HORIZON_RATIO = 0.78;

const RIDGE_STEPS = 24;

function ridge(
  width: number,
  baseY: number,
  height: number,
  waves: number,
  phase: number,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= RIDGE_STEPS; i++) {
    const x = (width * i) / RIDGE_STEPS;
    // A smooth wave between 0 and 1, so the ridge stays between baseY - height and baseY.
    const wave =
      (Math.sin((i / RIDGE_STEPS) * Math.PI * 2 * waves + phase) + 1) / 2;
    points.push({ x, y: baseY - height * (0.35 + 0.65 * wave) });
  }
  points.push({ x: width, y: baseY }, { x: 0, y: baseY });
  return points;
}

/** The shapes and colours of the desert background, for any size. Pure: no Phaser, so it can be tested on its own. */
export function buildDesertLayout(width: number, height: number): DesertLayout {
  const horizonY = Math.round(height * HORIZON_RATIO);
  const farHeight = height * 0.09;
  const nearHeight = height * 0.05;
  const sunRadius = Math.min(width, height) * 0.09;
  const sandHeight = height - horizonY;

  return {
    width,
    height,
    horizonY,
    sky: {
      top: 0,
      bottom: horizonY,
      height: horizonY,
      stops: [
        { at: 0, color: COLORS.skyTop },
        { at: 0.55, color: COLORS.skyMiddle },
        { at: 1, color: COLORS.skyBottom },
      ],
    },
    sun: {
      x: width * 0.72,
      y: horizonY * 0.3,
      radius: sunRadius,
      color: COLORS.sun,
      glowColor: COLORS.sunGlow,
      glowRadius: sunRadius * 1.6,
    },
    dunes: [
      {
        color: COLORS.duneFar,
        height: farHeight,
        points: ridge(width, horizonY, farHeight, 1.5, 0.6),
      },
      {
        color: COLORS.duneNear,
        height: nearHeight,
        points: ridge(width, horizonY, nearHeight, 2.5, 2.1),
      },
    ],
    sand: {
      y: horizonY,
      height: sandHeight,
      color: COLORS.sand,
      ripples: [0.25, 0.5, 0.75].map((share) => ({
        y: horizonY + sandHeight * share,
        color: COLORS.sandRipple,
      })),
    },
  };
}

/** Mixes two 0xRRGGBB colours; t = 0 gives a, t = 1 gives b. */
export function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

/** The sky colour at a share (0 top, 1 horizon) of the sky's height. */
export function skyColorAt(stops: GradientStop[], at: number): number {
  const t = Math.min(1, Math.max(0, at));
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const next = stops[i];
    if (t <= next.at)
      return mixColor(
        prev.color,
        next.color,
        (t - prev.at) / (next.at - prev.at || 1),
      );
  }
  return stops[stops.length - 1].color;
}
