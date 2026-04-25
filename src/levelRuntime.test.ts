import { describe, expect, it } from "vitest";
import {
  createRuntimeLevel,
  isWalkableTile,
  resolveHoleLanding,
  type LayeredLevelDefinition,
} from "./levelRuntime";

describe("resolveHoleLanding", () => {
  it("returns the same coordinate when the cell is not a hole", () => {
    const level = createRuntimeLevel({
      id: "t",
      maze: [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
      ],
      start: { x: 1, z: 1 },
      finish: { x: 3, z: 3 },
    });
    expect(resolveHoleLanding(level, { x: 2, z: 2, layer: 0 })).toEqual({ x: 2, z: 2, layer: 0 });
  });

  it("falls through stacked holes to the first stable deck", () => {
    const def: LayeredLevelDefinition = {
      id: "shaft",
      layers: [
        [
          [1, 1, 1],
          [1, 0, 1],
          [1, 1, 1],
        ],
        [
          [1, 1, 1],
          [1, "hole", 1],
          [1, 1, 1],
        ],
        [
          [1, 1, 1],
          [1, "hole", 1],
          [1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 1, z: 1, layer: 0 },
    };
    const level = createRuntimeLevel(def);
    expect(resolveHoleLanding(level, { x: 1, z: 1, layer: 2 })).toEqual({ x: 1, z: 1, layer: 0 });
  });

  it("treats a ladder below a hole as a valid landing surface", () => {
    const def: LayeredLevelDefinition = {
      id: "hole-to-ladder",
      layers: [
        [
          [1, 1, 1],
          [1, "ladder", 1],
          [1, 1, 1],
        ],
        [
          [1, 1, 1],
          [1, "ladder", 1],
          [1, 1, 1],
        ],
        [
          [1, 1, 1],
          [1, "hole", 1],
          [1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 1, z: 1, layer: 1 },
    };
    const level = createRuntimeLevel(def);

    expect(resolveHoleLanding(level, { x: 1, z: 1, layer: 2 })).toEqual({ x: 1, z: 1, layer: 1 });
  });
});

describe("validateLevelTraversalSemantics", () => {
  it("rejects orphan ladders", () => {
    const bad: LayeredLevelDefinition = {
      id: "bad-ladder",
      layers: [
        [
          [1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1],
          [1, 0, "ladder", 0, 1],
          [1, 0, 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 3, z: 1, layer: 0 },
    };
    expect(() => createRuntimeLevel(bad)).toThrow(/must stack with another ladder/);
  });

  it("rejects holes without a stable landing", () => {
    const bad: LayeredLevelDefinition = {
      id: "bad-hole",
      layers: [
        [
          [1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1],
          [1, 0, "hole", 0, 1],
          [1, 0, 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 3, z: 3, layer: 0 },
    };
    expect(() => createRuntimeLevel(bad)).toThrow(/safe landing/);
  });

  it("rejects bottom-layer holes that fall out of the world", () => {
    const bad: LayeredLevelDefinition = {
      id: "bottom-hole",
      layers: [
        [
          [1, 1, 1, 1, 1],
          [1, 0, "hole", 0, 1],
          [1, 1, 1, 1, 1],
        ],
        [
          [1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 1 },
      finish: { x: 3, z: 1, layer: 1 },
    };

    expect(() => createRuntimeLevel(bad)).toThrow(/Hole at \(2, 1, layer 0\) has no safe landing below\./);
  });

  it("keeps collision checks scoped to each individual layer", () => {
    const level = createRuntimeLevel({
      id: "layer-collision",
      layers: [
        [
          [1, 1, 1],
          [1, 0, 1],
          [1, 1, 1],
        ],
        [
          [1, 1, 1],
          [1, 0, 0],
          [1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 2, z: 1, layer: 1 },
    });

    expect(isWalkableTile(level, 2, 1, 0)).toBe(false);
    expect(isWalkableTile(level, 2, 1, 1)).toBe(true);
  });
});
