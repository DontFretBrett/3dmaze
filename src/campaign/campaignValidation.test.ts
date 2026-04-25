import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_LEVELS,
  DEFAULT_CAMPAIGN_LEVEL_ID,
  getCampaignLevel,
  getNextCampaignLevelId,
  type CampaignLevelId,
} from "./campaignProgression";
import { CAMPAIGN_LEVEL_DEFINITIONS, LEVEL_3, LEVEL_4 } from "./levelDefinitions";
import {
  createRuntimeLevel,
  forEachCoordinate,
  getTileAt,
  resolveHoleLanding,
  type LevelCoordinate,
  type RuntimeLevel,
  type Tile,
} from "../levelRuntime";
import { getTraversalNeighbors, keyOf, sameCoordinate } from "./campaignAssessment";

function canReachFinish(level: RuntimeLevel) {
  const frontier: LevelCoordinate[] = [{ ...level.start }];
  const seen = new Set([keyOf(level.start)]);

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;
    if (keyOf(current) === keyOf(level.finish)) {
      return true;
    }

    for (const next of getTraversalNeighbors(level, current)) {
      const key = keyOf(next.cell);
      if (seen.has(key)) continue;
      seen.add(key);
      frontier.push(next.cell);
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

    for (const next of getTraversalNeighbors(level, current)) {
      const key = keyOf(next.cell);
      if (seen.has(key)) continue;
      seen.add(key);
      frontier.push(next.cell);
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
    if (sameCoordinate(current, level.finish)) {
      const path: LevelCoordinate[] = [];
      let cursor: LevelCoordinate | undefined = current;

      while (cursor) {
        path.push(cursor);
        cursor = parentByCell.get(keyOf(cursor));
      }

      return path.reverse();
    }

    for (const next of getTraversalNeighbors(level, current)) {
      const key = keyOf(next.cell);
      if (seen.has(key)) continue;
      seen.add(key);
      parentByCell.set(key, current);
      frontier.push(next.cell);
    }
  }

  return [];
}

function countTiles(level: RuntimeLevel, match: Tile) {
  let count = 0;
  forEachCoordinate(level, (coord) => {
    if (getTileAt(level, coord.x, coord.z, coord.layer, coord.face) === match) {
      count += 1;
    }
  });
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
    expect(authoredEnemyPresence).toEqual([false, false, true, true, true, true, true, true, true, true]);
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
    expect(level3.topology).toBe("cube");
    expect(level3.layerCount).toBe(2);
    expect(level3.start).toEqual({ x: 1, z: 3, layer: 0, face: "north" });
    expect(level3.finish).toEqual({ x: 5, z: 3, layer: 1, face: "south" });
    expect(getTileAt(level3, 3, 3, 0, "east")).toBe("ladder");
    expect(getTileAt(level3, 3, 3, 1, "east")).toBe("ladder");
    expect(getTileAt(level3, 1, 1, 1, "west")).toBe("hole");
    expect(resolveHoleLanding(level3, { x: 1, z: 1, layer: 1, face: "west" })).toEqual({ x: 1, z: 1, layer: 0, face: "west" });

    const level4 = createRuntimeLevel(LEVEL_4);
    expect(level4.topology).toBe("cube");
    expect(level4.layerCount).toBe(3);
    expect(level4.start).toEqual({ x: 2, z: 3, layer: 0, face: "east" });
    expect(level4.finish).toEqual({ x: 5, z: 3, layer: 2, face: "south" });
    expect(getTileAt(level4, 3, 3, 0, "east")).toBe("ladder");
    expect(getTileAt(level4, 3, 3, 1, "east")).toBe("ladder");
    expect(getTileAt(level4, 3, 3, 1, "west")).toBe("ladder");
    expect(getTileAt(level4, 3, 3, 2, "west")).toBe("ladder");
    expect(getTileAt(level4, 5, 1, 1, "north")).toBe("hole");
    expect(getTileAt(level4, 1, 5, 2, "south")).toBe("hole");
  });

  it("can traverse the full campaign sequence without missing references", () => {
    const visitedLevelIds: number[] = [];
    const seen = new Set<number>();
    let currentLevelId: CampaignLevelId | null = DEFAULT_CAMPAIGN_LEVEL_ID;

    while (currentLevelId !== null) {
      expect(seen.has(currentLevelId)).toBe(false);
      seen.add(currentLevelId);
      visitedLevelIds.push(currentLevelId);

      const campaignLevel = getCampaignLevel(currentLevelId);
      const authoredLevel = CAMPAIGN_LEVEL_DEFINITIONS[currentLevelId - 1];
      expect(authoredLevel).toBeDefined();
      expect(createRuntimeLevel(authoredLevel).title).toBe(campaignLevel.title);

      const nextLevelId = getNextCampaignLevelId(currentLevelId);
      if (nextLevelId !== null) {
        expect(CAMPAIGN_LEVEL_DEFINITIONS[nextLevelId - 1]).toBeDefined();
        expect(getCampaignLevel(nextLevelId).id).toBe(nextLevelId);
      }

      currentLevelId = nextLevelId;
    }

    expect(visitedLevelIds).toEqual(CAMPAIGN_LEVELS.map((level) => level.id));
  });
});
