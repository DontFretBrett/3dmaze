import { CONTACT_RULES } from "./enemyDesign";
import { isWalkableTile, type LevelCoordinate, type RuntimeLevel } from "./levelRuntime";

export type EnemyPatrolDirection = -1 | 1;

export interface EnemyRuntimeState {
  cell: LevelCoordinate;
  patrolIndex: number;
  patrolDirection: EnemyPatrolDirection;
  nextStepAt: number;
}

export interface EnemyStepPlan {
  destination: LevelCoordinate;
  nextIndex: number;
  nextDirection: EnemyPatrolDirection;
  durationSeconds: number;
  rotationRadians: number;
  rotationDurationSeconds: number;
}

export interface EnemyCollisionContext {
  contacts: number;
  completed: boolean;
  failed: boolean;
  playerMoving: boolean;
  playerCell: LevelCoordinate;
  enemyState: EnemyRuntimeState | null;
}

export interface EnemyCollisionResolution {
  contacts: number;
  failed: boolean;
}

export function createEnemyState(level: Pick<RuntimeLevel, "enemy">, now: number): EnemyRuntimeState | null {
  if (!level.enemy) return null;

  return {
    cell: { ...level.enemy.path[0] },
    patrolIndex: 0,
    patrolDirection: 1,
    nextStepAt: now + level.enemy.initialDelayMs,
  };
}

export function getNextPatrolState(
  patrolIndex: number,
  patrolDirection: EnemyPatrolDirection,
  patrolLength: number,
) {
  if (patrolLength <= 1) {
    return { nextIndex: 0, nextDirection: patrolDirection };
  }

  let nextDirection = patrolDirection;
  let nextIndex = patrolIndex + patrolDirection;
  if (nextIndex < 0 || nextIndex >= patrolLength) {
    nextDirection = patrolDirection === 1 ? -1 : 1;
    nextIndex = patrolIndex + nextDirection;
  }

  return { nextIndex, nextDirection };
}

export function planEnemyStep(level: RuntimeLevel, enemyState: EnemyRuntimeState, now: number): EnemyStepPlan | null {
  if (!level.enemy || now < enemyState.nextStepAt) return null;

  const { nextIndex, nextDirection } = getNextPatrolState(
    enemyState.patrolIndex,
    enemyState.patrolDirection,
    level.enemy.path.length,
  );
  const destination = level.enemy.path[nextIndex];
  if (!isWalkableTile(level, destination.x, destination.z, destination.layer, destination.face)) {
    throw new Error("Enemy patrol attempted to move into a blocked tile.");
  }

  const deltaX = destination.x - enemyState.cell.x;
  const deltaZ = destination.z - enemyState.cell.z;

  return {
    destination,
    nextIndex,
    nextDirection,
    durationSeconds: level.enemy.secondsPerCell,
    rotationRadians: Math.atan2(deltaX, deltaZ),
    rotationDurationSeconds: Math.min(level.enemy.secondsPerCell * 0.65, 0.36),
  };
}

export function finalizeEnemyStep(
  level: RuntimeLevel,
  step: EnemyStepPlan,
  arrivedAt: number,
): EnemyRuntimeState {
  if (!level.enemy) {
    throw new Error("Enemy step cannot finalize without an enemy definition.");
  }

  return {
    cell: { ...step.destination },
    patrolIndex: step.nextIndex,
    patrolDirection: step.nextDirection,
    nextStepAt: arrivedAt + level.enemy.pauseMsBetweenSteps,
  };
}

export function hasEnemyContact(playerCell: LevelCoordinate, enemyState: EnemyRuntimeState | null): boolean {
  return Boolean(
      enemyState &&
      playerCell.layer === enemyState.cell.layer &&
      playerCell.face === enemyState.cell.face &&
      playerCell.x === enemyState.cell.x &&
      playerCell.z === enemyState.cell.z,
  );
}

export function resolveEnemyCollision(context: EnemyCollisionContext): EnemyCollisionResolution | null {
  if (
    context.completed ||
    context.failed ||
    context.playerMoving ||
    !hasEnemyContact(context.playerCell, context.enemyState)
  ) {
    return null;
  }

  return {
    contacts: context.contacts + 1,
    failed: CONTACT_RULES.outcome === "lose-state",
  };
}
