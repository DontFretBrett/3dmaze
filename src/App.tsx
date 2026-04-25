import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react";
import {
  CAMPAIGN_LEVELS,
  DEFAULT_CAMPAIGN_LEVEL_ID,
  getCampaignLevel,
  getNextCampaignLevelId,
  type CampaignLevelId,
} from "./campaign/campaignProgression";
import { CAMPAIGN_LEVEL_DEFINITIONS } from "./campaign/levelDefinitions";
import type { Direction, GameSnapshot } from "./MazeGame";
import { createInitialGameSnapshot } from "./gameSnapshot";

const MazeGame = lazy(() =>
  import("./MazeGame").then((module) => ({ default: module.MazeGame })),
);

function getBestTimeStorageKey(levelId: string) {
  return `neon-labyrinth-best:${levelId}`;
}

function getStoredBestTime(levelId: string) {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(getBestTimeStorageKey(levelId));
  return value ? Number(value) : null;
}

function formatTime(value: number | null) {
  if (value === null) return "--";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function App() {
  const [selectedLevelId, setSelectedLevelId] = useState<CampaignLevelId>(DEFAULT_CAMPAIGN_LEVEL_ID);
  const activeLevelDefinition = CAMPAIGN_LEVEL_DEFINITIONS[selectedLevelId - 1];
  if (!activeLevelDefinition) {
    throw new Error(`Missing authored level for campaign slot ${selectedLevelId}.`);
  }

  const activeCampaignLevel = getCampaignLevel(selectedLevelId);
  const nextLevelId = getNextCampaignLevelId(selectedLevelId);
  const activeLevelStorageId = activeLevelDefinition.id ?? `level-${selectedLevelId}`;
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    createInitialGameSnapshot(activeLevelDefinition, getStoredBestTime(activeLevelStorageId)),
  );
  const [moveHandler, setMoveHandler] = useState<((direction: Direction) => void) | null>(null);
  const [restartHandler, setRestartHandler] = useState<(() => void) | null>(null);
  const [resetViewHandler, setResetViewHandler] = useState<(() => void) | null>(null);
  const [climbUpHandler, setClimbUpHandler] = useState<(() => void) | null>(null);
  const [climbDownHandler, setClimbDownHandler] = useState<(() => void) | null>(null);

  const clearControlHandlers = useCallback(() => {
    setMoveHandler(null);
    setRestartHandler(null);
    setResetViewHandler(null);
    setClimbUpHandler(null);
    setClimbDownHandler(null);
  }, []);

  useEffect(() => {
    setSnapshot(createInitialGameSnapshot(activeLevelDefinition, getStoredBestTime(activeLevelStorageId)));
  }, [activeLevelDefinition, activeLevelStorageId]);

  useEffect(() => {
    if (!snapshot.completed || nextLevelId === null) return;

    const timeoutId = window.setTimeout(() => {
      clearControlHandlers();
      setSelectedLevelId(nextLevelId);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clearControlHandlers, nextLevelId, snapshot.completed]);

  const controlsReady = Boolean(moveHandler && restartHandler && resetViewHandler && climbUpHandler && climbDownHandler);
  const controlsLocked = snapshot.completed || snapshot.failed || !controlsReady;

  const handleApiReady = useCallback(
    (api: {
      move: (direction: Direction) => void;
      restart: () => void;
      resetView: () => void;
      climbUp: () => void;
      climbDown: () => void;
    }) => {
      setMoveHandler(() => api.move);
      setRestartHandler(() => api.restart);
      setResetViewHandler(() => api.resetView);
      setClimbUpHandler(() => api.climbUp);
      setClimbDownHandler(() => api.climbDown);
    },
    [],
  );

  const handleRestart = useCallback(() => {
    restartHandler?.();
  }, [restartHandler]);

  const handleSelectLevel = useCallback(
    (levelId: CampaignLevelId) => {
      if (levelId === selectedLevelId) return;
      clearControlHandlers();
      setSelectedLevelId(levelId);
    },
    [clearControlHandlers, selectedLevelId],
  );

  const handleAdvanceLevel = useCallback(() => {
    if (nextLevelId !== null) {
      clearControlHandlers();
      setSelectedLevelId(nextLevelId);
    }
  }, [clearControlHandlers, nextLevelId]);

  const handleResetView = useCallback(() => {
    resetViewHandler?.();
  }, [resetViewHandler]);

  const stats = useMemo(
    () => [
      { label: "Time", value: formatTime(snapshot.time), icon: Zap },
      { label: "Moves", value: snapshot.moves.toString(), icon: ArrowUp },
      { label: "Hits", value: snapshot.contacts.toString(), icon: AlertTriangle },
      { label: "Best", value: formatTime(snapshot.bestTime), icon: Trophy },
    ],
    [snapshot.bestTime, snapshot.contacts, snapshot.moves, snapshot.time],
  );

  const tileStatus = useMemo(() => {
    switch (snapshot.currentTile) {
      case "ladder":
        if (snapshot.canClimbUp && snapshot.canClimbDown) return "Ladder up/down";
        if (snapshot.canClimbUp) return "Ladder up";
        if (snapshot.canClimbDown) return "Ladder down";
        return "Ladder shaft";
      case "hole":
        return "Drop shaft";
      case "exit":
        return "Beacon floor";
      case "start":
        return "Start floor";
      default:
        return "Stable floor";
    }
  }, [snapshot.canClimbDown, snapshot.canClimbUp, snapshot.currentTile]);

  const floorSteps = useMemo(
    () =>
      Array.from({ length: snapshot.layerCount }, (_, index) => ({
        index,
        isActive: index === snapshot.layer,
      })).reverse(),
    [snapshot.layer, snapshot.layerCount],
  );

  const cameraHint = useMemo(() => {
    if (snapshot.currentTile === "hole") {
      return "Hole underfoot — amber shafts auto-drop you to the next safe floor below.";
    }

    if (snapshot.canClimbUp || snapshot.canClimbDown) {
      return "Ladder in reach — use Floor Up / Down or Q / E to change levels.";
    }

    return "Drag the maze to rotate the camera. Arrow controls follow the current view; pinch or scroll to zoom.";
  }, [snapshot.canClimbDown, snapshot.canClimbUp, snapshot.currentTile]);

  return (
    <main className="shell">
      <section className="game-stage" aria-label="Neon Labyrinth game">
        <div className="hud" aria-live="polite">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <h1>Neon Labyrinth</h1>
              <p className="hud-level" data-level={activeCampaignLevel.id}>
                Level {activeCampaignLevel.id}: {activeCampaignLevel.title}
              </p>
              <div className="level-select" role="group" aria-label="Campaign level selection">
                {CAMPAIGN_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    className={`level-chip${level.id === selectedLevelId ? " level-chip--active" : ""}`}
                    onClick={() => handleSelectLevel(level.id)}
                    aria-pressed={level.id === selectedLevelId}
                    aria-label={`Load level ${level.id}: ${level.title}`}
                  >
                    <span>Lv {level.id}</span>
                    <strong>{level.title}</strong>
                  </button>
                ))}
              </div>
              <div className="layer-readout">
                <span className="floor-chip">
                  Floor {snapshot.layer + 1} / {snapshot.layerCount}
                </span>
                <span className={`tile-chip tile-chip--${snapshot.currentTile}`}>{tileStatus}</span>
              </div>
              {snapshot.layerCount > 1 ? (
                <div className="layer-cues" aria-label="Layer and traversal cues">
                  <div
                    className="floor-stack"
                    role="list"
                    aria-label={`Current floor ${snapshot.layer + 1} of ${snapshot.layerCount}`}
                  >
                    {floorSteps.map((step) => (
                      <div
                        key={step.index}
                        className={`floor-stack__step${step.isActive ? " floor-stack__step--active" : ""}`}
                        role="listitem"
                        aria-current={step.isActive ? "step" : undefined}
                      >
                        <span>Floor {step.index + 1}</span>
                        <strong>{step.isActive ? "Current" : step.index > snapshot.layer ? "Above" : "Below"}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="tile-legend" aria-label="Traversal marker legend">
                    <span className="tile-legend__item tile-legend__item--ladder">Ladder = climb</span>
                    <span className="tile-legend__item tile-legend__item--hole">Hole = drop</span>
                  </div>
                </div>
              ) : null}
              <p>
                Reach the green beacon. Cyan ladders connect floors, amber shafts drop you down, and the floor stack
                keeps your current deck in view. Avoid the red patrol — one hit ends the run until you restart.
              </p>
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
            <button className="hud-button" type="button" onClick={handleResetView} disabled={!controlsReady}>
              <Compass aria-hidden="true" size={18} />
              <span>Reset view</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={handleRestart}
              disabled={!controlsReady}
              aria-label="Restart maze"
            >
              <RotateCcw aria-hidden="true" size={20} />
            </button>
          </div>
        </div>

        <Suspense fallback={<div className="loading-scene" role="status">Loading maze</div>}>
          <MazeGame
            key={activeLevelDefinition.id}
            level={activeLevelDefinition}
            onSnapshot={setSnapshot}
            onReady={handleApiReady}
          />
        </Suspense>

        <p className="camera-hint" aria-live="polite">
          {cameraHint}
        </p>

        {snapshot.canClimbUp || snapshot.canClimbDown ? (
          <div className="traversal-controls" aria-label="Vertical traversal controls">
            <button
              type="button"
              onClick={() => climbUpHandler?.()}
              disabled={controlsLocked || !snapshot.canClimbUp}
              aria-label="Climb to the upper floor"
            >
              <ArrowUp aria-hidden="true" />
              <span>Floor up</span>
            </button>
            <button
              type="button"
              onClick={() => climbDownHandler?.()}
              disabled={controlsLocked || !snapshot.canClimbDown}
              aria-label="Climb to the lower floor"
            >
              <ArrowDown aria-hidden="true" />
              <span>Floor down</span>
            </button>
          </div>
        ) : null}

        <div className="controls" aria-label="Movement controls">
          <button type="button" onClick={() => moveHandler?.("forward")} disabled={controlsLocked} aria-label="Move forward">
            <ArrowUp aria-hidden="true" />
          </button>
          <button type="button" onClick={() => moveHandler?.("left")} disabled={controlsLocked} aria-label="Move left">
            <ArrowLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => moveHandler?.("backward")} disabled={controlsLocked} aria-label="Move backward">
            <ArrowDown aria-hidden="true" />
          </button>
          <button type="button" onClick={() => moveHandler?.("right")} disabled={controlsLocked} aria-label="Move right">
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        {snapshot.failed ? (
          <div className="defeat" role="dialog" aria-modal="true" aria-labelledby="defeat-title">
            <AlertTriangle aria-hidden="true" />
            <h2 id="defeat-title">Patrol caught you</h2>
            <p>
              {formatTime(snapshot.time)} before the hit, {snapshot.moves} moves taken.
            </p>
            <button type="button" onClick={handleRestart}>Restart run</button>
          </div>
        ) : null}

        {snapshot.completed ? (
          <div className="victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
            <Trophy aria-hidden="true" />
            <h2 id="victory-title">{nextLevelId === null ? "Campaign complete" : "Beacon reached"}</h2>
            <p>
              {formatTime(snapshot.time)} in {snapshot.moves} moves
            </p>
            <p className="campaign-status">
              {nextLevelId === null
                ? "All four authored levels are now available from the level picker."
                : `Advancing to Level ${nextLevelId} automatically.`}
            </p>
            <div className="victory-actions">
              {nextLevelId === null ? (
                <button type="button" onClick={handleSelectLevel.bind(null, DEFAULT_CAMPAIGN_LEVEL_ID)}>
                  Back to Level 1
                </button>
              ) : (
                <button type="button" onClick={handleAdvanceLevel}>Next level</button>
              )}
              <button type="button" onClick={handleRestart}>
                {nextLevelId === null ? "Replay level" : "Replay this level"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
