import { useEffect, useRef } from "react";
import gsap from "gsap";
import * as THREE from "three";

export type Direction = "forward" | "backward" | "left" | "right";

export interface GameSnapshot {
  moves: number;
  time: number;
  completed: boolean;
  bestTime: number | null;
}

interface MazeGameProps {
  onReady: (api: {
    move: (direction: Direction) => void;
    restart: () => void;
    resetView: () => void;
  }) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
}

type Cell = 0 | 1;

const maze: Cell[][] = [
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

const cellSize = 4;
const start = { x: 1, z: 1 };
const finish = { x: 9, z: 9 };
const storageKey = "neon-labyrinth-best";
const defaultCameraYaw = Math.atan2(10, 11);
const defaultCameraPitch = Math.atan2(13, Math.hypot(10, 11));
const defaultCameraDistance = Math.hypot(10, 13, 11);
const minCameraPitch = 0.35;
const maxCameraPitch = 1.18;
const minCameraDistance = 10;
const maxCameraDistance = 26;
const rotationSpeed = 0.008;
const zoomSpeed = 0.016;
const cameraTargetHeight = 0.8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gridToWorld(x: number, z: number) {
  return new THREE.Vector3(
    (x - (maze[0].length - 1) / 2) * cellSize,
    0,
    (z - (maze.length - 1) / 2) * cellSize,
  );
}

function canMove(x: number, z: number) {
  return maze[z]?.[x] === 0;
}

function getBestTime() {
  const value = window.localStorage.getItem(storageKey);
  return value ? Number(value) : null;
}

export function MazeGame({ onReady, onSnapshot }: MazeGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let animationFrame = 0;
    let moves = 0;
    let completed = false;
    let startTime = performance.now();
    let currentTime = 0;
    let playerCell = { ...start };
    let activeTween: gsap.core.Tween | null = null;
    let cameraYaw = defaultCameraYaw;
    let cameraPitch = defaultCameraPitch;
    let cameraDistance = defaultCameraDistance;
    let pinchDistance = 0;
    const activePointers = new Map<number, { x: number; y: number }>();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07110f");
    scene.fog = new THREE.Fog("#07110f", 18, 66);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.HemisphereLight("#b4fff0", "#11251f", 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight("#d9fff5", 2);
    keyLight.position.set(-18, 28, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const beaconLight = new THREE.PointLight("#42ff99", 7, 24);
    const beaconPosition = gridToWorld(finish.x, finish.z);
    beaconLight.position.set(beaconPosition.x, 3.5, beaconPosition.z);
    scene.add(beaconLight);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: "#0d221d",
      roughness: 0.75,
      metalness: 0.15,
    });
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: "#102d37",
      roughness: 0.45,
      metalness: 0.45,
      emissive: "#071c22",
      emissiveIntensity: 0.55,
    });
    const pathMaterial = new THREE.MeshStandardMaterial({
      color: "#12322b",
      roughness: 0.68,
      metalness: 0.2,
    });
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: "#60d7ff",
      emissive: "#128ec0",
      emissiveIntensity: 1.1,
      roughness: 0.22,
      metalness: 0.55,
    });
    const finishMaterial = new THREE.MeshStandardMaterial({
      color: "#54ff99",
      emissive: "#2bff7b",
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(maze[0].length * cellSize, 0.28, maze.length * cellSize),
      floorMaterial,
    );
    floor.position.y = -0.18;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallGeometry = new THREE.BoxGeometry(cellSize, 3.2, cellSize);
    const pathGeometry = new THREE.BoxGeometry(cellSize * 0.9, 0.08, cellSize * 0.9);
    const edgeGeometry = new THREE.EdgesGeometry(wallGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: "#1effc2", transparent: true, opacity: 0.28 });

    maze.forEach((row, z) => {
      row.forEach((cell, x) => {
        const position = gridToWorld(x, z);
        if (cell === 1) {
          const wall = new THREE.Mesh(wallGeometry, wallMaterial);
          wall.position.set(position.x, 1.42, position.z);
          wall.castShadow = true;
          wall.receiveShadow = true;
          scene.add(wall);

          const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
          edge.position.copy(wall.position);
          scene.add(edge);
        } else {
          const tile = new THREE.Mesh(pathGeometry, pathMaterial);
          tile.position.set(position.x, 0.02, position.z);
          tile.receiveShadow = true;
          scene.add(tile);
        }
      });
    });

    const player = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), playerMaterial);
    const playerStart = gridToWorld(start.x, start.z);
    player.position.set(playerStart.x, 1.25, playerStart.z);
    player.castShadow = true;
    scene.add(player);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.22, 32), finishMaterial);
    beacon.position.set(beaconPosition.x, 0.2, beaconPosition.z);
    scene.add(beacon);

    const beaconRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.055, 10, 72),
      finishMaterial,
    );
    beaconRing.position.set(beaconPosition.x, 0.7, beaconPosition.z);
    beaconRing.rotation.x = Math.PI / 2;
    scene.add(beaconRing);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(160 * 3);
    for (let index = 0; index < 160; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 52;
      particlePositions[index * 3 + 1] = Math.random() * 8 + 1;
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
        bestTime: getBestTime(),
      });
    };

    const updateCamera = (instant = false) => {
      cameraTarget.set(player.position.x, cameraTargetHeight, player.position.z);
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
      const previous = getBestTime();
      if (previous === null || currentTime < previous) {
        window.localStorage.setItem(storageKey, String(currentTime));
      }
      gsap.to(beaconRing.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.45, yoyo: true, repeat: 1 });
      publish();
    };

    const move = (direction: Direction) => {
      if (completed || activeTween) return;

      const offsets: Record<Direction, { x: number; z: number }> = {
        forward: { x: 0, z: -1 },
        backward: { x: 0, z: 1 },
        left: { x: -1, z: 0 },
        right: { x: 1, z: 0 },
      };
      const next = {
        x: playerCell.x + offsets[direction].x,
        z: playerCell.z + offsets[direction].z,
      };

      if (!canMove(next.x, next.z)) {
        gsap.to(player.scale, { x: 1.18, y: 0.84, z: 1.18, duration: 0.08, yoyo: true, repeat: 1 });
        return;
      }

      playerCell = next;
      moves += 1;
      const world = gridToWorld(next.x, next.z);
      activeTween = gsap.to(player.position, {
        x: world.x,
        z: world.z,
        duration: 0.38,
        ease: "power2.inOut",
        onComplete: () => {
          activeTween = null;
          if (next.x === finish.x && next.z === finish.z) complete();
          publish();
        },
      });
      gsap.to(player.rotation, {
        x: player.rotation.x + offsets[direction].z * 1.8,
        z: player.rotation.z - offsets[direction].x * 1.8,
        duration: 0.38,
        ease: "power2.inOut",
      });
      publish();
    };

    const restart = () => {
      completed = false;
      moves = 0;
      currentTime = 0;
      startTime = performance.now();
      playerCell = { ...start };
      const world = gridToWorld(start.x, start.z);
      activeTween?.kill();
      activeTween = null;
      gsap.set(player.position, { x: world.x, y: 1.25, z: world.z });
      gsap.set(player.rotation, { x: 0, y: 0, z: 0 });
      updateCamera(false);
      publish();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
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
      const direction = map[event.key];
      if (direction) {
        event.preventDefault();
        move(direction);
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

    const animate = () => {
      if (!completed) {
        currentTime = (performance.now() - startTime) / 1000;
      }
      player.position.y = 1.25 + Math.sin(performance.now() * 0.004) * 0.08;
      beaconRing.rotation.z += 0.018;
      particles.rotation.y += 0.0008;
      updateCamera();
      renderer.render(scene, camera);
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
    onReady({ move, restart, resetView });
    resize();
    updateCamera(true);
    publish();
    animate();

    const timer = window.setInterval(publish, 250);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
      activeTween?.kill();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerEnd);
      renderer.domElement.removeEventListener("pointercancel", handlePointerEnd);
      renderer.domElement.removeEventListener("pointerleave", handlePointerEnd);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [onReady, onSnapshot]);

  return <div className="maze-canvas" ref={mountRef} />;
}
