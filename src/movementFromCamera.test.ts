import { describe, expect, it } from "vitest";
import type { Direction } from "./MazeGame";
import { MAZE_LAYOUT, START_CELL, canMoveToCell } from "./mazeLayout";
import { intentMappingTable, resolveIntentToGridDelta } from "./movementFromCamera";

const CARDINAL_ROTATIONS = [
  {
    label: "0deg",
    yaw: 0,
    expectedMapping: {
      forward: "forward",
      backward: "backward",
      left: "left",
      right: "right",
    } satisfies Record<Direction, Direction>,
    openIntent: "right" as const,
    blockedIntent: "forward" as const,
    openTarget: { x: 2, z: 1 },
  },
  {
    label: "90deg",
    yaw: Math.PI / 2,
    expectedMapping: {
      forward: "left",
      backward: "right",
      left: "backward",
      right: "forward",
    } satisfies Record<Direction, Direction>,
    openIntent: "left" as const,
    blockedIntent: "forward" as const,
    openTarget: { x: 1, z: 2 },
  },
  {
    label: "180deg",
    yaw: Math.PI,
    expectedMapping: {
      forward: "backward",
      backward: "forward",
      left: "right",
      right: "left",
    } satisfies Record<Direction, Direction>,
    openIntent: "forward" as const,
    blockedIntent: "backward" as const,
    openTarget: { x: 1, z: 2 },
  },
  {
    label: "270deg",
    yaw: -Math.PI / 2,
    expectedMapping: {
      forward: "right",
      backward: "left",
      left: "forward",
      right: "backward",
    } satisfies Record<Direction, Direction>,
    openIntent: "forward" as const,
    blockedIntent: "backward" as const,
    openTarget: { x: 2, z: 1 },
  },
] as const;

function attemptMove(cameraYaw: number, intent: Direction) {
  const movement = resolveIntentToGridDelta(cameraYaw, intent, "continuous");
  const next = {
    x: START_CELL.x + movement.dx,
    z: START_CELL.z + movement.dz,
  };

  return canMoveToCell(next.x, next.z, MAZE_LAYOUT) ? next : START_CELL;
}

describe("orientation-aware movement", () => {
  it.each(CARDINAL_ROTATIONS)("maps intents at $label", ({ yaw, expectedMapping }) => {
    expect(intentMappingTable(yaw, "continuous")).toEqual(expectedMapping);
  });

  it.each(CARDINAL_ROTATIONS)("allows open-cell movement at $label", ({ yaw, openIntent, openTarget }) => {
    expect(attemptMove(yaw, openIntent)).toEqual(openTarget);
  });

  it.each(CARDINAL_ROTATIONS)("blocks wall collisions at $label", ({ yaw, blockedIntent }) => {
    expect(attemptMove(yaw, blockedIntent)).toEqual(START_CELL);
  });

  it("keeps the 180deg flipped-view case intuitive", () => {
    expect(attemptMove(Math.PI, "forward")).toEqual({ x: 1, z: 2 });
    expect(attemptMove(Math.PI, "backward")).toEqual(START_CELL);
  });

  const defaultGameYaw = Math.atan2(10, 11);

  it("matches MazeGame default orbit yaw mapping (continuous)", () => {
    expect(intentMappingTable(defaultGameYaw, "continuous")).toEqual({
      forward: "forward",
      backward: "backward",
      left: "left",
      right: "right",
    });
  });

  it("snap90 stabilizes mapping near diagonal yaw", () => {
    const yaw = Math.PI / 4 + 0.02;
    const snapped = intentMappingTable(yaw, "snap90");
    expect(snapped).toEqual(intentMappingTable(Math.PI / 2, "snap90"));
  });

  it("documents: camera pitch is not inputs to grid mapping (view-down / birdseye)", () => {
    // Movement uses cameraYaw only in MazeGame + resolveIntentToGridDelta; pitch affects framing only.
    expect(resolveIntentToGridDelta(0, "forward", "continuous")).toEqual({ dx: 0, dz: -1 });
    expect(resolveIntentToGridDelta(Math.PI, "forward", "continuous")).toEqual({ dx: 0, dz: 1 });
  });
});
