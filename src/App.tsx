import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react";
import type { Direction, GameSnapshot } from "./MazeGame";

const MazeGame = lazy(() =>
  import("./MazeGame").then((module) => ({ default: module.MazeGame })),
);

const initialSnapshot: GameSnapshot = {
  moves: 0,
  time: 0,
  completed: false,
  bestTime: getStoredBestTime(),
};

function getStoredBestTime() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("neon-labyrinth-best");
  return value ? Number(value) : null;
}

function formatTime(value: number | null) {
  if (value === null) return "--";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function App() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);
  const [moveHandler, setMoveHandler] = useState<((direction: Direction) => void) | null>(null);
  const [restartHandler, setRestartHandler] = useState<(() => void) | null>(null);
  const [resetViewHandler, setResetViewHandler] = useState<(() => void) | null>(null);

  const handleApiReady = useCallback(
    (api: { move: (direction: Direction) => void; restart: () => void; resetView: () => void }) => {
      setMoveHandler(() => api.move);
      setRestartHandler(() => api.restart);
      setResetViewHandler(() => api.resetView);
    },
    [],
  );

  const handleRestart = useCallback(() => {
    restartHandler?.();
  }, [restartHandler]);

  const handleResetView = useCallback(() => {
    resetViewHandler?.();
  }, [resetViewHandler]);

  const stats = useMemo(
    () => [
      { label: "Time", value: formatTime(snapshot.time), icon: Zap },
      { label: "Moves", value: snapshot.moves.toString(), icon: ArrowUp },
      { label: "Best", value: formatTime(snapshot.bestTime), icon: Trophy },
    ],
    [snapshot.bestTime, snapshot.moves, snapshot.time],
  );

  return (
    <main className="shell">
      <section className="game-stage" aria-label="Neon Labyrinth game">
        <div className="hud" aria-live="polite">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <h1>Neon Labyrinth</h1>
              <p>Reach the green beacon. Drag to orbit, then pinch or scroll to zoom.</p>
            </div>
          </div>

          <div className="stats" aria-label="Game stats">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div className="stat" key={item.label}>
                  <Icon aria-hidden="true" size={16} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              );
            })}
          </div>

          <div className="hud-actions">
            <button className="hud-button" type="button" onClick={handleResetView}>
              <Compass aria-hidden="true" size={18} />
              <span>Reset view</span>
            </button>
            <button className="icon-button" type="button" onClick={handleRestart} aria-label="Restart maze">
              <RotateCcw aria-hidden="true" size={20} />
            </button>
          </div>
        </div>

        <Suspense fallback={<div className="loading-scene" role="status">Loading maze</div>}>
          <MazeGame
            onSnapshot={setSnapshot}
            onReady={handleApiReady}
          />
        </Suspense>

        <p className="camera-hint" aria-live="polite">
          Drag the maze to rotate the camera. Pinch or scroll to zoom.
        </p>

        <div className="controls" aria-label="Movement controls">
          <button type="button" onClick={() => moveHandler?.("forward")} aria-label="Move forward">
            <ArrowUp aria-hidden="true" />
          </button>
          <button type="button" onClick={() => moveHandler?.("left")} aria-label="Turn left">
            <ArrowLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => moveHandler?.("backward")} aria-label="Move backward">
            <ArrowDown aria-hidden="true" />
          </button>
          <button type="button" onClick={() => moveHandler?.("right")} aria-label="Turn right">
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        {snapshot.completed ? (
          <div className="victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
            <Trophy aria-hidden="true" />
            <h2 id="victory-title">Beacon reached</h2>
            <p>{formatTime(snapshot.time)} in {snapshot.moves} moves</p>
            <button type="button" onClick={handleRestart}>Run it again</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
