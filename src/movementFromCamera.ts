export type Direction = "forward" | "backward" | "left" | "right";

/** Maze grid step matching `MazeGame` move offsets: +x east, +z south (increasing row index). */
export type GridDelta = { dx: number; dz: number };

const GRID_DELTA_BY_DIRECTION: Record<Direction, GridDelta> = {
  forward: { dx: 0, dz: -1 },
  backward: { dx: 0, dz: 1 },
  left: { dx: -1, dz: 0 },
  right: { dx: 1, dz: 0 },
};

const DIRECTION_BY_DELTA: Record<string, Direction> = {
  "0,-1": "forward",
  "0,1": "backward",
  "-1,0": "left",
  "1,0": "right",
};

export type MovementYawMode = "continuous" | "snap90";

/**
 * Horizontal camera basis derived from `MazeGame` orbit math:
 * camera offset on XZ is (sin(yaw)*flat, cos(yaw)*flat), look-at pulls view toward the player.
 * "Into the screen" on the ground plane is opposite that offset direction.
 */
export function cameraGroundBasis(cameraYaw: number): {
  forwardXZ: { x: number; z: number };
  rightXZ: { x: number; z: number };
} {
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  return {
    forwardXZ: { x: -sin, z: -cos },
    rightXZ: { x: cos, z: -sin },
  };
}

export function effectiveYawForMovement(cameraYaw: number, mode: MovementYawMode): number {
  if (mode === "continuous") return cameraYaw;
  const quarter = Math.PI / 2;
  return Math.round(cameraYaw / quarter) * quarter;
}

/**
 * Maps a screen-relative move intent to a grid `Direction` using camera yaw.
 * World X/Z align with grid x/z; result is always one of four cardinals.
 */
export function mapIntentToDirection(
  cameraYaw: number,
  intent: Direction,
  mode: MovementYawMode = "continuous",
): Direction {
  const yaw = effectiveYawForMovement(cameraYaw, mode);
  const { forwardXZ, rightXZ } = cameraGroundBasis(yaw);

  let wx = 0;
  let wz = 0;
  switch (intent) {
    case "forward":
      wx = forwardXZ.x;
      wz = forwardXZ.z;
      break;
    case "backward":
      wx = -forwardXZ.x;
      wz = -forwardXZ.z;
      break;
    case "left":
      wx = -rightXZ.x;
      wz = -rightXZ.z;
      break;
    case "right":
      wx = rightXZ.x;
      wz = rightXZ.z;
      break;
  }

  const delta = quantizeWorldXZToCardinal(wx, wz);
  const key = `${delta.dx},${delta.dz}`;
  return DIRECTION_BY_DELTA[key] ?? "forward";
}

export function directionToGridDelta(direction: Direction): GridDelta {
  return GRID_DELTA_BY_DIRECTION[direction];
}

export function resolveIntentToGridDelta(
  cameraYaw: number,
  intent: Direction,
  mode: MovementYawMode = "continuous",
): GridDelta {
  return directionToGridDelta(mapIntentToDirection(cameraYaw, intent, mode));
}

function quantizeWorldXZToCardinal(wx: number, wz: number): GridDelta {
  const ax = Math.abs(wx);
  const az = Math.abs(wz);
  const tieEps = 1e-6;
  if (ax < tieEps && az < tieEps) {
    return { dx: 0, dz: -1 };
  }
  if (ax > az + tieEps) {
    return { dx: Math.sign(wx) as -1 | 1, dz: 0 };
  }
  if (az > ax + tieEps) {
    return { dx: 0, dz: Math.sign(wz) as -1 | 1 };
  }
  // Tie on 45° diagonals: prefer depth (z) so up/down screen intent stays stable at snap boundaries.
  return az >= ax ? { dx: 0, dz: Math.sign(wz) as -1 | 1 } : { dx: Math.sign(wx) as -1 | 1, dz: 0 };
}

/** For tests / HUD: which grid step each intent resolves to at this yaw. */
export function intentMappingTable(
  cameraYaw: number,
  mode: MovementYawMode,
): Record<Direction, Direction> {
  return {
    forward: mapIntentToDirection(cameraYaw, "forward", mode),
    backward: mapIntentToDirection(cameraYaw, "backward", mode),
    left: mapIntentToDirection(cameraYaw, "left", mode),
    right: mapIntentToDirection(cameraYaw, "right", mode),
  };
}
