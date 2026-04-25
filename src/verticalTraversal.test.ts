import { describe, expect, it } from "vitest";
import { createRuntimeLevel, type LayeredLevelDefinition } from "./levelRuntime";
import { resolveHorizontalTraversal, resolveVerticalTraversal } from "./verticalTraversal";

describe("resolveHorizontalTraversal", () => {
  it("plans a hole shaft as enter-then-drop segments", () => {
    const def: LayeredLevelDefinition = {
      id: "hole-plan",
      layers: [
        [
          [1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1],
          [1, 0, 0, 0, 1],
          [1, 0, 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
        [
          [1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1],
          [1, 0, "hole", 0, 1],
          [1, 0, 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
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
    const level = createRuntimeLevel(def);
    const plan = resolveHorizontalTraversal(level, { x: 2, z: 1, layer: 2 }, 0, 1, 0.4);
    expect(plan).not.toBeNull();
    expect(plan?.destination).toEqual({ x: 2, z: 2, layer: 0 });
    expect(plan?.segments.length).toBeGreaterThanOrEqual(2);
  });
});

describe("resolveVerticalTraversal", () => {
  it("moves between stacked ladders on the current x/z cell", () => {
    const def: LayeredLevelDefinition = {
      id: "ladder-plan",
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
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 1, z: 1, layer: 1 },
    };
    const level = createRuntimeLevel(def);
    expect(resolveVerticalTraversal(level, { x: 1, z: 1, layer: 0 }, 1, 0.4)).toEqual({
      destination: { x: 1, z: 1, layer: 1 },
      seam: null,
      segments: [{ target: { x: 1, z: 1, layer: 1 }, duration: 0.43200000000000005, visualCell: { x: 1, z: 1, layer: 1 } }],
    });
  });

  it("returns null when the player is not standing on a ladder", () => {
    const def: LayeredLevelDefinition = {
      id: "not-on-ladder",
      layers: [
        [
          [1, 1, 1],
          [1, 0, 1],
          [1, 1, 1],
        ],
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
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 1, z: 1, layer: 2 },
    };
    const level = createRuntimeLevel(def);

    expect(resolveVerticalTraversal(level, { x: 1, z: 1, layer: 0 }, 1, 0.4)).toBeNull();
  });

  it("returns null when the adjacent layer does not stack a ladder", () => {
    const def: LayeredLevelDefinition = {
      id: "broken-stack",
      layers: [
        [
          [1, 1, 1, 1, 1],
          [1, "ladder", 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
        [
          [1, 1, 1, 1, 1],
          [1, "ladder", 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
        [
          [1, 1, 1, 1, 1],
          [1, 0, 0, 0, 1],
          [1, 1, 1, 1, 1],
        ],
      ],
      start: { x: 2, z: 1, layer: 1 },
      finish: { x: 3, z: 1, layer: 2 },
    };
    const level = createRuntimeLevel(def);

    expect(resolveVerticalTraversal(level, { x: 1, z: 1, layer: 1 }, 1, 0.4)).toBeNull();
  });

  it("returns null when climbing above the top or below the bottom ladder layer", () => {
    const def: LayeredLevelDefinition = {
      id: "shaft-bounds",
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
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 1, z: 1, layer: 1 },
    };
    const level = createRuntimeLevel(def);

    expect(resolveVerticalTraversal(level, { x: 1, z: 1, layer: 1 }, 1, 0.4)).toBeNull();
    expect(resolveVerticalTraversal(level, { x: 1, z: 1, layer: 0 }, -1, 0.4)).toBeNull();
  });

  it("uses the destination layer geometry after climbing", () => {
    const def: LayeredLevelDefinition = {
      id: "climb-then-collide",
      layers: [
        [
          [1, 1, 1, 1],
          [1, "ladder", 0, 1],
          [1, 1, 1, 1],
        ],
        [
          [1, 1, 1, 1],
          [1, "ladder", 1, 1],
          [1, 1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 0 },
      finish: { x: 1, z: 1, layer: 1 },
    };
    const level = createRuntimeLevel(def);
    const climb = resolveVerticalTraversal(level, { x: 1, z: 1, layer: 0 }, 1, 0.4);

    expect(climb?.destination).toEqual({ x: 1, z: 1, layer: 1 });
    expect(resolveHorizontalTraversal(level, climb!.destination, 1, 0, 0.4)).toBeNull();
  });

  it("uses the landing layer geometry after falling through a hole", () => {
    const def: LayeredLevelDefinition = {
      id: "fall-then-collide",
      layers: [
        [
          [1, 1, 1, 1, 1],
          [1, 0, 0, 1, 1],
          [1, 1, 1, 1, 1],
        ],
        [
          [1, 1, 1, 1, 1],
          [1, 0, "hole", 0, 1],
          [1, 1, 1, 1, 1],
        ],
      ],
      start: { x: 1, z: 1, layer: 1 },
      finish: { x: 1, z: 1, layer: 0 },
    };
    const level = createRuntimeLevel(def);
    const fall = resolveHorizontalTraversal(level, { x: 1, z: 1, layer: 1 }, 1, 0, 0.4);

    expect(fall?.destination).toEqual({ x: 2, z: 1, layer: 0 });
    expect(resolveHorizontalTraversal(level, fall!.destination, 1, 0, 0.4)).toBeNull();
  });
});
