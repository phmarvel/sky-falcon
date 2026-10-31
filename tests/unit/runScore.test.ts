import { describe, expect, it } from "vitest";
import { scoreOf } from "../../src/game/score/runScore";
import { createFalcon } from "../../src/game/falcon/falconPhysics";
import { createRun } from "../../src/game/run/runState";

describe("scoreOf", () => {
  it("is 0 for a new run", () => {
    expect(
      scoreOf(createRun(createFalcon(), { top: 0, groundY: 749 }, 1)),
    ).toBe(0);
  });
  it("is the number of obstacles passed", () => {
    expect(scoreOf({ passed: 3 })).toBe(3);
  });
});
