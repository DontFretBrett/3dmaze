# Enemy update loop — performance benchmark

## What was measured

1. **In-browser frame sections** (`src/perfProbe.ts`, wired in `src/MazeGame.tsx`):
   - `time` — clock / stun bookkeeping
   - `playerBob` / `enemyBob` — idle vertical sine offsets (only per-frame enemy CPU beyond GSAP)
   - `idleFx` — beacon ring + particle drift
   - `camera` — orbit lerp + `lookAt`
   - `render` — `WebGLRenderer.render`

2. **A/B toggle** — append `?noEnemy=1` to skip enemy mesh, `enemyState`, `updateEnemy` scheduling, and contact checks (same scene otherwise). Compare against the default URL on the same hardware.

3. **Synthetic “larger world” GPU load** — `?stressCopies=N` (0–8) stacks duplicate copies of the same maze geometry vertically so draw cost scales without changing gameplay (player stays on the base copy).

4. **Node micro-benchmarks** (`scripts/bench-enemy-perf.ts`, `npm run bench`) — millions of iterations of same-cell checks and `MAZE_LAYOUT` / `RuntimeLevel` tile lookups to show JS-side work stays in the **nanoseconds per call** range.

## How to run

```bash
npm install
npm run build
npm run test
npm run bench
```

**Browser profiling**

- Baseline: `npm run dev` → open the game.
- HUD: add `?perf=1` — rolling mean / p95 frame time and per-section means appear on the canvas.
- Enemy off: `?perf=1&noEnemy=1`.
- Heavy scene: `?perf=1&stressCopies=4` (optionally combine with `noEnemy` to isolate GPU vs enemy idle).

## Hotspots (code-level)

| Area | Cost model | Notes |
| --- | --- | --- |
| `renderer.render` | GPU-bound with scene complexity | Dominates `meanTotalMs` when `stressCopies` rises. |
| GSAP enemy step tweens | Amortized across ~0.9s per cell + small delays | Not inside the rAF hot path except completion callbacks. |
| `enemyAi` | `updateEnemy` (time comparisons; occasionally starts a GSAP tween) | Near-zero when idle; spikes only when a step begins. |
| `enemyBob` / contact | O(1) compares + one `sin` on the enemy mesh | Expect **≪ 0.1 ms** mean on desktop; HUD confirms. |
| Input → move | Synchronous while key handler runs | Stun window (`CONTACT_STUN_MS`) blocks moves; frame pacing unchanged unless GPU saturates. |

## Verdict

For the current Neon maze (11×11, single floor), **enemy logic does not materially affect frame time** relative to lighting, shadows, and the full-scene draw. Use `?perf=1` on target hardware (especially mobile) after multi-floor shipping; `stressCopies` approximates heavier layered geometry until real multi-layer levels drive the renderer.
