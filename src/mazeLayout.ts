import {
  ENEMY_INITIAL_DELAY_MS,
  ENEMY_PAUSE_BETWEEN_STEPS_MS,
  ENEMY_SECONDS_PER_CELL,
} from "./enemyDesign";
import type { LevelDefinition, Tile } from "./levelRuntime";

export const MAZE_LAYOUT: Tile[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const CELL_SIZE = 4;
export const START_CELL = { x: 1, z: 1 } as const;
export const FINISH_CELL = { x: 9, z: 9 } as const;

export const ACTIVE_LEVEL: LevelDefinition = {
  id: "vertical-preview",
  title: "Vertical Preview",
  layers: [
    [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, "ladder", 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
    [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, "ladder", 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1, "hole", 1, 0, 0, 0, 1],
      [1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 9, z: 9, layer: 1 },
  enemy: {
    path: [
      { x: 2, z: 7, layer: 0 },
      { x: 3, z: 7, layer: 0 },
      { x: 4, z: 7, layer: 0 },
      { x: 5, z: 7, layer: 0 },
    ],
    secondsPerCell: ENEMY_SECONDS_PER_CELL,
    initialDelayMs: ENEMY_INITIAL_DELAY_MS,
    pauseMsBetweenSteps: ENEMY_PAUSE_BETWEEN_STEPS_MS,
  },
};

export const MULTI_LAYER_PREVIEW_LEVEL = ACTIVE_LEVEL;

export function canMoveToCell(x: number, z: number, maze: readonly (readonly Tile[])[] = MAZE_LAYOUT) {
  const tile = maze[z]?.[x];
  return tile !== undefined && tile !== 1;
}
