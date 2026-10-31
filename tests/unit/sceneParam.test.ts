import { describe, expect, it } from "vitest";
import { pickFirstScene } from "../../src/game/scenes/sceneParam";

describe("pickFirstScene", () => {
  it("shows the start screen by default", () => {
    expect(pickFirstScene("")).toBe("Start");
    expect(pickFirstScene("?scene=start")).toBe("Start");
    expect(pickFirstScene("?scene=nope")).toBe("Start");
  });
  it("goes straight to the run with scene=flight", () => {
    expect(pickFirstScene("?scene=flight")).toBe("Flight");
    expect(pickFirstScene("?x=1&scene=Flight")).toBe("Flight");
  });
});
