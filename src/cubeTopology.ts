export type CubeFace = "north" | "east" | "south" | "west" | "top" | "bottom";
export type CubeMoveEdge = "left" | "right" | "up" | "down";

export interface CubeSeamTransition {
  fromFace: CubeFace;
  toFace: CubeFace;
  edge: CubeMoveEdge;
}

export interface CubeStepResult {
  x: number;
  z: number;
  face: CubeFace;
  seam: CubeSeamTransition | null;
}

type Axis = -1 | 0 | 1;

interface AxisVector {
  x: Axis;
  y: Axis;
  z: Axis;
}

interface CubeFaceOrientation {
  normal: AxisVector;
  right: AxisVector;
  down: AxisVector;
}

interface CubeFaceNeighborMap {
  left: CubeFace;
  right: CubeFace;
  up: CubeFace;
  down: CubeFace;
}

const ZERO_VECTOR = { x: 0, y: 0, z: 0 } as const satisfies AxisVector;

export const CUBE_FACES = [
  "north",
  "east",
  "south",
  "west",
  "top",
  "bottom",
] as const satisfies readonly CubeFace[];

export const CUBE_FACE_LABELS: Record<CubeFace, string> = {
  north: "North face",
  east: "East face",
  south: "South face",
  west: "West face",
  top: "Top face",
  bottom: "Bottom face",
};

const FACE_ORIENTATION: Record<CubeFace, CubeFaceOrientation> = {
  north: {
    normal: { x: 0, y: 0, z: 1 },
    right: { x: 1, y: 0, z: 0 },
    down: { x: 0, y: -1, z: 0 },
  },
  east: {
    normal: { x: 1, y: 0, z: 0 },
    right: { x: 0, y: 0, z: -1 },
    down: { x: 0, y: -1, z: 0 },
  },
  south: {
    normal: { x: 0, y: 0, z: -1 },
    right: { x: -1, y: 0, z: 0 },
    down: { x: 0, y: -1, z: 0 },
  },
  west: {
    normal: { x: -1, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 1 },
    down: { x: 0, y: -1, z: 0 },
  },
  top: {
    normal: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    down: { x: 0, y: 0, z: 1 },
  },
  bottom: {
    normal: { x: 0, y: -1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    down: { x: 0, y: 0, z: -1 },
  },
};

function negate(vector: AxisVector): AxisVector {
  return { x: (vector.x * -1) as Axis, y: (vector.y * -1) as Axis, z: (vector.z * -1) as Axis };
}

function equals(left: AxisVector, right: AxisVector) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function add(left: AxisVector, right: AxisVector): AxisVector {
  return {
    x: (left.x + right.x) as Axis,
    y: (left.y + right.y) as Axis,
    z: (left.z + right.z) as Axis,
  };
}

function faceForNormal(normal: AxisVector): CubeFace {
  const found = CUBE_FACES.find((face) => equals(FACE_ORIENTATION[face].normal, normal));
  if (!found) {
    throw new Error(`Unsupported cube normal (${normal.x}, ${normal.y}, ${normal.z}).`);
  }
  return found;
}

function getStepVector(face: CubeFace, edge: CubeMoveEdge): AxisVector {
  const orientation = FACE_ORIENTATION[face];
  switch (edge) {
    case "left":
      return negate(orientation.right);
    case "right":
      return orientation.right;
    case "up":
      return negate(orientation.down);
    case "down":
      return orientation.down;
  }
}

function getEdgeAxis(face: CubeFace, edge: CubeMoveEdge): AxisVector {
  const orientation = FACE_ORIENTATION[face];
  return edge === "left" || edge === "right" ? orientation.down : orientation.right;
}

function getEnterEdge(toFace: CubeFace, fromFace: CubeFace): CubeMoveEdge {
  const toOrientation = FACE_ORIENTATION[toFace];
  const fromNormal = FACE_ORIENTATION[fromFace].normal;

  if (equals(fromNormal, negate(toOrientation.right))) return "left";
  if (equals(fromNormal, toOrientation.right)) return "right";
  if (equals(fromNormal, negate(toOrientation.down))) return "up";
  if (equals(fromNormal, toOrientation.down)) return "down";

  throw new Error(`Faces ${fromFace} and ${toFace} do not share an edge.`);
}

function reverseIndex(index: number, size: number) {
  return size - 1 - index;
}

function applyEnterEdge(enterEdge: CubeMoveEdge, fixed: number, sliding: number) {
  switch (enterEdge) {
    case "left":
    case "right":
      return { x: fixed, z: sliding };
    case "up":
    case "down":
      return { x: sliding, z: fixed };
  }
}

export function getCubeFaceNeighbors(face: CubeFace): CubeFaceNeighborMap {
  return {
    left: faceForNormal(getStepVector(face, "left")),
    right: faceForNormal(getStepVector(face, "right")),
    up: faceForNormal(getStepVector(face, "up")),
    down: faceForNormal(getStepVector(face, "down")),
  };
}

export function resolveCubeStep(face: CubeFace, x: number, z: number, dx: number, dz: number, size: number): CubeStepResult {
  const nextX = x + dx;
  const nextZ = z + dz;

  if (nextX >= 0 && nextX < size && nextZ >= 0 && nextZ < size) {
    return { face, x: nextX, z: nextZ, seam: null };
  }

  const edge: CubeMoveEdge =
    nextX < 0 ? "left" :
    nextX >= size ? "right" :
    nextZ < 0 ? "up" :
    "down";
  const toFace = faceForNormal(getStepVector(face, edge));
  const enterEdge = getEnterEdge(toFace, face);
  const fromEdgeAxis = getEdgeAxis(face, edge);
  const toEdgeAxis = getEdgeAxis(toFace, enterEdge);
  const parameter = edge === "left" || edge === "right" ? z : x;
  const sliding = equals(fromEdgeAxis, toEdgeAxis) ? parameter : reverseIndex(parameter, size);
  const fixed = enterEdge === "left" || enterEdge === "up" ? 0 : size - 1;
  const destination = applyEnterEdge(enterEdge, fixed, sliding);

  return {
    face: toFace,
    x: destination.x,
    z: destination.z,
    seam: {
      fromFace: face,
      toFace,
      edge,
    },
  };
}

export function getCubeFaceOrientation(face: CubeFace) {
  return FACE_ORIENTATION[face] ?? {
    normal: ZERO_VECTOR,
    right: ZERO_VECTOR,
    down: ZERO_VECTOR,
  };
}
