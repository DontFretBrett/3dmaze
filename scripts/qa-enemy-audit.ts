import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CAMPAIGN_LEVELS, getCampaignLevel, type CampaignLevelId } from "../src/campaign/campaignProgression";
import { CAMPAIGN_LEVEL_DEFINITIONS } from "../src/campaign/levelDefinitions";
import { PLAYER_MOVE_SECONDS } from "../src/enemyDesign";
import {
  createRuntimeLevel,
  getTileAt,
  isWalkableTile,
  resolveHoleLanding,
  type LevelCoordinate,
  type RuntimeLevel,
  type Tile,
} from "../src/levelRuntime";

type Severity = "info" | "warning" | "blocker";
type Category = "fairness" | "stability" | "progression";

interface QaIssue {
  severity: Severity;
  category: Category;
  levelId: string;
  message: string;
}

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

function analyzeEnemyLevel(levelId: CampaignLevelId) {
  const definition = CAMPAIGN_LEVEL_DEFINITIONS[levelId - 1];
  const runtime = createRuntimeLevel(definition);
  const campaignLevel = getCampaignLevel(levelId);
  const issues: QaIssue[] = [];
  const enemy = runtime.enemy;

  if (!enemy) {
    return {
      id: runtime.id,
      title: runtime.title ?? `Level ${levelId}`,
      enabled: false,
      issues,
    };
  }

  const implementedArchetype = "slow_patrol_fixed_loop";
  const reachableCells = getReachableCells(runtime);
  const shortestPathKeys = new Set(getShortestPath(runtime).map(keyOf));
  const waypointSummaries = enemy.path.map((cell, index) => ({
    index,
    cell,
    walkable: isWalkableTile(runtime, cell.x, cell.z, cell.layer),
    reachable: reachableCells.has(keyOf(cell)),
  }));

  let longestSharedRun = 0;
  let currentSharedRun = 0;
  enemy.path.forEach((cell) => {
    if (shortestPathKeys.has(keyOf(cell))) {
      currentSharedRun += 1;
      longestSharedRun = Math.max(longestSharedRun, currentSharedRun);
      return;
    }

    currentSharedRun = 0;
  });

  waypointSummaries.forEach((waypoint) => {
    if (!waypoint.walkable) {
      issues.push({
        severity: "blocker",
        category: "stability",
        levelId: runtime.id,
        message: `Enemy waypoint ${waypoint.index} lands on a blocked tile.`,
      });
    }
    if (!waypoint.reachable) {
      issues.push({
        severity: "blocker",
        category: "fairness",
        levelId: runtime.id,
        message: `Enemy waypoint ${waypoint.index} is unreachable from the player start graph.`,
      });
    }
  });

  if (enemy.secondsPerCell <= PLAYER_MOVE_SECONDS) {
    issues.push({
      severity: "blocker",
      category: "fairness",
      levelId: runtime.id,
      message: `Enemy pace ${enemy.secondsPerCell.toFixed(2)}s/cell is not slower than player pace ${PLAYER_MOVE_SECONDS.toFixed(2)}s/cell.`,
    });
  }

  if (longestSharedRun > 1) {
    issues.push({
      severity: "warning",
      category: "fairness",
      levelId: runtime.id,
      message: `Enemy occupies ${longestSharedRun} consecutive cells on the shortest route, which risks unavoidable chokes.`,
    });
  }

  if (campaignLevel.enemies.archetype !== implementedArchetype) {
    issues.push({
      severity: "warning",
      category: "progression",
      levelId: runtime.id,
      message: `Campaign metadata expects ${campaignLevel.enemies.archetype}, but authored gameplay still implements ${implementedArchetype}.`,
    });
  }

  return {
    id: runtime.id,
    title: runtime.title ?? `Level ${levelId}`,
    enabled: true,
    layerCount: runtime.layerCount,
    ladderCount: countTiles(runtime, "ladder"),
    holeCount: countTiles(runtime, "hole"),
    pace: {
      enemySecondsPerCell: enemy.secondsPerCell,
      playerSecondsPerCell: PLAYER_MOVE_SECONDS,
      slowdownRatio: Number((enemy.secondsPerCell / PLAYER_MOVE_SECONDS).toFixed(2)),
      pauseMsBetweenSteps: enemy.pauseMsBetweenSteps,
      initialDelayMs: enemy.initialDelayMs,
    },
    pathMetrics: {
      waypointCount: enemy.path.length,
      longestShortestPathOverlapRun: longestSharedRun,
    },
    waypointSummaries,
    issues,
  };
}

const levelIdsWithEnemies = CAMPAIGN_LEVELS.filter((level) => level.enemies.enabled).map((level) => level.id);
const levelReports = levelIdsWithEnemies.map(analyzeEnemyLevel);
const issues = levelReports.flatMap((level) => level.issues);

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    enemyLevelsChecked: levelReports.length,
    blockerCount: issues.filter((issue) => issue.severity === "blocker").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    status: issues.some((issue) => issue.severity === "blocker") ? "issues-found" : "pass-with-notes",
  },
  levels: levelReports,
  issues,
};

const outPath = resolve(process.cwd(), "test-results/enemy-qa-static.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Enemy QA static audit written to ${outPath}`);
console.log(JSON.stringify(report.summary, null, 2));
if (issues.length > 0) {
  issues.forEach((issue) => {
    console.log(`[${issue.severity}] ${issue.levelId}: ${issue.message}`);
  });
}
