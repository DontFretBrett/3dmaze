import { resolveCubeStep, type CubeSeamTransition } from "./cubeTopology";
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
  seam: CubeSeamTransition | null;
}

export function canClimbBetweenLayers(
  runtimeLevel: RuntimeLevel,
  position: LevelCoordinate,
  delta: -1 | 1,
) {
  if (getTileAt(runtimeLevel, position.x, position.z, position.layer, position.face) !== "ladder") {
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
  const entered: LevelCoordinate & { seam: CubeSeamTransition | null } = runtimeLevel.topology === "cube"
    ? {
        ...resolveCubeStep(position.face!, position.x, position.z, dx, dz, runtimeLevel.width),
        layer: position.layer,
      }
    : {
        x: position.x + dx,
        z: position.z + dz,
        layer: position.layer,
        face: undefined,
        seam: null,
      };

  if (!isWalkableTile(runtimeLevel, entered.x, entered.z, entered.layer, entered.face)) {
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
      seam: entered.seam,
    };
  }

  const segments: TraversalSegment[] = [{ target: entered, duration: stepDuration * 0.52, visualCell: entered }];
  for (let layer = entered.layer; layer > landing.layer; layer -= 1) {
    const stepTarget = {
      x: entered.x,
      z: entered.z,
      layer: layer - 1,
      ...(entered.face ? { face: entered.face } : {}),
    } satisfies LevelCoordinate;
    segments.push({ target: stepTarget, duration: stepDuration * 0.68, visualCell: stepTarget });
  }

  return { destination: landing, segments, seam: entered.seam };
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
    ...(position.face ? { face: position.face } : {}),
  } satisfies LevelCoordinate;

  return {
    destination,
    segments: [{ target: destination, duration: stepDuration * 1.08, visualCell: destination }],
    seam: null,
  };
}
