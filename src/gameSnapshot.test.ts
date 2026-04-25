import { describe, expect, it } from "vitest";
import { LEVEL_1, LEVEL_3, LEVEL_4 } from "./campaign/levelDefinitions";
import { createInitialGameSnapshot } from "./gameSnapshot";

describe("game snapshot helpers", () => {
  it("seeds a single-floor campaign level with the authored start tile and floor count", () => {
    expect(createInitialGameSnapshot(LEVEL_1, null)).toMatchObject({
      layer: 0,
      layerCount: 1,
      currentTile: "start",
      canClimbUp: false,
      canClimbDown: false,
      bestTime: null,
    });
  });

  it("seeds multi-floor levels from their authored runtime instead of the legacy single-floor fallback", () => {
    expect(createInitialGameSnapshot(LEVEL_3, 42)).toMatchObject({
      layer: 0,
      layerCount: 2,
      currentTile: "start",
      canClimbUp: false,
      canClimbDown: false,
      bestTime: 42,
    });

    expect(createInitialGameSnapshot(LEVEL_4, null)).toMatchObject({
      layer: 0,
      layerCount: 3,
      currentTile: "start",
      canClimbUp: false,
      canClimbDown: false,
    });
  });
});
