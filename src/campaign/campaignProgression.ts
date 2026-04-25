/**
 * Four-level campaign progression — design contract for maze generator + runtime.
 * Current build: level runtime accepts layered tiles, but the active campaign level still
 * uses a normalized legacy floor while vertical maps remain gated by campaign progression.
 */

export type CampaignLevelId = 1 | 2 | 3 | 4;

/** When a mechanic first appears relative to the critical path (tutorial pacing). */
export type IntroductionTiming = "none" | "after_first_goal" | "mid_level" | "from_start";

export type PathBranching = "linear_corridor" | "branching" | "dense_branching";

export type DeadEndPolicy = "none" | "short_blind_alleys" | "misleading_corridors";

export type EnemyArchetype =
  | "none"
  | "slow_patrol_fixed_loop"
  | "junction_sentinel"
  | "local_chase_radius";

export interface CampaignLevelSpec {
  id: CampaignLevelId;
  title: string;
  /** Player-facing difficulty band (not CVSS — pacing). */
  band: "tutorial" | "moderate" | "hard" | "expert";
  /** Intended grid span for procedural layouts (current demo maze is 11×11). */
  gridSpan: { width: number; depth: number };
  ladders: {
    enabled: boolean;
    introduction: IntroductionTiming;
    /** Design intent only until multi-floor graph exists. */
    rationale: string;
  };
  holes: {
    enabled: boolean;
    introduction: IntroductionTiming;
    rationale: string;
  };
  pathing: {
    branching: PathBranching;
    deadEnds: DeadEndPolicy;
    /** Guidance for generator: ratio of shortest solution steps to Manhattan lower bound. */
    pathInflationHint: string;
  };
  enemies: {
    enabled: boolean;
    archetype: EnemyArchetype;
    rationale: string;
  };
  /** What must exist in code before this level ships (sprint guardrail). */
  architecturePrereqs: string[];
}

export const CAMPAIGN_LEVELS = [
  {
    id: 1,
    title: "Neon Run",
    band: "tutorial",
    gridSpan: { width: 9, depth: 9 },
    ladders: {
      enabled: false,
      introduction: "none",
      rationale: "Teach camera, grid moves, beacon goal on a single floor.",
    },
    holes: {
      enabled: false,
      introduction: "none",
      rationale: "Avoid fail states until collision + respawn rules exist.",
    },
    pathing: {
      branching: "linear_corridor",
      deadEnds: "none",
      pathInflationHint: "~1.0–1.15× Manhattan (almost direct with one gentle bend).",
    },
    enemies: {
      enabled: false,
      archetype: "none",
      rationale: "Establish timing/moves HUD without threat pressure.",
    },
    architecturePrereqs: ["Single-floor Cell grid", "Start/finish placement", "Victory gate"],
  },
  {
    id: 2,
    title: "Switchback Grid",
    band: "moderate",
    gridSpan: { width: 11, depth: 11 },
    ladders: {
      enabled: false,
      introduction: "none",
      rationale: "Still flat; increase cognitive load before verticality.",
    },
    holes: {
      enabled: false,
      introduction: "none",
      rationale: "Optional sprint stretch: floor tint only (no fall damage) if timeboxed.",
    },
    pathing: {
      branching: "linear_corridor",
      deadEnds: "none",
      pathInflationHint: "~2.5× Manhattan; long switchbacks teach route reading before verticality.",
    },
    enemies: {
      enabled: false,
      archetype: "none",
      rationale: "Keep the second level threat-free so branching is learned before enemy timing is introduced.",
    },
    architecturePrereqs: ["Level index + per-level maze seed", "Regenerate on restart per level"],
  },
  {
    id: 3,
    title: "Vertical Drift",
    band: "hard",
    gridSpan: { width: 11, depth: 11 },
    ladders: {
      enabled: true,
      introduction: "after_first_goal",
      rationale: "Introduce ladders mid-run so tutorial path stays simple, then requires backtrack/stacking.",
    },
    holes: {
      enabled: true,
      introduction: "mid_level",
      rationale: "Holes as optional shortcuts or one-way drops once floor index + safe landing exist.",
    },
    pathing: {
      branching: "dense_branching",
      deadEnds: "misleading_corridors",
      pathInflationHint: "~1.4–1.75× Manhattan equivalent on primary plane; vertical links shorten true distance.",
    },
    enemies: {
      enabled: true,
      archetype: "slow_patrol_fixed_loop",
      rationale: "Introduce the first predictable patrol late in the route so players can read timing without opening-level pressure.",
    },
    architecturePrereqs: [
      "Multi-floor graph (cell + floor key)",
      "Ladder edge type in adjacency",
      "Hole: floor transition or hazard with reset",
      "Enemy waypoint graph subset of walkable cells",
    ],
  },
  {
    id: 4,
    title: "Prism Spire",
    band: "expert",
    gridSpan: { width: 13, depth: 13 },
    ladders: {
      enabled: true,
      introduction: "from_start",
      rationale: "Vertical routing is mandatory from the opening — no long flat tutorial segment.",
    },
    holes: {
      enabled: true,
      introduction: "from_start",
      rationale: "Combine holes with ladders for routing puzzles and risk/reward shortcuts.",
    },
    pathing: {
      branching: "dense_branching",
      deadEnds: "misleading_corridors",
      pathInflationHint: "~1.6–2.0× Manhattan equivalent; dead ends should look like main halls.",
    },
    enemies: {
      enabled: true,
      archetype: "local_chase_radius",
      rationale: "Short-range chase or junction sentinels tied to key doors; keeps threat spatially bounded.",
    },
    architecturePrereqs: [
      "All level-3 systems stable",
      "Difficulty knobs: enemy speed, patrol period, chase radius",
      "Optional: keyed doors / one-way edges",
    ],
  },
] as const satisfies readonly CampaignLevelSpec[];

export function getCampaignLevel(id: CampaignLevelId): CampaignLevelSpec {
  const found = CAMPAIGN_LEVELS.find((level) => level.id === id);
  if (!found) throw new Error(`Unknown campaign level: ${id}`);
  return found;
}

export const CAMPAIGN_LEVEL_IDS = CAMPAIGN_LEVELS.map((level) => level.id) as readonly CampaignLevelId[];

export function getNextCampaignLevelId(id: CampaignLevelId): CampaignLevelId | null {
  const index = CAMPAIGN_LEVEL_IDS.indexOf(id);
  if (index === -1) {
    throw new Error(`Unknown campaign level: ${id}`);
  }

  return CAMPAIGN_LEVEL_IDS[index + 1] ?? null;
}

/** Active level for UI until level select / persistence ships (matches current single maze scope). */
export const DEFAULT_CAMPAIGN_LEVEL_ID: CampaignLevelId = 1;
