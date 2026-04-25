import { describe, expect, it } from "vitest";
import { createRuntimeLevel, getTileAt } from "../levelRuntime";
import {
  ACTIVE_LEVEL,
  CAMPAIGN_LEVEL_DEFINITIONS,
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
} from "./levelDefinitions";

describe("campaign level definitions", () => {
  it("ships four authored levels with level 1 active by default", () => {
    expect(CAMPAIGN_LEVEL_DEFINITIONS).toHaveLength(4);
    expect(ACTIVE_LEVEL).toBe(LEVEL_1);
  });

  it("keeps the first two levels in the legacy single-layer format", () => {
    expect("maze" in LEVEL_1).toBe(true);
    expect("maze" in LEVEL_2).toBe(true);
    expect("layers" in LEVEL_3).toBe(true);
    expect("layers" in LEVEL_4).toBe(true);
  });

  it("parses layered authored levels into runtime levels with traversal tiles", () => {
    const runtimeLevel = createRuntimeLevel(LEVEL_3);

    expect(runtimeLevel.layerCount).toBe(2);
    expect(runtimeLevel.start).toEqual({ x: 1, z: 1, layer: 0 });
    expect(runtimeLevel.finish).toEqual({ x: 9, z: 9, layer: 1 });
    expect(getTileAt(runtimeLevel, 5, 1, 0)).toBe("ladder");
    expect(getTileAt(runtimeLevel, 5, 5, 1)).toBe("hole");
  });

  it("keeps legacy single-layer authored levels backward compatible", () => {
    const runtimeLevel = createRuntimeLevel(LEVEL_1);

    expect(runtimeLevel.layerCount).toBe(1);
    expect(runtimeLevel.layers).toHaveLength(1);
    expect(runtimeLevel.start).toEqual({ x: 1, z: 1, layer: 0 });
    expect(runtimeLevel.finish).toEqual({ x: 9, z: 9, layer: 0 });
    expect(getTileAt(runtimeLevel, 1, 1, 0)).toBe(0);
  });
});
