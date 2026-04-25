import {
  createRuntimeLevel,
  forEachCoordinate,
  getTileAt,
  resolveHoleLanding,
  sameCoordinate,
  type LevelCoordinate,
  type RuntimeLevel,
} from "../levelRuntime";
import { resolveHorizontalTraversal } from "../verticalTraversal";
import { CAMPAIGN_LEVEL_DEFINITIONS } from "./levelDefinitions";

export type TraversalEdgeType = "walk" | "ladder" | "hole";

export interface TraversalPointAssessment {
  type: "ladder" | "hole";
  coordinate: LevelCoordinate;
  entryCount: number;
  reachableFromStart: boolean;
  canReachFinish: boolean;
  landing: LevelCoordinate | null;
}

export interface LevelAssessment {
  id: string;
  title: string;
  layerCount: number;
  reachableCells: number;
  shortestPathSteps: number;
  shortestPathDecisionCount: number;
  shortestPathVerticalMoves: number;
  shortestPathHoleDrops: number;
  deadEnds: number;
  junctions: number;
  branchSurplus: number;
  enemyPathLength: number;
  enemySecondsPerCell: number | null;
  canReachFinish: boolean;
  traversalPoints: TraversalPointAssessment[];
}

interface TraversalEdge {
  cell: LevelCoordinate;
  type: TraversalEdgeType;
}

interface ShortestPathResult {
  path: LevelCoordinate[];
  verticalMoves: number;
  holeDrops: number;
}

export function keyOf(cell: LevelCoordinate) {
  return `${cell.layer}:${cell.face ?? "stack"}:${cell.x}:${cell.z}`;
}

export { sameCoordinate } from "../levelRuntime";

function resolveEntry(level: RuntimeLevel, cell: LevelCoordinate) {
  const landing = resolveHoleLanding(level, cell);
  if (!landing) {
    throw new Error(`Traversal cell ${keyOf(cell)} has no safe landing.`);
  }
  return landing;
}

export function getTraversalNeighbors(level: RuntimeLevel, cell: LevelCoordinate): TraversalEdge[] {
  const neighbors: TraversalEdge[] = [];

  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const plan = resolveHorizontalTraversal(level, cell, dx, dz, 1);
    if (!plan) continue;
    const entered = plan.segments[0]?.target;
    if (!entered) continue;

    neighbors.push({
      cell: resolveEntry(level, entered),
      type: getTileAt(level, entered.x, entered.z, entered.layer, entered.face) === "hole" ? "hole" : "walk",
    });
  }

  if (getTileAt(level, cell.x, cell.z, cell.layer, cell.face) === "ladder") {
    for (const delta of [-1, 1] as const) {
      const climbed = {
        x: cell.x,
        z: cell.z,
        layer: cell.layer + delta,
        ...(cell.face ? { face: cell.face } : {}),
      } satisfies LevelCoordinate;
      if (getTileAt(level, climbed.x, climbed.z, climbed.layer, climbed.face) === "ladder") {
        neighbors.push({ cell: climbed, type: "ladder" });
      }
    }
  }

  return neighbors;
}

export function getReachableCells(level: RuntimeLevel, start = level.start) {
  const frontier: LevelCoordinate[] = [{ ...start }];
  const seen = new Set([keyOf(start)]);

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) break;

    for (const next of getTraversalNeighbors(level, current)) {
      const nextKey = keyOf(next.cell);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey);
      frontier.push(next.cell);
    }
  }

  return seen;
}

function getShortestPath(level: RuntimeLevel): ShortestPathResult {
  const frontier: LevelCoordinate[] = [{ ...level.start }];
  const seen = new Set([keyOf(level.start)]);
  const parentByCell = new Map<string, LevelCoordinate>();
  const edgeTypeByCell = new Map<string, TraversalEdgeType>();

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

      let verticalMoves = 0;
      let holeDrops = 0;
      for (const cell of path) {
        const edgeType = edgeTypeByCell.get(keyOf(cell));
        if (edgeType === "ladder") verticalMoves += 1;
        if (edgeType === "hole") holeDrops += 1;
      }

      return {
        path: path.reverse(),
        verticalMoves,
        holeDrops,
      };
    }

    for (const next of getTraversalNeighbors(level, current)) {
      const nextKey = keyOf(next.cell);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey);
      parentByCell.set(nextKey, current);
      edgeTypeByCell.set(nextKey, next.type);
      frontier.push(next.cell);
    }
  }

  return {
    path: [],
    verticalMoves: 0,
    holeDrops: 0,
  };
}

function countDecisionPoints(level: RuntimeLevel, path: readonly LevelCoordinate[]) {
  let decisionCount = 0;

  path.forEach((cell, index) => {
    const previous = index > 0 ? path[index - 1] : null;
    const onwardOptions = getTraversalNeighbors(level, cell).filter((neighbor) =>
      previous ? !sameCoordinate(neighbor.cell, previous) : true,
    );
    if (onwardOptions.length > 1) {
      decisionCount += 1;
    }
  });

  return decisionCount;
}

function countBranching(level: RuntimeLevel, reachable: ReadonlySet<string>) {
  let deadEnds = 0;
  let junctions = 0;
  let branchSurplus = 0;

  reachable.forEach((cellKey) => {
    const [layerToken, faceToken, xToken, zToken] = cellKey.split(":");
    const degree = getTraversalNeighbors(level, {
      x: Number(xToken),
      z: Number(zToken),
      layer: Number(layerToken),
      ...(faceToken !== "stack" ? { face: faceToken as LevelCoordinate["face"] } : {}),
    }).filter((neighbor) =>
      reachable.has(keyOf(neighbor.cell)),
    ).length;

    if (degree === 1) deadEnds += 1;
    if (degree >= 3) {
      junctions += 1;
      branchSurplus += degree - 2;
    }
  });

  return { deadEnds, junctions, branchSurplus };
}

function getTraversalPoints(level: RuntimeLevel, reachableFromStart: ReadonlySet<string>): TraversalPointAssessment[] {
  const points: TraversalPointAssessment[] = [];
  forEachCoordinate(level, (coordinate) => {
    const tile = getTileAt(level, coordinate.x, coordinate.z, coordinate.layer, coordinate.face);
    if (tile !== "ladder" && tile !== "hole") return;

    if (tile === "ladder") {
      const reachable = reachableFromStart.has(keyOf(coordinate));
      points.push({
        type: "ladder",
        coordinate,
        entryCount: reachable ? 1 : 0,
        reachableFromStart: reachable,
        canReachFinish: reachable && getReachableCells(level, coordinate).has(keyOf(level.finish)),
        landing: coordinate,
      });
      return;
    }

    const landing = resolveHoleLanding(level, coordinate);
    const entryCount = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].reduce((count, [dx, dz]) => {
      const plan = resolveHorizontalTraversal(level, coordinate, dx, dz, 1);
      if (!plan) return count;

      const adjacent = plan.destination;
      if (!reachableFromStart.has(keyOf(adjacent))) return count;
      return count + 1;
    }, 0);

    points.push({
      type: "hole",
      coordinate,
      entryCount,
      reachableFromStart: entryCount > 0,
      canReachFinish: landing !== null && getReachableCells(level, landing).has(keyOf(level.finish)),
      landing,
    });
  });

  return points;
}

export function assessRuntimeLevel(level: RuntimeLevel): LevelAssessment {
  const reachable = getReachableCells(level);
  const shortestPath = getShortestPath(level);
  const branching = countBranching(level, reachable);
  const traversalPoints = getTraversalPoints(level, reachable);

  return {
    id: level.id,
    title: level.title ?? level.id,
    layerCount: level.layerCount,
    reachableCells: reachable.size,
    shortestPathSteps: Math.max(0, shortestPath.path.length - 1),
    shortestPathDecisionCount: countDecisionPoints(level, shortestPath.path),
    shortestPathVerticalMoves: shortestPath.verticalMoves,
    shortestPathHoleDrops: shortestPath.holeDrops,
    deadEnds: branching.deadEnds,
    junctions: branching.junctions,
    branchSurplus: branching.branchSurplus,
    enemyPathLength: level.enemy?.path.length ?? 0,
    enemySecondsPerCell: level.enemy?.secondsPerCell ?? null,
    canReachFinish: shortestPath.path.length > 0,
    traversalPoints,
  };
}

export function assessCampaignLevels() {
  return CAMPAIGN_LEVEL_DEFINITIONS.map((definition) => assessRuntimeLevel(createRuntimeLevel(definition)));
}
