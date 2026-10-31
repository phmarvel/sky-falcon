import type { ObstacleKind } from "./obstacleField";

/**
 * The solid parts of a tower or a palm tree. Pure: the same rectangles are used to draw the obstacle and to check
 * whether the falcon touches it, so what the player sees is what ends the run.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PartRole = "shaft" | "cap" | "trunk" | "crown";

export interface Part extends Rect {
  role: PartRole;
  /** 'top' hangs from the top edge, 'bottom' rises from the ground. */
  side: "top" | "bottom";
}

export const SHAPES = {
  /** A tower's cap at the gap edge spans the full width; its shaft is narrower by this much on each side. */
  towerInset: 8,
  towerCapHeight: 24,
  palmTrunkWidth: 26,
  palmCrownHeight: 46,
} as const;

/**
 * The parts of one obstacle in its own coordinates (x from 0 to `width`), from the top edge (y = 0) to the ground.
 * Parts never reach into the gap between `gapTop` and `gapBottom`.
 */
export function obstacleParts(
  kind: ObstacleKind,
  width: number,
  gapTop: number,
  gapBottom: number,
  groundY: number,
): Part[] {
  if (kind === "tower") {
    const inset = SHAPES.towerInset;
    const cap = SHAPES.towerCapHeight;
    return [
      {
        role: "shaft",
        side: "top",
        x: inset,
        y: 0,
        width: width - 2 * inset,
        height: Math.max(gapTop - cap, 0),
      },
      {
        role: "cap",
        side: "top",
        x: 0,
        y: Math.max(gapTop - cap, 0),
        width,
        height: Math.min(cap, gapTop),
      },
      {
        role: "cap",
        side: "bottom",
        x: 0,
        y: gapBottom,
        width,
        height: Math.min(cap, groundY - gapBottom),
      },
      {
        role: "shaft",
        side: "bottom",
        x: inset,
        y: gapBottom + cap,
        width: width - 2 * inset,
        height: Math.max(groundY - gapBottom - cap, 0),
      },
    ];
  }
  const trunkX = (width - SHAPES.palmTrunkWidth) / 2;
  const crown = SHAPES.palmCrownHeight;
  return [
    {
      role: "trunk",
      side: "top",
      x: trunkX,
      y: 0,
      width: SHAPES.palmTrunkWidth,
      height: Math.max(gapTop - crown, 0),
    },
    {
      role: "crown",
      side: "top",
      x: 0,
      y: Math.max(gapTop - crown, 0),
      width,
      height: Math.min(crown, gapTop),
    },
    {
      role: "crown",
      side: "bottom",
      x: 0,
      y: gapBottom,
      width,
      height: Math.min(crown, groundY - gapBottom),
    },
    {
      role: "trunk",
      side: "bottom",
      x: trunkX,
      y: gapBottom + crown,
      width: SHAPES.palmTrunkWidth,
      height: Math.max(groundY - gapBottom - crown, 0),
    },
  ];
}
