import { describe, expect, it } from "vitest";
import {
  createEnemyState,
  finalizeEnemyStep,
  getNextPatrolState,
  hasEnemyContact,
  planEnemyStep,
  resolveEnemyCollision,
} from "./enemyRuntime";
import { createRuntimeLevel } from "./levelRuntime";
import { MAZE_LAYOUT } from "./mazeLayout";
import { LEVEL_3 } from "./campaign/levelDefinitions";

describe("enemy runtime behavior", () => {
  it("loads the spawn cell from the first authored waypoint and respects initial delay", () => {
    const level = createRuntimeLevel(LEVEL_3);
    const enemyState = createEnemyState(level, 1_000);

    expect(enemyState).toEqual({
      cell: { ...level.enemy!.path[0] },
      patrolIndex: 0,
      patrolDirection: 1,
      nextStepAt: 1_000 + level.enemy!.initialDelayMs,
    });
  });

  it("uses level pacing knobs for patrol cadence instead of hard-coded timing", () => {
    const level = createRuntimeLevel({
      id: "enemy-tuning",
      maze: MAZE_LAYOUT,
      start: { x: 1, z: 1 },
      finish: { x: 9, z: 9 },
      enemy: {
        path: [
          { x: 5, z: 1 },
          { x: 6, z: 1 },
          { x: 7, z: 1 },
        ],
        secondsPerCell: 1.15,
        initialDelayMs: 640,
        pauseMsBetweenSteps: 140,
      },
    });

    const spawn = createEnemyState(level, 2_000)!;
    expect(spawn.nextStepAt).toBe(2_640);
    expect(planEnemyStep(level, spawn, 2_639)).toBeNull();

    const step = planEnemyStep(level, spawn, 2_640)!;
    expect(step.durationSeconds).toBe(1.15);

    const afterStep = finalizeEnemyStep(level, step, 4_000);
    expect(afterStep.nextStepAt).toBe(4_140);
  });

  it("ping-pongs patrol direction at the ends of the path", () => {
    expect(getNextPatrolState(2, 1, 3)).toEqual({
      nextIndex: 1,
      nextDirection: -1,
    });
    expect(getNextPatrolState(0, -1, 3)).toEqual({
      nextIndex: 1,
      nextDirection: 1,
    });
  });

  it("rejects patrol steps whose destination becomes a wall", () => {
    const level = createRuntimeLevel({
      id: "enemy-wall-block",
      maze: MAZE_LAYOUT,
      start: { x: 1, z: 1 },
      finish: { x: 9, z: 9 },
      enemy: {
        path: [
          { x: 5, z: 1 },
          { x: 6, z: 1 },
        ],
      },
    });

    const spawn = createEnemyState(level, 0)!;
    level.layers[0][1][6] = 1;

    expect(() => planEnemyStep(level, spawn, level.enemy!.initialDelayMs)).toThrowError(
      "Enemy patrol attempted to move into a blocked tile.",
    );
  });

  it("applies the lose-state collision outcome only on same-layer contact", () => {
    const level = createRuntimeLevel(LEVEL_3);
    const enemyState = createEnemyState(level, 0)!;

    expect(hasEnemyContact({ ...enemyState.cell, layer: enemyState.cell.layer - 1 }, enemyState)).toBe(false);
    expect(
      resolveEnemyCollision({
        contacts: 0,
        completed: false,
        failed: false,
        playerMoving: false,
        playerCell: { ...enemyState.cell, layer: enemyState.cell.layer - 1 },
        enemyState,
      }),
    ).toBeNull();

    expect(hasEnemyContact(enemyState.cell, enemyState)).toBe(true);
    expect(
      resolveEnemyCollision({
        contacts: 0,
        completed: false,
        failed: false,
        playerMoving: false,
        playerCell: enemyState.cell,
        enemyState,
      }),
    ).toEqual({
      contacts: 1,
      failed: true,
    });
  });
});
