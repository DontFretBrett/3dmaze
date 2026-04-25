import { useEffect, useRef } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { ACTIVE_LEVEL } from "./campaign/levelDefinitions";
import { PLAYER_MOVE_SECONDS } from "./enemyDesign";
import {
  createEnemyState,
  finalizeEnemyStep,
  planEnemyStep,
  resolveEnemyCollision,
  type EnemyRuntimeState,
} from "./enemyRuntime";
import {
  createRuntimeLevel,
  getTileAt,
  type LevelCoordinate,
  type LevelDefinition,
  type RuntimeLevel,
} from "./levelRuntime";
import { describeCurrentTile } from "./gameSnapshot";
import { resolveIntentToGridDelta, type MovementYawMode } from "./movementFromCamera";
import { CELL_SIZE } from "./mazeLayout";
import { attachPerfHud, createSectionTimer, RollingFrameStats } from "./perfProbe";
import {
  canClimbBetweenLayers,
  resolveHorizontalTraversal,
  resolveVerticalTraversal,
  type TraversalSegment,
} from "./verticalTraversal";
import { getLayerPresentation, shouldRenderActorOnLayer } from "./sceneLayerPresentation";

export type Direction = "forward" | "backward" | "left" | "right";
export type CurrentTileKind = "start" | "exit" | "floor" | "ladder" | "hole";

export interface GameSnapshot {
  moves: number;
  time: number;
  completed: boolean;
  failed: boolean;
  bestTime: number | null;
  contacts: number;
  isStunned: boolean;
  layer: number;
  layerCount: number;
  currentTile: CurrentTileKind;
  canClimbUp: boolean;
  canClimbDown: boolean;
}

interface MazeGameProps {
  level?: LevelDefinition;
  onReady: (api: {
    move: (direction: Direction) => void;
    restart: () => void;
    resetView: () => void;
    climbUp: () => void;
    climbDown: () => void;
  }) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
}

interface LayerMaterials {
  floor: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  path: THREE.MeshStandardMaterial;
  edge: THREE.LineBasicMaterial;
  deckFrame: THREE.LineBasicMaterial;
  ladderPad: THREE.MeshStandardMaterial;
  ladderBeam: THREE.MeshStandardMaterial;
  ladderSpine: THREE.MeshStandardMaterial;
  holeWell: THREE.MeshStandardMaterial;
  holeRing: THREE.MeshStandardMaterial;
  holeShaft: THREE.MeshStandardMaterial;
}

const layerHeight = 5.4;
const playerBaseHeight = 1.25;
const enemyBaseHeight = 1.05;
const defaultCameraYaw = Math.atan2(10, 11);
const defaultCameraPitch = Math.atan2(13, Math.hypot(10, 11));
const defaultCameraDistance = Math.hypot(10, 13, 11);
const minCameraPitch = 0.35;
const maxCameraPitch = 1.18;
const minCameraDistance = 10;
const maxCameraDistance = 30;
const rotationSpeed = 0.008;
const zoomSpeed = 0.016;
const cameraTargetHeight = 0.8;
const movementYawMode: MovementYawMode = "continuous";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gridToWorld(level: RuntimeLevel, cell: LevelCoordinate) {
  return new THREE.Vector3(
    (cell.x - (level.width - 1) / 2) * CELL_SIZE,
    cell.layer * layerHeight,
    (cell.z - (level.depth - 1) / 2) * CELL_SIZE,
  );
}

function getTileCuePalette(tile: CurrentTileKind) {
  switch (tile) {
    case "start":
      return { ring: "#6beeff", fill: "#2ec8ff", ringOpacity: 0.96, fillOpacity: 0.2 };
    case "exit":
      return { ring: "#54ff99", fill: "#33ff84", ringOpacity: 1, fillOpacity: 0.22 };
    case "ladder":
      return { ring: "#8cf7ff", fill: "#56daff", ringOpacity: 0.98, fillOpacity: 0.24 };
    case "hole":
      return { ring: "#ffbf72", fill: "#ff922b", ringOpacity: 1, fillOpacity: 0.26 };
    default:
      return { ring: "#8ff2cf", fill: "#3ae2a1", ringOpacity: 0.72, fillOpacity: 0.12 };
  }
}

function createLayerMaterials(): LayerMaterials {
  return {
    floor: new THREE.MeshStandardMaterial({
      color: "#0b1a17",
      emissive: "#0b1a17",
      emissiveIntensity: 0.42,
      roughness: 0.8,
      metalness: 0.12,
      transparent: true,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: "#102d37",
      emissive: "#071c22",
      emissiveIntensity: 0.58,
      roughness: 0.45,
      metalness: 0.45,
      transparent: true,
    }),
    path: new THREE.MeshStandardMaterial({
      color: "#12322b",
      emissive: "#0d221d",
      emissiveIntensity: 0.18,
      roughness: 0.68,
      metalness: 0.2,
      transparent: true,
    }),
    edge: new THREE.LineBasicMaterial({
      color: "#1effc2",
      transparent: true,
      opacity: 0.28,
    }),
    deckFrame: new THREE.LineBasicMaterial({
      color: "#3ce3d8",
      transparent: true,
      opacity: 0.2,
    }),
    ladderPad: new THREE.MeshStandardMaterial({
      color: "#6beeff",
      emissive: "#30d9ff",
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
    }),
    ladderBeam: new THREE.MeshStandardMaterial({
      color: "#c8fcff",
      emissive: "#58ebff",
      emissiveIntensity: 1.35,
      roughness: 0.18,
      metalness: 0.48,
      transparent: true,
    }),
    ladderSpine: new THREE.MeshStandardMaterial({
      color: "#9cf8ff",
      emissive: "#44deff",
      emissiveIntensity: 1,
      roughness: 0.16,
      metalness: 0.46,
      transparent: true,
    }),
    holeWell: new THREE.MeshStandardMaterial({
      color: "#040707",
      emissive: "#090d0d",
      emissiveIntensity: 0.25,
      roughness: 0.92,
      metalness: 0.05,
      transparent: true,
    }),
    holeRing: new THREE.MeshStandardMaterial({
      color: "#ffb357",
      emissive: "#ff8a14",
      emissiveIntensity: 1.55,
      roughness: 0.2,
      metalness: 0.38,
      transparent: true,
    }),
    holeShaft: new THREE.MeshStandardMaterial({
      color: "#7c4512",
      emissive: "#ff922b",
      emissiveIntensity: 0.92,
      roughness: 0.42,
      metalness: 0.2,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    }),
  };
}

function refreshLayerVisuals(layerMaterials: LayerMaterials[], activeLayer: number) {
  layerMaterials.forEach((materials, layerIndex) => {
    const { isActive } = getLayerPresentation(layerIndex, activeLayer);
    const fade = isActive ? 1 : 0.3;

    materials.floor.opacity = isActive ? 0.96 : 0.26;
    materials.floor.emissiveIntensity = isActive ? 0.95 : 0.18;
    materials.floor.color.set(isActive ? "#0d2722" : "#071311");
    materials.floor.emissive.set(isActive ? "#14483e" : "#081310");

    materials.wall.opacity = isActive ? 0.96 : 0.2;
    materials.wall.emissiveIntensity = isActive ? 0.72 : 0.2;

    materials.path.opacity = isActive ? 0.94 : 0.2;
    materials.path.emissiveIntensity = isActive ? 0.42 : 0.08;
    materials.path.color.set(isActive ? "#154036" : "#0d2621");

    materials.edge.opacity = isActive ? 0.3 : 0.06;
    materials.deckFrame.opacity = isActive ? 0.52 : 0.08;
    materials.deckFrame.color.set(isActive ? "#7ef4ff" : "#174943");
    materials.ladderPad.opacity = isActive ? 0.98 : 0.4;
    materials.ladderBeam.opacity = isActive ? 0.92 : 0.24;
    materials.ladderSpine.opacity = isActive ? 0.84 : 0.18;
    materials.holeWell.opacity = isActive ? 0.96 : 0.34;
    materials.holeRing.opacity = isActive ? 0.98 : 0.42;
    materials.holeShaft.opacity = isActive ? 0.6 : 0.16;

    if (!isActive) {
      materials.ladderPad.emissiveIntensity = 0.75 * fade;
      materials.ladderBeam.emissiveIntensity = 0.82 * fade;
      materials.ladderSpine.emissiveIntensity = 0.62 * fade;
      materials.holeRing.emissiveIntensity = 0.9 * fade;
      materials.holeShaft.emissiveIntensity = 0.5 * fade;
    } else {
      materials.ladderPad.emissiveIntensity = 1.2;
      materials.ladderBeam.emissiveIntensity = 1.35;
      materials.ladderSpine.emissiveIntensity = 1;
      materials.holeRing.emissiveIntensity = 1.55;
      materials.holeShaft.emissiveIntensity = 0.92;
    }
  });
}

export function MazeGame({ level = ACTIVE_LEVEL, onReady, onSnapshot }: MazeGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const runtimeLevel = createRuntimeLevel(level);
    const storageKey = `neon-labyrinth-best:${runtimeLevel.id}`;

    const getBestTime = () => {
      const value = window.localStorage.getItem(storageKey);
      return value ? Number(value) : null;
    };

    const perfParams = new URLSearchParams(window.location.search);
    const perfEnabled = perfParams.has("perf");
    const forceNoEnemy = perfParams.has("noEnemy");
    const stressCopies = clamp(parseInt(perfParams.get("stressCopies") ?? "0", 10) || 0, 0, 6);
    const enemyFeatureEnabled = Boolean(runtimeLevel.enemy) && !forceNoEnemy;

    let animationFrame = 0;
    let moves = 0;
    let completed = false;
    let failed = false;
    let startTime = performance.now();
    let currentTime = 0;
    let contacts = 0;
    let playerCell: LevelCoordinate = { ...runtimeLevel.start };
    let visualCell: LevelCoordinate = { ...runtimeLevel.start };
    let playerTween: gsap.core.Animation | null = null;
    let enemyTween: gsap.core.Tween | null = null;
    let enemyState: EnemyRuntimeState | null = enemyFeatureEnabled ? createEnemyState(runtimeLevel, startTime) : null;
    let cameraYaw = defaultCameraYaw;
    let cameraPitch = defaultCameraPitch;
    let cameraDistance = defaultCameraDistance;
    let pinchDistance = 0;
    const activePointers = new Map<number, { x: number; y: number }>();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07110f");
    scene.fog = new THREE.Fog("#07110f", 18, 66 + stressCopies * 28);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120 + stressCopies * 40);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.HemisphereLight("#b4fff0", "#11251f", 1.45);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight("#d9fff5", 2);
    keyLight.position.set(-18, 32, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const finishWorld = gridToWorld(runtimeLevel, runtimeLevel.finish);
    const startWorld = gridToWorld(runtimeLevel, runtimeLevel.start);
    const beaconLight = new THREE.PointLight("#42ff99", 7.5, 30);
    beaconLight.position.set(finishWorld.x, finishWorld.y + 3.5, finishWorld.z);
    scene.add(beaconLight);

    const layerMaterials = runtimeLevel.layers.map(() => createLayerMaterials());
    const layerGroups = runtimeLevel.layers.map(() => [] as THREE.Group[]);
    const floorGeometry = new THREE.BoxGeometry(runtimeLevel.width * CELL_SIZE, 0.28, runtimeLevel.depth * CELL_SIZE);
    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, 3.2, CELL_SIZE);
    const pathGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.9, 0.08, CELL_SIZE * 0.9);
    const edgeGeometry = new THREE.EdgesGeometry(wallGeometry);
    const deckFrameGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(runtimeLevel.width * CELL_SIZE + 0.48, 0.4, runtimeLevel.depth * CELL_SIZE + 0.48),
    );
    const ladderPadGeometry = new THREE.CylinderGeometry(0.78, 0.78, 0.18, 24);
    const ladderBeamGeometry = new THREE.CylinderGeometry(0.14, 0.14, 2.2, 10);
    const ladderSpineGeometry = new THREE.CylinderGeometry(0.18, 0.18, layerHeight - 0.48, 12);
    const holeWellGeometry = new THREE.CylinderGeometry(CELL_SIZE * 0.28, CELL_SIZE * 0.34, 0.12, 28);
    const holeRingGeometry = new THREE.TorusGeometry(0.84, 0.08, 12, 32);
    const holeShaftGeometry = new THREE.CylinderGeometry(
      CELL_SIZE * 0.24,
      CELL_SIZE * 0.3,
      layerHeight - 0.46,
      22,
      1,
      true,
    );

    const stressStackSpacing = runtimeLevel.layerCount * layerHeight + 8;
    for (let stack = 0; stack <= stressCopies; stack += 1) {
      const stackY = stack * stressStackSpacing;
      runtimeLevel.layers.forEach((layer, layerIndex) => {
        const baseY = stackY + layerIndex * layerHeight;
        const materials = layerMaterials[layerIndex];
        const layerGroup = new THREE.Group();
        layerGroups[layerIndex]?.push(layerGroup);
        scene.add(layerGroup);

        const floor = new THREE.Mesh(floorGeometry, materials.floor);
        floor.position.y = baseY - 0.18;
        floor.receiveShadow = true;
        layerGroup.add(floor);

        const deckFrame = new THREE.LineSegments(deckFrameGeometry, materials.deckFrame);
        deckFrame.position.set(0, baseY + 0.02, 0);
        layerGroup.add(deckFrame);

        layer.forEach((row, z) => {
          row.forEach((tile, x) => {
            const world = gridToWorld(runtimeLevel, { x, z, layer: layerIndex });
            world.y += stackY;

            if (tile === 1) {
              const wall = new THREE.Mesh(wallGeometry, materials.wall);
              wall.position.set(world.x, baseY + 1.42, world.z);
              wall.castShadow = true;
              wall.receiveShadow = true;
              layerGroup.add(wall);

              const edge = new THREE.LineSegments(edgeGeometry, materials.edge);
              edge.position.copy(wall.position);
              layerGroup.add(edge);
              return;
            }

            const pathTile = new THREE.Mesh(pathGeometry, materials.path);
            pathTile.position.set(world.x, baseY + 0.02, world.z);
            pathTile.receiveShadow = true;
            layerGroup.add(pathTile);

            if (tile === "ladder") {
              const ladderPad = new THREE.Mesh(ladderPadGeometry, materials.ladderPad);
              ladderPad.position.set(world.x, baseY + 0.14, world.z);
              ladderPad.castShadow = true;
              ladderPad.receiveShadow = true;
              layerGroup.add(ladderPad);

              const ladderBeam = new THREE.Mesh(ladderBeamGeometry, materials.ladderBeam);
              ladderBeam.position.set(world.x, baseY + 1.2, world.z);
              ladderBeam.castShadow = true;
              layerGroup.add(ladderBeam);

              if (getTileAt(runtimeLevel, x, z, layerIndex + 1) === "ladder") {
                const ladderSpine = new THREE.Mesh(ladderSpineGeometry, materials.ladderSpine);
                ladderSpine.position.set(world.x, baseY + layerHeight / 2, world.z);
                ladderSpine.castShadow = true;
                ladderSpine.receiveShadow = true;
                layerGroup.add(ladderSpine);
              }
            }

            if (tile === "hole") {
              const holeWell = new THREE.Mesh(holeWellGeometry, materials.holeWell);
              holeWell.position.set(world.x, baseY + 0.06, world.z);
              holeWell.receiveShadow = true;
              layerGroup.add(holeWell);

              const holeRing = new THREE.Mesh(holeRingGeometry, materials.holeRing);
              holeRing.position.set(world.x, baseY + 0.18, world.z);
              holeRing.rotation.x = Math.PI / 2;
              layerGroup.add(holeRing);

              if (layerIndex > 0) {
                const holeShaft = new THREE.Mesh(holeShaftGeometry, materials.holeShaft);
                holeShaft.position.set(world.x, baseY - layerHeight / 2, world.z);
                holeShaft.receiveShadow = true;
                layerGroup.add(holeShaft);
              }
            }
          });
        });
      });
    }

    const playerRig = new THREE.Group();
    const player = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 1),
      new THREE.MeshStandardMaterial({
        color: "#60d7ff",
        emissive: "#128ec0",
        emissiveIntensity: 1.1,
        roughness: 0.22,
        metalness: 0.55,
      }),
    );
    player.position.y = playerBaseHeight;
    player.castShadow = true;
    playerRig.add(player);
    playerRig.position.copy(gridToWorld(runtimeLevel, playerCell));
    scene.add(playerRig);

    const enemyRig = new THREE.Group();
    const enemy = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.82, 0),
      new THREE.MeshStandardMaterial({
        color: "#ff6b5a",
        emissive: "#c02818",
        emissiveIntensity: 0.85,
        roughness: 0.35,
        metalness: 0.4,
      }),
    );
    enemy.position.y = enemyBaseHeight;
    enemy.castShadow = true;
    enemyRig.add(enemy);
    enemyRig.visible = enemyFeatureEnabled && !!enemyState;
    if (enemyState) {
      enemyRig.position.copy(gridToWorld(runtimeLevel, enemyState.cell));
    }
    scene.add(enemyRig);

    const startMaterial = new THREE.MeshStandardMaterial({
      color: "#6beeff",
      emissive: "#2bcfff",
      emissiveIntensity: 1.1,
      roughness: 0.16,
      metalness: 0.4,
      transparent: true,
      opacity: 0.94,
    });
    const startRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 10, 64), startMaterial);
    startRing.position.set(startWorld.x, startWorld.y + 0.2, startWorld.z);
    startRing.rotation.x = Math.PI / 2;
    scene.add(startRing);

    const finishMaterial = new THREE.MeshStandardMaterial({
      color: "#54ff99",
      emissive: "#2bff7b",
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.22, 32), finishMaterial);
    beacon.position.set(finishWorld.x, finishWorld.y + 0.2, finishWorld.z);
    scene.add(beacon);

    const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.055, 10, 72), finishMaterial);
    beaconRing.position.set(finishWorld.x, finishWorld.y + 0.7, finishWorld.z);
    beaconRing.rotation.x = Math.PI / 2;
    scene.add(beaconRing);
    const playerCueMaterial = new THREE.MeshBasicMaterial({
      color: "#8ff2cf",
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const playerCueFillMaterial = new THREE.MeshBasicMaterial({
      color: "#3ae2a1",
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const playerCueRing = new THREE.Mesh(new THREE.RingGeometry(0.84, 1.18, 40), playerCueMaterial);
    playerCueRing.rotation.x = -Math.PI / 2;
    playerCueRing.renderOrder = 3;
    scene.add(playerCueRing);

    const playerCueFill = new THREE.Mesh(new THREE.CircleGeometry(0.56, 28), playerCueFillMaterial);
    playerCueFill.rotation.x = -Math.PI / 2;
    playerCueFill.renderOrder = 2;
    scene.add(playerCueFill);
    const finishLayerObjects: THREE.Object3D[] = [beaconLight, beacon, beaconRing];
    const startLayerObjects: THREE.Object3D[] = [startRing];

    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(160 * 3);
    for (let index = 0; index < 160; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 52;
      particlePositions[index * 3 + 1] = Math.random() * (runtimeLevel.layerCount * layerHeight + 6) + 1;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 52;
    }
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({ color: "#b6fff1", size: 0.07, transparent: true, opacity: 0.5 }),
    );
    scene.add(particles);

    const cameraTarget = new THREE.Vector3();
    const desiredCameraPosition = new THREE.Vector3();
    const cameraOffset = new THREE.Vector3();
    const activePointerValues = () => Array.from(activePointers.values());

    const getPinchDistance = () => {
      const [first, second] = activePointerValues();
      if (!first || !second) return 0;
      return Math.hypot(first.x - second.x, first.y - second.y);
    };

    const publish = () => {
      onSnapshot({
        moves,
        time: currentTime,
        completed,
        failed,
        bestTime: getBestTime(),
        contacts,
        isStunned: false,
        layer: visualCell.layer,
        layerCount: runtimeLevel.layerCount,
        currentTile: describeCurrentTile(runtimeLevel, visualCell),
        canClimbUp: canClimbBetweenLayers(runtimeLevel, visualCell, 1),
        canClimbDown: canClimbBetweenLayers(runtimeLevel, visualCell, -1),
      });
    };

    const clearEnemyMotion = () => {
      enemyTween?.kill();
      enemyTween = null;
    };

    const syncActiveLayerScene = (activeLayer: number) => {
      refreshLayerVisuals(layerMaterials, activeLayer);

      layerGroups.forEach((groups, layerIndex) => {
        const presentation = getLayerPresentation(layerIndex, activeLayer);
        groups.forEach((group) => {
          group.visible = presentation.renderGeometry;
        });
      });

      const showFinishLayer = shouldRenderActorOnLayer(runtimeLevel.finish.layer, activeLayer);
      finishLayerObjects.forEach((object) => {
        object.visible = showFinishLayer;
      });

      const showStartLayer = shouldRenderActorOnLayer(runtimeLevel.start.layer, activeLayer);
      startLayerObjects.forEach((object) => {
        object.visible = showStartLayer;
      });

      enemyRig.visible =
        enemyFeatureEnabled &&
        !!enemyState &&
        shouldRenderActorOnLayer(enemyState.cell.layer, activeLayer);
    };

    const resetEnemy = (now = performance.now()) => {
      clearEnemyMotion();
      if (!enemyFeatureEnabled) {
        enemyState = null;
        enemyRig.visible = false;
        return;
      }

      enemyState = createEnemyState(runtimeLevel, now);
      enemyRig.visible = !!enemyState;
      if (!enemyState) return;

      enemyRig.position.copy(gridToWorld(runtimeLevel, enemyState.cell));
      gsap.set(enemy.rotation, { x: 0, y: 0, z: 0 });
    };

    const checkContact = () => {
      const collision = resolveEnemyCollision({
        contacts,
        completed,
        failed,
        playerMoving: Boolean(playerTween),
        playerCell,
        enemyState,
      });
      if (!collision) return;

      resolveContact(collision);
    };

    const resolveContact = (collision: { contacts: number; failed: boolean }) => {
      if (completed || !enemyState) return;

      failed = collision.failed;
      contacts = collision.contacts;

      playerTween?.kill();
      playerTween = null;
      visualCell = { ...playerCell };
      playerRig.position.copy(gridToWorld(runtimeLevel, playerCell));

      clearEnemyMotion();

      gsap.to(player.scale, { x: 1.22, y: 0.72, z: 1.22, duration: 0.1, yoyo: true, repeat: 1 });
      publish();
    };

    const updateEnemy = (now: number) => {
      if (!enemyFeatureEnabled || !enemyState || !runtimeLevel.enemy || completed || failed || enemyTween) return;
      const step = planEnemyStep(runtimeLevel, enemyState, now);
      if (!step) return;
      const world = gridToWorld(runtimeLevel, step.destination);

      enemyTween = gsap.to(enemyRig.position, {
        x: world.x,
        y: world.y,
        z: world.z,
        duration: step.durationSeconds,
        ease: "none",
        onComplete: () => {
          enemyTween = null;
          if (!runtimeLevel.enemy) return;
          enemyState = finalizeEnemyStep(runtimeLevel, step, performance.now());
          checkContact();
          publish();
        },
      });

      gsap.to(enemy.rotation, {
        y: step.rotationRadians,
        duration: step.rotationDurationSeconds,
        ease: "power1.out",
      });
    };

    const updateCamera = (instant = false) => {
      cameraTarget.set(playerRig.position.x, playerRig.position.y + cameraTargetHeight, playerRig.position.z);
      const flatDistance = Math.cos(cameraPitch) * cameraDistance;
      cameraOffset.set(
        Math.sin(cameraYaw) * flatDistance,
        Math.sin(cameraPitch) * cameraDistance,
        Math.cos(cameraYaw) * flatDistance,
      );
      desiredCameraPosition.copy(cameraTarget).add(cameraOffset);

      if (instant) {
        camera.position.copy(desiredCameraPosition);
      } else {
        camera.position.lerp(desiredCameraPosition, 0.14);
      }

      camera.lookAt(cameraTarget);
    };

    const resetView = () => {
      cameraYaw = defaultCameraYaw;
      cameraPitch = defaultCameraPitch;
      cameraDistance = defaultCameraDistance;
      updateCamera(true);
    };

    const updateZoom = (delta: number) => {
      cameraDistance = clamp(cameraDistance + delta, minCameraDistance, maxCameraDistance);
    };

    const complete = () => {
      completed = true;
      failed = false;
      clearEnemyMotion();
      const previous = getBestTime();
      if (previous === null || currentTime < previous) {
        window.localStorage.setItem(storageKey, String(currentTime));
      }
      gsap.to(beaconRing.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.45, yoyo: true, repeat: 1 });
      publish();
    };

    const finalizeMove = (destination: LevelCoordinate) => {
      playerTween = null;
      visualCell = { ...destination };
      checkContact();
      if (failed) {
        publish();
        return;
      }
      if (
        destination.layer === runtimeLevel.finish.layer &&
        destination.x === runtimeLevel.finish.x &&
        destination.z === runtimeLevel.finish.z
      ) {
        complete();
        return;
      }
      publish();
    };

    const animateRigTo = (segments: ReadonlyArray<TraversalSegment>, onComplete: () => void) => {
      const timeline = gsap.timeline({ onComplete });
      segments.forEach(({ target, duration, visualCell: segmentVisualCell }) => {
        const world = gridToWorld(runtimeLevel, target);
        timeline.call(() => {
          visualCell = { ...(segmentVisualCell ?? target) };
          publish();
        });
        timeline.to(playerRig.position, {
          x: world.x,
          y: world.y,
          z: world.z,
          duration,
          ease: "power2.inOut",
        });
      });
      playerTween = timeline;
    };

    const move = (intent: Direction) => {
      if (completed || failed || playerTween) return;

      const movement = resolveIntentToGridDelta(cameraYaw, intent, movementYawMode);
      const plan = resolveHorizontalTraversal(runtimeLevel, playerCell, movement.dx, movement.dz, PLAYER_MOVE_SECONDS);
      if (!plan) {
        gsap.to(player.scale, { x: 1.18, y: 0.84, z: 1.18, duration: 0.08, yoyo: true, repeat: 1 });
        return;
      }

      playerCell = plan.destination;
      moves += 1;
      animateRigTo(plan.segments, () => finalizeMove(plan.destination));
      gsap.to(player.rotation, {
        x: player.rotation.x + movement.dz * 1.8,
        z: player.rotation.z - movement.dx * 1.8,
        duration: PLAYER_MOVE_SECONDS,
        ease: "power2.inOut",
      });
    };

    const moveVertical = (delta: -1 | 1) => {
      if (completed || failed || playerTween) return;

      const plan = resolveVerticalTraversal(runtimeLevel, playerCell, delta, PLAYER_MOVE_SECONDS);
      if (!plan) {
        gsap.to(player.scale, { x: 1.14, y: 0.88, z: 1.14, duration: 0.08, yoyo: true, repeat: 1 });
        return;
      }

      playerCell = plan.destination;
      moves += 1;
      animateRigTo(plan.segments, () => finalizeMove(plan.destination));
      gsap.to(player.scale, {
        x: 1.08,
        y: 1.2,
        z: 1.08,
        duration: PLAYER_MOVE_SECONDS * 0.54,
        yoyo: true,
        repeat: 1,
      });
    };

    const restart = () => {
      completed = false;
      failed = false;
      moves = 0;
      currentTime = 0;
      startTime = performance.now();
      contacts = 0;
      playerCell = { ...runtimeLevel.start };
      visualCell = { ...runtimeLevel.start };
      playerTween?.kill();
      playerTween = null;
      playerRig.position.copy(gridToWorld(runtimeLevel, playerCell));
      gsap.set(player.rotation, { x: 0, y: 0, z: 0 });
      gsap.set(player.scale, { x: 1, y: 1, z: 1 });
      resetEnemy(startTime);
      updateCamera(false);
      publish();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "e" || event.key === "E" || event.key === "PageUp") {
        event.preventDefault();
        moveVertical(1);
        return;
      }

      if (event.key === "q" || event.key === "Q" || event.key === "PageDown") {
        event.preventDefault();
        moveVertical(-1);
        return;
      }

      const map: Record<string, Direction | undefined> = {
        ArrowUp: "forward",
        w: "forward",
        W: "forward",
        ArrowDown: "backward",
        s: "backward",
        S: "backward",
        ArrowLeft: "left",
        a: "left",
        A: "left",
        ArrowRight: "right",
        d: "right",
        D: "right",
      };
      const intent = map[event.key];
      if (intent) {
        event.preventDefault();
        move(intent);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      renderer.domElement.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointers.size === 2) {
        pinchDistance = getPinchDistance();
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const previous = activePointers.get(event.pointerId);
      if (!previous) return;

      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.preventDefault();

      if (activePointers.size === 1) {
        cameraYaw -= (event.clientX - previous.x) * rotationSpeed;
        cameraPitch = clamp(
          cameraPitch - (event.clientY - previous.y) * rotationSpeed,
          minCameraPitch,
          maxCameraPitch,
        );
        return;
      }

      if (activePointers.size === 2) {
        const nextPinchDistance = getPinchDistance();
        if (pinchDistance > 0 && nextPinchDistance > 0) {
          updateZoom((pinchDistance - nextPinchDistance) * zoomSpeed);
        }
        pinchDistance = nextPinchDistance;
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      pinchDistance = activePointers.size === 2 ? getPinchDistance() : 0;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateZoom(event.deltaY * 0.012);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    };

    const perfSections = ["time", "enemyAi", "playerBob", "enemyBob", "fx", "camera", "render"] as const;
    const rollingStats = perfEnabled ? new RollingFrameStats(180, perfSections) : null;
    let perfHud: ReturnType<typeof attachPerfHud> | null = null;
    let perfHudFrames = 0;
    let syncedActiveLayer = -1;
    if (perfEnabled) {
      perfHud = attachPerfHud(mount);
    }

    const animate = () => {
      const probe = perfEnabled ? createSectionTimer() : null;
      probe?.start();

      const now = performance.now();
      if (!completed && !failed) {
        currentTime = (now - startTime) / 1000;
      }
      probe?.slice("time");

      updateEnemy(now);
      probe?.slice("enemyAi");

      if (syncedActiveLayer !== visualCell.layer) {
        syncActiveLayerScene(visualCell.layer);
        syncedActiveLayer = visualCell.layer;
      }

      const currentTile = describeCurrentTile(runtimeLevel, visualCell);
      const tileCue = getTileCuePalette(currentTile);
      const cuePulse = Math.sin(now * 0.007);
      layerMaterials[visualCell.layer].deckFrame.opacity = 0.5 + cuePulse * 0.1;
      playerCueMaterial.color.set(tileCue.ring);
      playerCueMaterial.opacity = tileCue.ringOpacity;
      playerCueFillMaterial.color.set(tileCue.fill);
      playerCueFillMaterial.opacity = tileCue.fillOpacity;
      playerCueRing.position.set(playerRig.position.x, playerRig.position.y + 0.14, playerRig.position.z);
      playerCueFill.position.set(playerRig.position.x, playerRig.position.y + 0.12, playerRig.position.z);
      const cueScale = currentTile === "hole" ? 1.06 + cuePulse * 0.04 : 1;
      playerCueRing.scale.setScalar(cueScale);
      playerCueFill.scale.setScalar(cueScale);

      player.position.y = playerBaseHeight + Math.sin(now * 0.004) * 0.08;
      probe?.slice("playerBob");

      if (enemyFeatureEnabled && enemyState) {
        enemy.position.y = enemyBaseHeight + Math.sin(now * 0.005 + 1.1) * 0.06;
      }
      probe?.slice("enemyBob");

      startRing.rotation.z -= 0.012;
      beaconRing.rotation.z += 0.018;
      particles.rotation.y += 0.0008;
      probe?.slice("fx");

      updateCamera();
      probe?.slice("camera");

      renderer.render(scene, camera);
      probe?.slice("render");

      if (probe && rollingStats && perfHud) {
        const { totalMs, sections } = probe.finish();
        rollingStats.pushSample(totalMs, sections);
        perfHudFrames += 1;
        if (perfHudFrames % 30 === 0) {
          perfHud.update(rollingStats.snapshot());
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerEnd);
    renderer.domElement.addEventListener("pointercancel", handlePointerEnd);
    renderer.domElement.addEventListener("pointerleave", handlePointerEnd);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
    onReady({
      move,
      restart,
      resetView,
      climbUp: () => moveVertical(1),
      climbDown: () => moveVertical(-1),
    });
    resize();
    updateCamera(true);
    syncActiveLayerScene(visualCell.layer);
    syncedActiveLayer = visualCell.layer;
    publish();
    animate();

    const timer = window.setInterval(publish, 250);

    return () => {
      perfHud?.remove();
      window.clearInterval(timer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
      playerTween?.kill();
      clearEnemyMotion();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerEnd);
      renderer.domElement.removeEventListener("pointercancel", handlePointerEnd);
      renderer.domElement.removeEventListener("pointerleave", handlePointerEnd);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      renderer.dispose();

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const geometry = (object as THREE.Object3D & { geometry?: THREE.BufferGeometry }).geometry;
        if (geometry) geometries.add(geometry);

        const material = (object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(material)) {
          material.forEach((entry) => materials.add(entry));
        } else if (material) {
          materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());

      mount.removeChild(renderer.domElement);
    };
  }, [level, onReady, onSnapshot]);

  return <div className="maze-canvas" ref={mountRef} />;
}
