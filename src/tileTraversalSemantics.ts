/**
 * # Multi-layer tile semantics (authoring + runtime contract)
 *
 * These rules are enforced in `createRuntimeLevel` via `validateLevelTraversalSemantics`
 * and implemented at play time through `verticalTraversal` + `MazeGame`.
 *
 * ## Coordinate system
 * - **Layer index 0** is the lowest physical deck; **higher indices** stack upward in world space.
 * - **Horizontal moves** change `(x, z)` on the **current layer** only.
 *
 * ## Spawn (`start`) and exit (`finish`)
 * - Both must reference **floor (`0`) or ladder (`"ladder"`)** cells — never walls or holes.
 * - `GameSnapshot.currentTile` treats the cell matching `start` / `finish` as `"start"` / `"exit"`
 *   regardless of underlying glyph so the HUD can show beacon vs spawn state clearly.
 *
 * ## Ladders (`"ladder"`)
 * - A ladder tile must stack with another ladder on **layer ± 1** at the same `(x, z)` (vertical shaft).
 * - **Ascent / descent** is explicit (`climbUp` / `climbDown`, or `E` / `Q` / Page keys): the player must
 *   stand on a ladder and the adjacent layer at the same grid cell must also be a ladder.
 * - Ladders do **not** auto-trigger from horizontal moves; this avoids accidental floor changes.
 *
 * ## Holes (`"hole"`)
 * - Holes are **walkable** for horizontal entry (they behave as open cells with a drop animation).
 * - Entering a hole resolves a **vertical shaft** at the same `(x, z)`: the player falls through
 *   consecutive hole layers until the first **non-hole** cell, which must be **stable** (floor or ladder).
 * - If the shaft would leave the world or land on a wall, the level fails validation at load time.
 *
 * ## Enemy patrols
 * - Waypoints must sit on anchor tiles (floor or ladder), stay on a **single layer**, and move one
 *   Manhattan step at a time. Collisions compare full `(x, z, layer)` with the player.
 *
 * ## Visual / UX cues (active deck)
 * - The deck matching `visualCell.layer` (the cell shown mid-tween) is the only rendered maze deck;
 *   layer-scoped props like the exit beacon or enemy render only on that active floor.
 * - Exit uses a green beacon; spawn uses a cyan floor ring for quick orientation.
 */

export {
  canClimbBetweenLayers,
  resolveHorizontalTraversal,
  resolveVerticalTraversal,
} from "./verticalTraversal";

export {
  isAnchorTile,
  isStableTile,
  resolveHoleLanding,
  validateLevelTraversalSemantics,
} from "./levelRuntime";
