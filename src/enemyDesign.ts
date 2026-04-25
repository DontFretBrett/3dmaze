/**
 * Minimal enemy design for this sprint — intentionally lightweight and dodgeable.
 *
 * ## Spawn rules
 * - Enemies use a fixed patrol polyline on `maze[z][x] === 0` cells only.
 * - Anchors avoid `start` / `finish` and are chosen on a corridor away from spawn.
 *
 * ## Movement (no pathfinding)
 * - Ping-pong along `PATROL_WAYPOINTS` in grid order; one cell per step.
 * - No A*, no prediction of the player — predictable patterns only.
 *
 * ## Speed budget (fairness)
 * - `DEFAULT_ENEMY_PACING.secondsPerCell` must stay strictly above the player's move tween duration
 *   (`PLAYER_MOVE_SECONDS` in `MazeGame`) so the player can always out-pace an
 *   enemy in a straight corridor race.
 * - `DEFAULT_ENEMY_PACING.pauseMsBetweenSteps` is the primary patrol cadence knob:
 *   lower values make the route feel tighter without changing path shape.
 *
 * ## Layered maps
 * - The active demo enemy path stays on layer `0`.
 * - Multi-floor maps should provide patrol waypoints with a layer index and only
 *   evaluate collisions when `enemy.layerIndex === player.layerIndex`.
 */
export const PLAYER_MOVE_SECONDS = 0.38;

/**
 * Shared patrol pacing defaults so level authors can tune enemy pressure from one place.
 * Individual levels may still override any field through `LevelDefinition.enemy`.
 */
export const DEFAULT_ENEMY_PACING = {
  /** Seconds the enemy needs to cross one open cell (must stay > PLAYER_MOVE_SECONDS). */
  secondsPerCell: 0.92,
  /** Delay before the patrol starts moving after a restart / spawn. */
  initialDelayMs: 320,
  /** Idle time between patrol steps; lowering this increases effective tick rate. */
  pauseMsBetweenSteps: 60,
} as const;

export const ENEMY_SECONDS_PER_CELL = DEFAULT_ENEMY_PACING.secondsPerCell;
export const ENEMY_INITIAL_DELAY_MS = DEFAULT_ENEMY_PACING.initialDelayMs;
export const ENEMY_PAUSE_BETWEEN_STEPS_MS = DEFAULT_ENEMY_PACING.pauseMsBetweenSteps;

/** Patrol waypoints (open cells); first entry is the spawn cell after reset. */
export const PATROL_WAYPOINTS: ReadonlyArray<{ readonly x: number; readonly z: number }> = [
  { x: 3, z: 7 },
  { x: 4, z: 7 },
  { x: 5, z: 7 },
  { x: 6, z: 7 },
  { x: 7, z: 7 },
];

/**
 * ## Collision outcome
 * - Lethal: contact ends the current run in an explicit lose state.
 * - Timer freezes on the catch frame so players can see where the patrol got them.
 * - Player movement is locked until they restart.
 * - Enemy motion stops immediately to avoid sliding through the player during the loss beat.
 * - `contacts` increments for HUD / analytics.
 */
/** Player input lock + clock freeze duration after enemy contact (ms). */
export const CONTACT_STUN_MS = 520;

export const CONTACT_RULES = {
  outcome: "lose-state",
} as const;
