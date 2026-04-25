# Layered level format

## Current baseline

`src/MazeGame.tsx` currently hardcodes:

- one 2D maze grid: `const maze: Cell[][]`
- one start coordinate: `const start = { x, z }`
- one finish coordinate: `const finish = { x, z }`
- player runtime position as `{ x, z }`

Movement and collision are already tile-based, so the minimal extension is to keep the grid model and only add:

1. a `layers` array instead of a single grid
2. a small tile alphabet instead of `0 | 1`
3. `layer` on the player position/state

## Recommended authoring schema

Use row strings for authored levels, then normalize them into parsed tile arrays at load time.

```ts
export type TileId = "#" | "." | "S" | "E" | "L" | "O";

export type LayerRows = string[];

export interface LevelDefinition {
  id: string;
  name: string;
  layers: LayerRows[];
}
```

### Tile identifiers

| Tile | Meaning | Walkable | Layer change |
| --- | --- | --- | --- |
| `#` | Wall / blocked tile | No | None |
| `.` | Normal floor | Yes | None |
| `S` | Spawn tile | Yes | None |
| `E` | Exit tile | Yes | None |
| `L` | Ladder tile | Yes | Explicit vertical move |
| `O` | Hole tile | Enterable, but not stable | Automatic fall down |

## Structural rules

### Level-wide rules

- `layers.length >= 1`
- `layers[0]` is the lowest floor; larger layer indexes are higher floors.
- Every layer must have the same row count.
- Every row in every layer must have the same width.
- Out-of-bounds coordinates are always blocked.
- Exactly one `S` and exactly one `E` must exist across the full level, not per layer.

### Spawn and exit constraints

- `S` must be on a stable tile and may not share ladder or hole behavior.
- `E` must be on a stable tile and may not share ladder or hole behavior.
- `S` and `E` should not be placed on the same coordinate on different layers; treat that as invalid authoring because it makes progression ambiguous.

### Ladder constraints

- A ladder is represented by `L`.
- Ladder traversal only happens at the same `{ x, z }`.
- Ladders are explicit, not automatic: the player must trigger climb up/down while standing on `L`.
- A valid ladder move requires the destination layer to exist and the destination tile at the same `{ x, z }` to also be `L`.
- Consecutive `L` tiles at the same `{ x, z }` form a ladder shaft across multiple floors.

### Hole constraints

- A hole is represented by `O`.
- A hole is one-way downward traversal.
- Entering `O` immediately resolves a fall to `{ layer - 1, x, z }`.
- The destination layer must exist.
- The destination tile must be stable and walkable (`.`, `S`, `E`, or `L`).
- Do not allow a hole to fall into `#` or outside the level.
- Do not place `O` on the bottom layer.

## Adjacency and traversal semantics

### Horizontal adjacency

For a player position `{ layer, x, z }`, the four horizontal neighbors are:

- `{ layer, x + 1, z }`
- `{ layer, x - 1, z }`
- `{ layer, x, z + 1 }`
- `{ layer, x, z - 1 }`

Horizontal moves are valid when the destination tile on the current layer is one of:

- `.`
- `S`
- `E`
- `L`
- `O`

After entering the destination tile:

- `.` / `S` / `E` / `L`: player remains on that tile
- `O`: immediately apply hole resolution and move the player down one layer

### Vertical adjacency

Vertical transitions never change `x` or `z`.

### Ladder up

From `{ layer, x, z }` on `L`, an up move targets `{ layer + 1, x, z }`.

### Ladder down

From `{ layer, x, z }` on `L`, a down move targets `{ layer - 1, x, z }`.

### Hole fall

From `{ layer, x, z }` on `O`, resolve immediately to `{ layer - 1, x, z }`.

## Runtime state shape

The current floor should live in the same source-of-truth object as the player's grid position.

```ts
export interface GridPosition {
  layer: number;
  x: number;
  z: number;
}

export interface ActiveLevelState {
  levelId: string;
  playerCell: GridPosition;
  moves: number;
  completed: boolean;
}
```

### Storage guidance

- Replace the current `{ x, z }` player cell with `{ layer, x, z }`.
- Derive the "current layer" UI from `playerCell.layer`; do not keep a second independent `currentLayer` value that can drift.
- Store the parsed spawn and exit positions as full `GridPosition` values.
- Keep level geometry immutable after load; only runtime entities should move.

## Minimal migration from the current code

The smallest implementation-compatible change from the current file is:

```ts
type ParsedLevel = {
  layers: TileId[][][];
  spawn: GridPosition;
  exit: GridPosition;
};
```

With that shape:

- `maze[z][x] === 0` becomes `level.layers[layer][z][x] !== "#"`
- `start` becomes `spawn`
- `finish` becomes `exit`
- `playerCell` gains `layer`
- `gridToWorld()` keeps `x`/`z` logic and adds a fixed vertical offset per layer

## Example

```ts
export const level1: LevelDefinition = {
  id: "level-1",
  name: "Entry Run",
  layers: [
    [
      "#######",
      "#S...L#",
      "#.###.#",
      "#...#.#",
      "###.#E#",
      "#.....#",
      "#######",
    ],
    [
      "#######",
      "#....L#",
      "#.###.#",
      "#..O#.#",
      "###.#.#",
      "#.....#",
      "#######",
    ],
  ],
};
```

In that example:

- the ladder at `{ x: 5, z: 1 }` connects both layers
- the hole at layer `1` drops to layer `0` at the same `{ x, z }`
- the exit remains a normal stable tile, not a traversal tile

## Validation checklist

When parsing authored levels, reject the level if any of these fail:

1. Non-rectangular rows or mismatched layer dimensions
2. Unknown tile identifiers
3. Missing or duplicate `S`
4. Missing or duplicate `E`
5. `O` on bottom layer
6. `O` with an invalid landing tile
7. Any non-isolated `L` that points to a non-`L` tile on an adjacent layer

This keeps the format small, preserves the current grid-first architecture, and gives later implementation work a single set of rules for movement, rendering, solvability checks, and level authoring.
