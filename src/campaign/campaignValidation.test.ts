import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_LEVELS,
  DEFAULT_CAMPAIGN_LEVEL_ID,
  getCampaignLevel,
  getNextCampaignLevelId,
} from "./campaignProgression";
import { CAMPAIGN_LEVEL_DEFINITIONS, LEVEL_3, LEVEL_4 } from "./levelDefinitions";
import {
  createRuntimeLevel,
  getTileAt,
  isWalkableTile,
  resolveHoleLanding,
  type LevelCoordinate,
  type RuntimeLevel,
  type Tile,
} from "../levelRuntime";

function keyOf(cell: LevelCoordinate) {
  return `${cell.layer}:${cell.x}:${cell.z}`;
}

function resolveEntry(level: RuntimeLevel, cell: LevelCoordinate) {
  const landed = resolveHoleLanding(level, cell);
  if (!landed) {
    throw new Error(`Hole shaft at ${keyOf(cell)} has no stable landing.`);
  }
  return landed;
}

function getNeighbors(level: RuntimeLevel, cell: LevelCoordinate) {
  const neighbors: LevelCoordinate[] = [];

  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const next = { x: cell.x + dx, z: cell.z + dz, layer: cell.layer } satisfies LevelCoordinate;
    if (!isWalkableTile(level, next.x, next.z, next.layer)) continue;
    neighbors.push(resolveEntry(level, next));
  }

  if (getTileAt(level, cell.x, cell.z, cell.layer) === "ladder") {
    for (const layerOffset of [-1, 1] as const) {
      const target = { x: cell.x, z: cell.z, layer: cell.layer + layerOffset } satisfies LevelCoordinate;
      if (getTileAt(level, target.x, target.z, target.layer) === "ladder") {
        neighbors.push(target);
      }
    }
  }

  return neighbors;
}

function canReachFinish(level: RuntimeLevel) {
  const frontier: LevelCoordinate[] = [{ ...level.start }];
  const seen = new Set([keyOf(level.start)]);

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;
    if (keyOf(current) === keyOf(level.finish)) {
      return true;
    }

    for (const next of getNeighbors(level, current)) {
      const key = keyOf(next);
      if (seen.has(key)) continue;
      seen.add(key);
      frontier.push(next);
    }
  }

  return false;
}

function getReachableCells(level: RuntimeLevel) {
  const frontier: LevelCoordinate[] = [{ ...level.start }];
  const seen = new Set([keyOf(level.start)]);

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;

    for (const next of getNeighbors(level, current)) {
      const key = keyOf(next);
      if (seen.has(key)) continue;
      seen.add(key);
      frontier.push(next);
    }
  }

  return seen;
}

function getShortestPath(level: RuntimeLevel) {
  const frontier: LevelCoordinate[] = [{ ...level.start }];
  const seen = new Set([keyOf(level.start)]);
  const parentByCell = new Map<string, LevelCoordinate>();

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;
    if (keyOf(current) === keyOf(level.finish)) {
      const path: LevelCoordinate[] = [];
      let cursor: LevelCoordinate | undefined = current;

      while (cursor) {
        path.push(cursor);
        cursor = parentByCell.get(keyOf(cursor));
      }

      return path.reverse();
    }

    for (const next of getNeighbors(level, current)) {
      const key = keyOf(next);
      if (seen.has(key)) continue;
      seen.add(key);
      parentByCell.set(key, current);
      frontier.push(next);
    }
  }

  return [];
}

function countTiles(level: RuntimeLevel, match: Tile) {
  let count = 0;
  for (let layer = 0; layer < level.layerCount; layer += 1) {
    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        if (getTileAt(level, x, z, layer) === match) {
          count += 1;
        }
      }
    }
  }
  return count;
}

describe("campaign validation", () => {
  it("loads every authored level and keeps progression metadata aligned", () => {
    expect(CAMPAIGN_LEVEL_DEFINITIONS).toHaveLength(CAMPAIGN_LEVELS.length);

    const authoredIds = new Set<string>();
    const authoredTitles = new Set<string>();

    CAMPAIGN_LEVELS.forEach((campaignLevel, index) => {
      const definition = CAMPAIGN_LEVEL_DEFINITIONS[index];
      expect(definition).toBeDefined();

      const runtime = createRuntimeLevel(definition);
      const ladderCount = countTiles(runtime, "ladder");
      const holeCount = countTiles(runtime, "hole");

      expect(runtime.id).toBeTruthy();
      expect(runtime.title).toBe(campaignLevel.title);
      expect(runtime.start).not.toEqual(runtime.finish);
      expect(authoredIds.has(runtime.id)).toBe(false);
      authoredIds.add(runtime.id);

      const title = runtime.title ?? "";
      expect(authoredTitles.has(title)).toBe(false);
      authoredTitles.add(title);

      expect(ladderCount > 0).toBe(campaignLevel.ladders.enabled);
      expect(holeCount > 0).toBe(campaignLevel.holes.enabled);
      expect(Boolean(runtime.enemy)).toBe(campaignLevel.enemies.enabled);
    });
  });

  it("keeps each authored level structurally solvable", () => {
    CAMPAIGN_LEVEL_DEFINITIONS.forEach((definition) => {
      const runtime = createRuntimeLevel(definition);
      expect(canReachFinish(runtime)).toBe(true);
    });
  });

  it("holds enemy encounters for the back half of the campaign", () => {
    const authoredEnemyPresence = CAMPAIGN_LEVEL_DEFINITIONS.map((definition) =>
      Boolean(createRuntimeLevel(definition).enemy),
    );
    expect(authoredEnemyPresence).toEqual([false, false, true, true]);
  });

  it("keeps authored enemy patrols reachable without occupying long shortest-path chokes", () => {
    CAMPAIGN_LEVEL_DEFINITIONS.forEach((definition) => {
      const runtime = createRuntimeLevel(definition);
      if (!runtime.enemy) return;

      const reachableCells = getReachableCells(runtime);
      runtime.enemy.path.forEach((cell, index) => {
        expect(reachableCells.has(keyOf(cell)), `enemy waypoint ${index} in ${runtime.id} should be reachable`).toBe(true);
      });

      const shortestPathKeys = new Set(getShortestPath(runtime).map(keyOf));
      let longestSharedRun = 0;
      let currentSharedRun = 0;

      runtime.enemy.path.forEach((cell) => {
        if (shortestPathKeys.has(keyOf(cell))) {
          currentSharedRun += 1;
          longestSharedRun = Math.max(longestSharedRun, currentSharedRun);
          return;
        }

        currentSharedRun = 0;
      });

      expect(longestSharedRun, `${runtime.id} enemy path should only brush the shortest route`).toBeLessThanOrEqual(1);
    });
  });

  it("preserves authored multi-layer traversal landmarks for LEVEL_3 and LEVEL_4", () => {
    const level3 = createRuntimeLevel(LEVEL_3);
    expect(level3.layerCount).toBe(2);
    expect(level3.start).toEqual({ x: 1, z: 1, layer: 0 });
    expect(level3.finish).toEqual({ x: 9, z: 9, layer: 1 });
    expect(getTileAt(level3, 5, 1, 0)).toBe("ladder");
    expect(getTileAt(level3, 5, 1, 1)).toBe("ladder");
    expect(getTileAt(level3, 7, 7, 0)).toBe("ladder");
    expect(getTileAt(level3, 7, 7, 1)).toBe("ladder");
    expect(getTileAt(level3, 5, 5, 1)).toBe("hole");
    expect(resolveHoleLanding(level3, { x: 5, z: 5, layer: 1 })).toEqual({ x: 5, z: 5, layer: 0 });

    const level4 = createRuntimeLevel(LEVEL_4);
    expect(level4.layerCount).toBe(3);
    expect(level4.start).toEqual({ x: 1, z: 1, layer: 0 });
    expect(level4.finish).toEqual({ x: 11, z: 11, layer: 2 });
    expect(getTileAt(level4, 5, 1, 0)).toBe("ladder");
    expect(getTileAt(level4, 5, 1, 1)).toBe("ladder");
    expect(getTileAt(level4, 5, 1, 2)).toBe("ladder");
    expect(getTileAt(level4, 5, 11, 0)).toBe("ladder");
    expect(getTileAt(level4, 5, 11, 1)).toBe("ladder");
    expect(getTileAt(level4, 5, 11, 2)).toBe("ladder");
    expect(getTileAt(level4, 5, 5, 1)).toBe("hole");
  });

  it("can traverse the full campaign sequence without missing references", () => {
    const visitedLevelIds: number[] = [];
    const seen = new Set<number>();
    let currentLevelId: number | null = DEFAULT_CAMPAIGN_LEVEL_ID;

    while (currentLevelId !== null) {
      expect(seen.has(currentLevelId)).toBe(false);
      seen.add(currentLevelId);
      visitedLevelIds.push(currentLevelId);

      const campaignLevel = getCampaignLevel(currentLevelId as 1 | 2 | 3 | 4);
      const authoredLevel = CAMPAIGN_LEVEL_DEFINITIONS[currentLevelId - 1];
      expect(authoredLevel).toBeDefined();
      expect(createRuntimeLevel(authoredLevel).title).toBe(campaignLevel.title);

      const nextLevelId = getNextCampaignLevelId(currentLevelId as 1 | 2 | 3 | 4);
      if (nextLevelId !== null) {
        expect(CAMPAIGN_LEVEL_DEFINITIONS[nextLevelId - 1]).toBeDefined();
        expect(getCampaignLevel(nextLevelId).id).toBe(nextLevelId);
      }

      currentLevelId = nextLevelId;
    }

    expect(visitedLevelIds).toEqual(CAMPAIGN_LEVELS.map((level) => level.id));
  });
});
