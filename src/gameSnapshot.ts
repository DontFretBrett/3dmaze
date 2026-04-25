import { createRuntimeLevel, getTileAt, type LevelCoordinate, type LevelDefinition, type RuntimeLevel } from "./levelRuntime";
import { canClimbBetweenLayers } from "./verticalTraversal";
import type { CurrentTileKind, GameSnapshot } from "./MazeGame";

export function describeCurrentTile(level: RuntimeLevel, cell: LevelCoordinate): CurrentTileKind {
  if (cell.x === level.start.x && cell.z === level.start.z && cell.layer === level.start.layer) {
    return "start";
  }

  if (cell.x === level.finish.x && cell.z === level.finish.z && cell.layer === level.finish.layer) {
    return "exit";
  }

  const tile = getTileAt(level, cell.x, cell.z, cell.layer);
  if (tile === "ladder") return "ladder";
  if (tile === "hole") return "hole";
  return "floor";
}

export function createInitialGameSnapshot(levelDefinition: LevelDefinition, bestTime: number | null): GameSnapshot {
  const runtimeLevel = createRuntimeLevel(levelDefinition);
  return {
    moves: 0,
    time: 0,
    completed: false,
    failed: false,
    bestTime,
    contacts: 0,
    isStunned: false,
    layer: runtimeLevel.start.layer,
    layerCount: runtimeLevel.layerCount,
    currentTile: describeCurrentTile(runtimeLevel, runtimeLevel.start),
    canClimbUp: canClimbBetweenLayers(runtimeLevel, runtimeLevel.start, 1),
    canClimbDown: canClimbBetweenLayers(runtimeLevel, runtimeLevel.start, -1),
  };
}
