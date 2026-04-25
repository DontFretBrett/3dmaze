import { CUBE_FACES, type CubeFace } from "./cubeTopology";
import { DEFAULT_ENEMY_PACING, PLAYER_MOVE_SECONDS } from "./enemyDesign";

export type { CubeFace } from "./cubeTopology";

export type Tile = 0 | 1 | "ladder" | "hole";
export type LevelTopology = "stack" | "cube";

export type MazeLayer = readonly (readonly Tile[])[];
export type CubeLayerDefinition = Record<CubeFace, MazeLayer>;
export type CubeRuntimeLayer = Record<CubeFace, Tile[][]>;

export interface LevelCoordinateInput {
  x: number;
  z: number;
  layer?: number;
  face?: CubeFace;
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

export interface CubeLevelDefinition {
  id?: string;
  title?: string;
  topology: "cube";
  cubeLayers: readonly CubeLayerDefinition[];
  start: LevelCoordinateInput;
  finish: LevelCoordinateInput;
  enemy?: EnemyDefinitionInput;
}

export type LevelDefinition = LegacyLevelDefinition | LayeredLevelDefinition | CubeLevelDefinition;

export interface LevelCoordinate {
  x: number;
  z: number;
  layer: number;
  face?: CubeFace;
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
  topology: LevelTopology;
  layers: Tile[][][];
  cubeLayers: CubeRuntimeLayer[];
  width: number;
  depth: number;
  layerCount: number;
  faceCount: number;
  start: LevelCoordinate;
  finish: LevelCoordinate;
  enemy: EnemyRuntimeDefinition | null;
}

export interface TileProbe extends LevelCoordinate {
  tile: Tile | undefined;
}

function isCubeLevelDefinition(definition: LevelDefinition): definition is CubeLevelDefinition {
  return "topology" in definition && definition.topology === "cube";
}

export function createRuntimeLevel(definition: LevelDefinition): RuntimeLevel {
  const topology: LevelTopology = isCubeLevelDefinition(definition) ? "cube" : "stack";
  const stackLayers = topology === "stack" ? normalizeStackLayers(definition as LegacyLevelDefinition | LayeredLevelDefinition) : [];
  const cubeLayers = topology === "cube" ? normalizeCubeLayers(definition as CubeLevelDefinition) : [];
  const width = topology === "cube" ? cubeLayers[0]!.north[0]!.length : stackLayers[0]?.[0]?.length ?? 0;
  const depth = topology === "cube" ? cubeLayers[0]!.north.length : stackLayers[0]?.length ?? 0;
  const layerCount = topology === "cube" ? cubeLayers.length : stackLayers.length;

  const runtime: RuntimeLevel = {
    id: definition.id ?? "level-1",
    title: definition.title,
    topology,
    layers: stackLayers,
    cubeLayers,
    width,
    depth,
    layerCount,
    faceCount: topology === "cube" ? CUBE_FACES.length : 1,
    start: { x: 0, z: 0, layer: 0, ...(topology === "cube" ? { face: "north" as const } : {}) },
    finish: { x: 0, z: 0, layer: 0, ...(topology === "cube" ? { face: "north" as const } : {}) },
    enemy: null,
  };

  runtime.start = normalizeCoordinate(runtime, definition.start, "start");
  runtime.finish = normalizeCoordinate(runtime, definition.finish, "finish");
  runtime.enemy = normalizeEnemy(runtime, definition.enemy ?? null);
  validateLevelTraversalSemantics(runtime);
  return runtime;
}

export function getTileAt(
  level: RuntimeLevel,
  x: number,
  z: number,
  layer = 0,
  face: CubeFace | undefined = undefined,
): Tile | undefined {
  if (level.topology === "cube") {
    const resolvedFace = face;
    if (!resolvedFace) {
      throw new Error("Cube levels require a face when probing tiles.");
    }
    return level.cubeLayers[layer]?.[resolvedFace]?.[z]?.[x];
  }

  return level.layers[layer]?.[z]?.[x];
}

export function isWalkableTile(
  level: RuntimeLevel,
  x: number,
  z: number,
  layer = 0,
  face: CubeFace | undefined = undefined,
): boolean {
  const tile = getTileAt(level, x, z, layer, face);
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
 * is a hole shaft: same x/z/face, decreasing layer until a non-hole surface is reached.
 * Returns null if the shaft exits the world or lands on a wall.
 */
export function resolveHoleLanding(level: RuntimeLevel, coord: LevelCoordinate): LevelCoordinate | null {
  const { x, z, face } = coord;
  let layer = coord.layer;

  while (getTileAt(level, x, z, layer, face) === "hole") {
    layer -= 1;
    if (layer < 0) return null;
  }

  const surface = getTileAt(level, x, z, layer, face);
  if (!isStableTile(surface)) return null;
  return face ? { x, z, layer, face } : { x, z, layer };
}

/**
 * Authoring-time checks so ladders are never decorative dead-ends and every hole has a defined landing.
  * Call after `RuntimeLevel` geometry is normalized.
 */
export function validateLevelTraversalSemantics(level: RuntimeLevel): void {
  forEachCoordinate(level, (coord) => {
    const tile = getTileAt(level, coord.x, coord.z, coord.layer, coord.face);
    if (tile === "hole") {
      const landing = resolveHoleLanding(level, coord);
      if (!landing) {
        throw new Error(`Hole at (${coord.x}, ${coord.z}, layer ${coord.layer}${formatFaceSuffix(coord.face)}) has no safe landing below.`);
      }
    }

    if (tile === "ladder") {
      const above = getTileAbove(level, coord);
      const below = getTileBelow(level, coord);
      const pairedUp = above?.tile === "ladder";
      const pairedDown = below?.tile === "ladder";
      if (!pairedUp && !pairedDown) {
        throw new Error(
          `Ladder at (${coord.x}, ${coord.z}, layer ${coord.layer}${formatFaceSuffix(coord.face)}) must stack with another ladder on layer ${coord.layer + 1} or ${coord.layer - 1}.`,
        );
      }
    }
  });
}

export function getTileAbove(level: RuntimeLevel, position: LevelCoordinate): TileProbe | null {
  return probeVerticalTile(level, position, 1);
}

export function getTileBelow(level: RuntimeLevel, position: LevelCoordinate): TileProbe | null {
  return probeVerticalTile(level, position, -1);
}

export function forEachCoordinate(level: RuntimeLevel, visitor: (coord: LevelCoordinate) => void) {
  for (let layer = 0; layer < level.layerCount; layer += 1) {
    if (level.topology === "cube") {
      for (const face of CUBE_FACES) {
        for (let z = 0; z < level.depth; z += 1) {
          for (let x = 0; x < level.width; x += 1) {
            visitor({ x, z, layer, face });
          }
        }
      }
      continue;
    }

    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        visitor({ x, z, layer });
      }
    }
  }
}

function normalizeStackLayers(definition: LegacyLevelDefinition | LayeredLevelDefinition): Tile[][][] {
  const sourceLayers = "layers" in definition ? definition.layers : [definition.maze];
  if (sourceLayers.length === 0) {
    throw new Error("Level must contain at least one layer.");
  }

  let expectedDepth = -1;
  let expectedWidth = -1;

  return sourceLayers.map((layer, layerIndex) => normalizeMazeLayer(layer, layerIndex, () => {
    if (expectedDepth === -1) {
      expectedDepth = layer.length;
      expectedWidth = layer[0]!.length;
      return;
    }

    if (layer.length !== expectedDepth || layer[0]!.length !== expectedWidth) {
      throw new Error(
        `Layer ${layerIndex} dimensions ${layer[0]!.length}x${layer.length} do not match expected ${expectedWidth}x${expectedDepth}.`,
      );
    }
  }));
}

function normalizeCubeLayers(definition: CubeLevelDefinition): CubeRuntimeLayer[] {
  if (definition.cubeLayers.length === 0) {
    throw new Error("Cube level must contain at least one cube layer.");
  }

  let expectedDepth = -1;
  let expectedWidth = -1;

  return definition.cubeLayers.map((cubeLayer, layerIndex) => {
    const normalized = {} as CubeRuntimeLayer;
    for (const face of CUBE_FACES) {
      const faceLayer = cubeLayer[face];
      if (!faceLayer) {
        throw new Error(`Cube layer ${layerIndex} is missing the ${face} face.`);
      }

      normalized[face] = normalizeMazeLayer(faceLayer, layerIndex, () => {
        if (expectedDepth === -1) {
          expectedDepth = faceLayer.length;
          expectedWidth = faceLayer[0]!.length;
          return;
        }

        if (faceLayer.length !== expectedDepth || faceLayer[0]!.length !== expectedWidth) {
          throw new Error(
            `Cube layer ${layerIndex}, face ${face} dimensions ${faceLayer[0]!.length}x${faceLayer.length} do not match expected ${expectedWidth}x${expectedDepth}.`,
          );
        }
      }, face);
    }

    if (expectedWidth !== expectedDepth) {
      throw new Error(`Cube topology requires square faces; received ${expectedWidth}x${expectedDepth}.`);
    }

    return normalized;
  });
}

function normalizeMazeLayer(
  layer: MazeLayer,
  layerIndex: number,
  validateDimensions: () => void,
  face?: CubeFace,
): Tile[][] {
  if (layer.length === 0) {
    throw new Error(`Layer ${layerIndex}${formatFaceSuffix(face)} must contain at least one row.`);
  }

  const cloned = layer.map((row, rowIndex) => {
    if (row.length === 0) {
      throw new Error(`Layer ${layerIndex}${formatFaceSuffix(face)}, row ${rowIndex} must contain at least one cell.`);
    }

    return row.map((cell, cellIndex) => {
      if (cell !== 0 && cell !== 1 && cell !== "ladder" && cell !== "hole") {
        throw new Error(
          `Unsupported tile value ${String(cell)} at layer ${layerIndex}${formatFaceSuffix(face)}, row ${rowIndex}, col ${cellIndex}.`,
        );
      }
      return cell;
    });
  });

  const layerWidth = cloned[0]!.length;
  cloned.forEach((row, rowIndex) => {
    if (row.length !== layerWidth) {
      throw new Error(
        `Layer ${layerIndex}${formatFaceSuffix(face)} is not rectangular: row ${rowIndex} has width ${row.length}, expected ${layerWidth}.`,
      );
    }
  });

  validateDimensions();
  return cloned;
}

function normalizeCoordinate(
  level: Pick<RuntimeLevel, "topology" | "width" | "depth" | "layerCount" | "cubeLayers"> & { layers: Tile[][][] },
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

  if (level.topology === "cube") {
    if (!value.face || !CUBE_FACES.includes(value.face)) {
      throw new Error(`Level ${label} must specify a valid cube face.`);
    }

    const anchorTile = getTileAt(level as RuntimeLevel, value.x, value.z, layer, value.face);
    if (!isAnchorTile(anchorTile)) {
      throw new Error(
        `Level ${label} (${value.x}, ${value.z}, layer ${layer}, face ${value.face}) must be floor or ladder — holes and walls are not allowed.`,
      );
    }

    return { x: value.x, z: value.z, layer, face: value.face };
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
    if (sameCoordinate(cell, level.start) || sameCoordinate(cell, level.finish)) {
      throw new Error(`Enemy waypoint ${index} cannot overlap the level start or finish.`);
    }

    if (index === 0) return;

    const previous = normalizedPath[index - 1]!;
    if (cell.layer !== previous.layer) {
      throw new Error(`Enemy waypoint ${index} cannot jump between layers.`);
    }

    if (cell.face !== previous.face) {
      throw new Error(`Enemy waypoint ${index} cannot jump between cube faces.`);
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

  const face = level.topology === "cube" ? position.face : undefined;
  return {
    x: position.x,
    z: position.z,
    layer: nextLayer,
    ...(face ? { face } : {}),
    tile: getTileAt(level, position.x, position.z, nextLayer, face),
  };
}

function formatFaceSuffix(face: CubeFace | undefined) {
  return face ? `, face ${face}` : "";
}

export function sameCoordinate(left: LevelCoordinate, right: LevelCoordinate) {
  return left.x === right.x && left.z === right.z && left.layer === right.layer && left.face === right.face;
}
