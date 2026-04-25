import { DEFAULT_ENEMY_PACING, PLAYER_MOVE_SECONDS } from "./enemyDesign";

export type Tile = 0 | 1 | "ladder" | "hole";

export type MazeLayer = readonly (readonly Tile[])[];

export interface LevelCoordinateInput {
  x: number;
  z: number;
  layer?: number;
}

export interface LegacyLevelDefinition {
  id?: string;
  title?: string;
  maze: MazeLayer;
  start: LevelCoordinateInput;
  finish: LevelCoordinateInput;
  enemy?: EnemyDefinitionInput;
}

export interface LayeredLevelDefinition {
  id?: string;
  title?: string;
  layers: readonly MazeLayer[];
  start: LevelCoordinateInput;
  finish: LevelCoordinateInput;
  enemy?: EnemyDefinitionInput;
}

export type LevelDefinition = LegacyLevelDefinition | LayeredLevelDefinition;

export interface LevelCoordinate {
  x: number;
  z: number;
  layer: number;
}

export interface EnemyDefinitionInput {
  path: readonly LevelCoordinateInput[];
  secondsPerCell?: number;
  initialDelayMs?: number;
  pauseMsBetweenSteps?: number;
}

export interface EnemyRuntimeDefinition {
  path: LevelCoordinate[];
  secondsPerCell: number;
  initialDelayMs: number;
  pauseMsBetweenSteps: number;
}

export interface RuntimeLevel {
  id: string;
  title?: string;
  layers: Tile[][][];
  width: number;
  depth: number;
  layerCount: number;
  start: LevelCoordinate;
  finish: LevelCoordinate;
  enemy: EnemyRuntimeDefinition | null;
}

export interface TileProbe extends LevelCoordinate {
  tile: Tile | undefined;
}

export function createRuntimeLevel(definition: LevelDefinition): RuntimeLevel {
  const layers = normalizeLayers(definition);
  const depth = layers[0]?.length ?? 0;
  const width = layers[0]?.[0]?.length ?? 0;
  const runtime: RuntimeLevel = {
    id: definition.id ?? "level-1",
    title: definition.title,
    layers,
    width,
    depth,
    layerCount: layers.length,
    start: { x: 0, z: 0, layer: 0 },
    finish: { x: 0, z: 0, layer: 0 },
    enemy: null,
  };

  runtime.start = normalizeCoordinate(runtime, definition.start, "start");
  runtime.finish = normalizeCoordinate(runtime, definition.finish, "finish");
  runtime.enemy = normalizeEnemy(runtime, definition.enemy ?? null);
  validateLevelTraversalSemantics(runtime);
  return runtime;
}

export function getTileAt(level: RuntimeLevel, x: number, z: number, layer = 0): Tile | undefined {
  return level.layers[layer]?.[z]?.[x];
}

export function isWalkableTile(level: RuntimeLevel, x: number, z: number, layer = 0): boolean {
  const tile = getTileAt(level, x, z, layer);
  return tile !== undefined && tile !== 1;
}

/** Floor or ladder only — tiles you may bind spawn, exit, or enemy anchors to (never holes). */
export function isAnchorTile(tile: Tile | undefined): boolean {
  return tile === 0 || tile === "ladder";
}

/** Tiles the player can stand on after a fall (floor or ladder; not hole or wall). */
export function isStableTile(tile: Tile | undefined): boolean {
  return tile === 0 || tile === "ladder";
}

/**
 * Resolves the rest position after entering `coord` when that cell (or stacked holes below it)
 * is a hole shaft: same (x, z), decreasing layer until a non-hole surface is reached.
 * Returns null if the shaft exits the world or lands on a wall.
 */
export function resolveHoleLanding(level: RuntimeLevel, coord: LevelCoordinate): LevelCoordinate | null {
  let { x, z, layer } = coord;
  while (getTileAt(level, x, z, layer) === "hole") {
    layer -= 1;
    if (layer < 0) return null;
  }

  const surface = getTileAt(level, x, z, layer);
  if (!isStableTile(surface)) return null;
  return { x, z, layer };
}

/**
 * Authoring-time checks so ladders are never decorative dead-ends and every hole has a defined landing.
 * Call after `RuntimeLevel` geometry is normalized.
 */
export function validateLevelTraversalSemantics(level: RuntimeLevel): void {
  for (let layer = 0; layer < level.layerCount; layer += 1) {
    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const tile = getTileAt(level, x, z, layer);
        if (tile === "hole") {
          const landing = resolveHoleLanding(level, { x, z, layer });
          if (!landing) {
            throw new Error(`Hole at (${x}, ${z}, layer ${layer}) has no safe landing below.`);
          }
        }

        if (tile === "ladder") {
          const above = getTileAbove(level, { x, z, layer });
          const below = getTileBelow(level, { x, z, layer });
          const pairedUp = above?.tile === "ladder";
          const pairedDown = below?.tile === "ladder";
          if (!pairedUp && !pairedDown) {
            throw new Error(`Ladder at (${x}, ${z}, layer ${layer}) must stack with another ladder on layer ${layer + 1} or ${layer - 1}.`);
          }
        }
      }
    }
  }
}

export function getTileAbove(level: RuntimeLevel, position: LevelCoordinate): TileProbe | null {
  return probeVerticalTile(level, position, 1);
}

export function getTileBelow(level: RuntimeLevel, position: LevelCoordinate): TileProbe | null {
  return probeVerticalTile(level, position, -1);
}

function normalizeLayers(definition: LevelDefinition): Tile[][][] {
  const sourceLayers = "layers" in definition ? definition.layers : [definition.maze];
  if (sourceLayers.length === 0) {
    throw new Error("Level must contain at least one layer.");
  }

  let expectedDepth = -1;
  let expectedWidth = -1;

  return sourceLayers.map((layer, layerIndex) => {
    if (layer.length === 0) {
      throw new Error(`Layer ${layerIndex} must contain at least one row.`);
    }

    const cloned = layer.map((row, rowIndex) => {
      if (row.length === 0) {
        throw new Error(`Layer ${layerIndex}, row ${rowIndex} must contain at least one cell.`);
      }

      return row.map((cell, cellIndex) => {
        if (cell !== 0 && cell !== 1 && cell !== "ladder" && cell !== "hole") {
          throw new Error(`Unsupported tile value ${String(cell)} at layer ${layerIndex}, row ${rowIndex}, col ${cellIndex}.`);
        }
        return cell;
      });
    });

    const layerDepth = cloned.length;
    const layerWidth = cloned[0].length;
    cloned.forEach((row, rowIndex) => {
      if (row.length !== layerWidth) {
        throw new Error(`Layer ${layerIndex} is not rectangular: row ${rowIndex} has width ${row.length}, expected ${layerWidth}.`);
      }
    });

    if (expectedDepth === -1) {
      expectedDepth = layerDepth;
      expectedWidth = layerWidth;
    } else if (layerDepth !== expectedDepth || layerWidth !== expectedWidth) {
      throw new Error(
        `Layer ${layerIndex} dimensions ${layerWidth}x${layerDepth} do not match expected ${expectedWidth}x${expectedDepth}.`,
      );
    }

    return cloned;
  });
}

function normalizeCoordinate(
  level: Pick<RuntimeLevel, "width" | "depth" | "layerCount"> & { layers: Tile[][][] },
  value: LevelCoordinateInput,
  label: string,
): LevelCoordinate {
  const layer = value.layer ?? 0;
  if (!Number.isInteger(value.x) || !Number.isInteger(value.z) || !Number.isInteger(layer)) {
    throw new Error(`Level ${label} must use integer coordinates.`);
  }

  if (layer < 0 || layer >= level.layerCount) {
    throw new Error(`Level ${label} layer ${layer} is outside 0-${level.layerCount - 1}.`);
  }

  if (value.x < 0 || value.x >= level.width || value.z < 0 || value.z >= level.depth) {
    throw new Error(`Level ${label} (${value.x}, ${value.z}, layer ${layer}) is out of bounds.`);
  }

  const anchorTile = getTileAt(level as RuntimeLevel, value.x, value.z, layer);
  if (!isAnchorTile(anchorTile)) {
    throw new Error(
      `Level ${label} (${value.x}, ${value.z}, layer ${layer}) must be floor or ladder — holes and walls are not allowed.`,
    );
  }

  return { x: value.x, z: value.z, layer };
}

function normalizeEnemy(level: RuntimeLevel, enemy: EnemyDefinitionInput | null): EnemyRuntimeDefinition | null {
  if (!enemy) return null;
  if (enemy.path.length === 0) {
    throw new Error("Enemy definition must include at least one waypoint.");
  }

  const normalizedPath = enemy.path.map((cell, index) =>
    normalizeCoordinate(level, cell, `enemy waypoint ${index}`),
  );

  if ((enemy.secondsPerCell ?? DEFAULT_ENEMY_PACING.secondsPerCell) <= PLAYER_MOVE_SECONDS) {
    throw new Error("Enemy speed must stay slower than player movement.");
  }

  const runtimeEnemy = {
    path: normalizedPath,
    secondsPerCell: enemy.secondsPerCell ?? DEFAULT_ENEMY_PACING.secondsPerCell,
    initialDelayMs: enemy.initialDelayMs ?? DEFAULT_ENEMY_PACING.initialDelayMs,
    pauseMsBetweenSteps: enemy.pauseMsBetweenSteps ?? DEFAULT_ENEMY_PACING.pauseMsBetweenSteps,
  } satisfies EnemyRuntimeDefinition;

  normalizedPath.forEach((cell, index) => {
    if (
      (cell.x === level.start.x && cell.z === level.start.z && cell.layer === level.start.layer) ||
      (cell.x === level.finish.x && cell.z === level.finish.z && cell.layer === level.finish.layer)
    ) {
      throw new Error(`Enemy waypoint ${index} cannot overlap the level start or finish.`);
    }

    if (index === 0) return;

    const previous = normalizedPath[index - 1];
    if (cell.layer !== previous.layer) {
      throw new Error(`Enemy waypoint ${index} cannot jump between layers.`);
    }

    const manhattanDistance = Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z);
    if (manhattanDistance !== 1) {
      throw new Error(`Enemy waypoint ${index} must move one tile at a time.`);
    }
  });

  return runtimeEnemy;
}

function probeVerticalTile(level: RuntimeLevel, position: LevelCoordinate, layerOffset: 1 | -1): TileProbe | null {
  const nextLayer = position.layer + layerOffset;
  if (nextLayer < 0 || nextLayer >= level.layerCount) return null;

  return {
    x: position.x,
    z: position.z,
    layer: nextLayer,
    tile: getTileAt(level, position.x, position.z, nextLayer),
  };
}
