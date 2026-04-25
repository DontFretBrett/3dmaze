import {
  getTileAbove,
  getTileAt,
  getTileBelow,
  isWalkableTile,
  resolveHoleLanding,
  type LevelCoordinate,
  type RuntimeLevel,
} from "./levelRuntime";

export interface TraversalSegment {
  target: LevelCoordinate;
  duration: number;
  visualCell?: LevelCoordinate;
}

export interface TraversalPlan {
  destination: LevelCoordinate;
  segments: TraversalSegment[];
}

export function canClimbBetweenLayers(
  runtimeLevel: RuntimeLevel,
  position: LevelCoordinate,
  delta: -1 | 1,
) {
  if (getTileAt(runtimeLevel, position.x, position.z, position.layer) !== "ladder") {
    return false;
  }

  const target = delta === 1 ? getTileAbove(runtimeLevel, position) : getTileBelow(runtimeLevel, position);
  return target?.tile === "ladder";
}

export function resolveHorizontalTraversal(
  runtimeLevel: RuntimeLevel,
  position: LevelCoordinate,
  dx: number,
  dz: number,
  stepDuration: number,
): TraversalPlan | null {
  const entered = {
    x: position.x + dx,
    z: position.z + dz,
    layer: position.layer,
  } satisfies LevelCoordinate;

  if (!isWalkableTile(runtimeLevel, entered.x, entered.z, entered.layer)) {
    return null;
  }

  const landing = resolveHoleLanding(runtimeLevel, entered);
  if (!landing) {
    return null;
  }

  if (landing.x === entered.x && landing.z === entered.z && landing.layer === entered.layer) {
    return {
      destination: entered,
      segments: [{ target: entered, duration: stepDuration, visualCell: entered }],
    };
  }

  const segments: TraversalSegment[] = [{ target: entered, duration: stepDuration * 0.52, visualCell: entered }];
  for (let layer = entered.layer; layer > landing.layer; layer -= 1) {
    const stepTarget = { x: entered.x, z: entered.z, layer: layer - 1 } satisfies LevelCoordinate;
    segments.push({ target: stepTarget, duration: stepDuration * 0.68, visualCell: stepTarget });
  }

  return { destination: landing, segments };
}

export function resolveVerticalTraversal(
  runtimeLevel: RuntimeLevel,
  position: LevelCoordinate,
  delta: -1 | 1,
  stepDuration: number,
): TraversalPlan | null {
  if (!canClimbBetweenLayers(runtimeLevel, position, delta)) {
    return null;
  }

  const destination = {
    x: position.x,
    z: position.z,
    layer: position.layer + delta,
  } satisfies LevelCoordinate;

  return {
    destination,
    segments: [{ target: destination, duration: stepDuration * 1.08, visualCell: destination }],
  };
}
