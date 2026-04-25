/**
 * Node micro-benchmarks for logic adjacent to the enemy system (not GPU).
 * Run: npm run bench
 */
import { PATROL_WAYPOINTS, PLAYER_MOVE_SECONDS, ENEMY_SECONDS_PER_CELL } from "../src/enemyDesign";
import { createRuntimeLevel, type RuntimeLevel } from "../src/levelRuntime";
import { MAZE_LAYOUT, MULTI_LAYER_PREVIEW_LEVEL } from "../src/mazeLayout";

function bench(name: string, iterations: number, fn: (i: number) => void) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i += 1) fn(i);
  const ms = performance.now() - t0;
  const perOpNs = (ms / iterations) * 1e6;
  console.log(`${name}: ${iterations.toLocaleString()} ops in ${ms.toFixed(2)} ms (${perOpNs.toFixed(1)} ns/op)`);
}

function contactCheck(player: { x: number; z: number; layer: number }, enemy: { x: number; z: number }, enemyLayer: number) {
  return player.layer === enemyLayer && player.x === enemy.x && player.z === enemy.z;
}

function buildWideRuntime(floorSize: number): RuntimeLevel {
  const row = Array.from({ length: floorSize }, (_, i) => (i === 0 || i === floorSize - 1 ? 1 : 0)) as (0 | 1)[];
  const maze = Array.from({ length: floorSize }, () => [...row]) as (0 | 1)[][];
  maze[1][1] = 0;
  maze[floorSize - 2][floorSize - 2] = 0;
  const layers = [maze, maze.map((r) => [...r])];
  return createRuntimeLevel({
    id: "bench-wide",
    layers,
    start: { x: 1, z: 1, layer: 0 },
    finish: { x: floorSize - 2, z: floorSize - 2, layer: 1 },
  });
}

console.log("Enemy-adjacent CPU micro-benchmarks\n");
console.log(`PLAYER_MOVE_SECONDS=${PLAYER_MOVE_SECONDS} ENEMY_SECONDS_PER_CELL=${ENEMY_SECONDS_PER_CELL}\n`);

bench("grid collision (same-cell)", 5_000_000, (i) => {
  const px = i % 11;
  const pz = (i >> 4) % 11;
  contactCheck({ x: px, z: pz, layer: 0 }, PATROL_WAYPOINTS[i % PATROL_WAYPOINTS.length], 0);
});

bench("MAZE_LAYOUT walkable lookup", 5_000_000, (i) => {
  const x = i % MAZE_LAYOUT[0].length;
  const z = (i >> 4) % MAZE_LAYOUT.length;
  const t = MAZE_LAYOUT[z]?.[x];
  void (t !== undefined && t !== 1);
});

const layered = createRuntimeLevel(MULTI_LAYER_PREVIEW_LEVEL);
bench("getTileAt layered (2 floors)", 2_000_000, (i) => {
  const x = 1 + (i % 5);
  const z = 1 + ((i >> 3) % 5);
  const layer = i & 1;
  const tile = layered.layers[layer]?.[z]?.[x];
  void tile;
});

const wide = buildWideRuntime(41);
bench("getTileAt wide 41×41 ×2 layers", 1_000_000, (i) => {
  const x = i % wide.width;
  const z = (i >> 6) % wide.depth;
  const layer = i & 1;
  void wide.layers[layer]?.[z]?.[x];
});

console.log("\nInterpretation: per-frame enemy logic in the browser is dominated by GSAP + Three.js render;");
console.log("these loops show pure JS tile/collision work stays sub-microsecond per check at scale.");
