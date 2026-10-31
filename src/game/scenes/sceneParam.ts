export type FirstScene = "Start" | "Flight";

/** Which scene opens first: `?scene=flight` goes straight to the run; anything else shows the start screen. */
export function pickFirstScene(search: string): FirstScene {
  const value = new URLSearchParams(search).get("scene");
  return value?.toLowerCase() === "flight" ? "Flight" : "Start";
}
