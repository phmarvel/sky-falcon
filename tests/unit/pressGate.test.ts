import { describe, expect, it } from "vitest";
import { createPressGate } from "../../src/game/falcon/pressGate";

describe("createPressGate", () => {
  it("counts a held key once, including auto-repeat", () => {
    const gate = createPressGate();
    expect(gate.down("SPACE")).toBe(true);
    expect(gate.down("SPACE", true)).toBe(false);
    expect(gate.down("SPACE")).toBe(false);
    expect(gate.isDown("SPACE")).toBe(true);
  });

  it("counts again after the key is released", () => {
    const gate = createPressGate();
    gate.down("SPACE");
    gate.up("SPACE");
    expect(gate.isDown("SPACE")).toBe(false);
    expect(gate.down("SPACE")).toBe(true);
  });

  it("ignores a repeat that arrives without a first press", () => {
    const gate = createPressGate();
    expect(gate.down("SPACE", true)).toBe(false);
    gate.up("SPACE");
    expect(gate.down("SPACE")).toBe(true);
  });

  it("keeps keys apart", () => {
    const gate = createPressGate();
    expect(gate.down("SPACE")).toBe(true);
    expect(gate.down("ENTER")).toBe(true);
  });
});
