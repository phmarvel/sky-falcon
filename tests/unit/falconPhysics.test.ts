import { describe, expect, it } from "vitest";
import {
  FALCON,
  MAX_FRAME_MS,
  MAX_TILT,
  MIN_TILT,
  STEP_SECONDS,
  advanceFalcon,
  createFalcon,
  type FalconState,
  falconTilt,
  flap,
  stepFalcon,
} from "../../src/game/falcon/falconPhysics";

const bounds = { top: 0, groundY: 749 };

/** A falcon already flying, at rest at `y`. */
function flying(y: number = FALCON.startY, vy = 0): FalconState {
  return { ...createFalcon(y), phase: "flying", vy };
}

function run(state: FalconState, steps: number): FalconState[] {
  const out: FalconState[] = [];
  let s = state;
  for (let i = 0; i < steps; i++) {
    s = stepFalcon(s, STEP_SECONDS, bounds);
    out.push(s);
  }
  return out;
}

describe("createFalcon and the first flap", () => {
  it("waits in the ready phase without moving", () => {
    const ready = createFalcon();
    expect(ready.phase).toBe("ready");
    expect(stepFalcon(ready, 0.5, bounds)).toEqual(ready);
    expect(advanceFalcon(ready, 1000, bounds)).toEqual(ready);
  });

  it("starts the run on the first flap with an upward speed", () => {
    const s = flap(createFalcon());
    expect(s.phase).toBe("flying");
    expect(s.vy).toBeLessThan(0);
    expect(s.flaps).toBe(1);
  });
});

describe("gravity", () => {
  it("falls faster and faster when the player does nothing", () => {
    const states = run(flying(), 30);
    for (let i = 1; i < states.length; i++) {
      expect(states[i]!.vy).toBeGreaterThan(states[i - 1]!.vy);
      const fallen = states[i]!.y - states[i - 1]!.y;
      const before = i > 1 ? states[i - 1]!.y - states[i - 2]!.y : 0;
      expect(fallen).toBeGreaterThan(before);
    }
  });

  it("never falls faster than the cap", () => {
    const states = run(flying(-100000), 2000);
    expect(Math.max(...states.map((s) => s.vy))).toBeLessThanOrEqual(
      FALCON.maxFallSpeed,
    );
  });
});

describe("flapping", () => {
  it("turns a fall into a climb", () => {
    const falling = run(flying(), 20).at(-1)!;
    expect(falling.vy).toBeGreaterThan(0);
    const flapped = flap(falling);
    expect(flapped.vy).toBe(FALCON.flapVelocity);
    expect(flapped.flaps).toBe(falling.flaps + 1);
    const after = run(flapped, 10).at(-1)!;
    expect(after.y).toBeLessThan(falling.y);
  });

  it("keeps the falcon inside the top of the screen however much it flaps", () => {
    let s = flying(FALCON.radius + 40);
    let minY = Infinity;
    for (let i = 0; i < 200; i++) {
      if (i % 4 === 0) s = flap(s);
      s = stepFalcon(s, STEP_SECONDS, bounds);
      minY = Math.min(minY, s.y);
      if (s.y === bounds.top + FALCON.radius)
        expect(s.vy).toBeGreaterThanOrEqual(0);
    }
    expect(minY).toBe(bounds.top + FALCON.radius);
    expect(s.phase).toBe("flying");
  });
});

describe("the ground", () => {
  const landed = () => {
    let s = flying();
    for (let i = 0; i < 2000 && s.phase === "flying"; i++)
      s = stepFalcon(s, STEP_SECONDS, bounds);
    return s;
  };

  it("ends the run on the ground", () => {
    const s = landed();
    expect(s.phase).toBe("down");
    expect(s.y).toBe(bounds.groundY - FALCON.radius);
    expect(s.vy).toBe(0);
  });

  it("ignores flaps and time once down", () => {
    const s = landed();
    expect(flap(s)).toBe(s);
    expect(stepFalcon(s, 1, bounds)).toBe(s);
    expect(advanceFalcon(s, 1000, bounds)).toBe(s);
  });
});

describe("advanceFalcon", () => {
  it("gives the same motion for small and large frames", () => {
    let small = flying();
    let large = flying();
    for (let i = 0; i < 60; i++)
      small = advanceFalcon(small, 1000 / 60, bounds);
    for (let i = 0; i < 10; i++) large = advanceFalcon(large, 100, bounds);
    // Both covered one second; the falcon has landed in both.
    expect(small.phase).toBe(large.phase);
    expect(small.y).toBeCloseTo(large.y, 1);

    let a = flying();
    let b = flying();
    for (let i = 0; i < 12; i++) a = advanceFalcon(a, 1000 / 60, bounds);
    for (let i = 0; i < 2; i++) b = advanceFalcon(b, 100, bounds);
    expect(a.y).toBeCloseTo(b.y, 0);
    expect(a.vy).toBeCloseTo(b.vy, 0);
  });

  it("caps a very long frame so the falcon cannot jump through the ground", () => {
    const capped = advanceFalcon(flying(), 5000, bounds);
    const once = advanceFalcon(flying(), MAX_FRAME_MS, bounds);
    expect(capped.y).toBeCloseTo(once.y, 6);
    expect(capped.phase).toBe("flying");
  });
});

describe("game time", () => {
  it("counts the time flown, not the time between frames", () => {
    const s = advanceFalcon(flying(), 5000, bounds);
    expect(s.time).toBeCloseTo(MAX_FRAME_MS / 1000, 6);
    expect(createFalcon().time).toBe(0);
    expect(run(flying(), 12).at(-1)!.time).toBeCloseTo(12 * STEP_SECONDS, 9);
  });
});

describe("falconTilt", () => {
  it("points up when climbing, down when diving, within limits", () => {
    expect(falconTilt(FALCON.flapVelocity, "flying")).toBeCloseTo(MIN_TILT);
    expect(falconTilt(FALCON.maxFallSpeed, "flying")).toBeCloseTo(MAX_TILT);
    expect(falconTilt(0, "flying")).toBe(0);
    expect(falconTilt(0, "ready")).toBe(0);
    for (const vy of [-5000, -300, 0, 300, 5000]) {
      const t = falconTilt(vy, "flying");
      expect(t).toBeGreaterThanOrEqual(MIN_TILT);
      expect(t).toBeLessThanOrEqual(MAX_TILT);
    }
  });
});
