import type { Direction } from "../MazeGame";
import { createRuntimeLevel, sameCoordinate, type LevelCoordinate, type RuntimeLevel } from "../levelRuntime";
import { getTraversalNeighbors, keyOf } from "./campaignAssessment";
import { CAMPAIGN_LEVELS, type CampaignLevelId } from "./campaignProgression";
import { CAMPAIGN_LEVEL_DEFINITIONS } from "./levelDefinitions";
import { resolveHorizontalTraversal } from "../verticalTraversal";

export type CampaignAction = Direction | "up" | "down";

export interface CampaignWalkthrough {
  id: CampaignLevelId;
  title: string;
  band: (typeof CAMPAIGN_LEVELS)[number]["band"];
  path: LevelCoordinate[];
  actions: CampaignAction[];
  actionCount: number;
  verticalActionCount: number;
  firstVerticalActionStep: number | null;
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
      const nextKey = keyOf(next.cell);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey);
      parentByCell.set(nextKey, current);
      frontier.push(next.cell);
    }
  }

  return [] as LevelCoordinate[];
}

function toAction(level: RuntimeLevel, from: LevelCoordinate, to: LevelCoordinate): CampaignAction {
  if (to.layer !== from.layer) {
    return to.layer > from.layer ? "up" : "down";
  }

  for (const [action, dx, dz] of [
    ["right", 1, 0],
    ["left", -1, 0],
    ["backward", 0, 1],
    ["forward", 0, -1],
  ] as const satisfies readonly [Direction, number, number][]) {
    const plan = resolveHorizontalTraversal(level, from, dx, dz, 1);
    if (plan && sameCoordinate(plan.destination, to)) {
      return action;
    }
  }

  throw new Error(`No authored action resolves ${keyOf(from)} -> ${keyOf(to)}.`);
}

export function buildCampaignWalkthroughs() {
  return CAMPAIGN_LEVELS.map((campaignLevel, index) => {
    const runtimeLevel = createRuntimeLevel(CAMPAIGN_LEVEL_DEFINITIONS[index]);
    const path = getShortestPath(runtimeLevel);
    const actions = path.slice(1).map((cell, pathIndex) => toAction(runtimeLevel, path[pathIndex]!, cell));
    const firstVerticalActionIndex = actions.findIndex((action) => action === "up" || action === "down");

    return {
      id: campaignLevel.id,
      title: campaignLevel.title,
      band: campaignLevel.band,
      path,
      actions,
      actionCount: actions.length,
      verticalActionCount: actions.filter((action) => action === "up" || action === "down").length,
      firstVerticalActionStep: firstVerticalActionIndex === -1 ? null : firstVerticalActionIndex + 1,
    } satisfies CampaignWalkthrough;
  });
}

export const CAMPAIGN_WALKTHROUGHS = buildCampaignWalkthroughs();
