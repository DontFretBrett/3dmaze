/**
 * Lightweight frame profiler for comparing rAF sections (e.g. enemy idle vs render).
 * Enabled from the URL with `?perf=1` (see MazeGame mount effect).
 */

export type PerfHudStats = {
  frames: number;
  /** Mean total time inside the rAF callback (ms). */
  meanTotalMs: number;
  /** Approximate 95th percentile of total frame time (ms). */
  p95TotalMs: number;
  /** Mean time attributed to a section (ms). */
  sectionMeansMs: Record<string, number>;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

export class RollingFrameStats {
  private readonly totals: number[] = [];
  private readonly sectionKeys: string[];
  private readonly sections: Map<string, number[]>;
  private write = 0;
  private filled = 0;

  constructor(
    private readonly capacity: number,
    sectionNames: readonly string[],
  ) {
    this.sectionKeys = [...sectionNames];
    this.sections = new Map(sectionNames.map((name) => [name, new Array(capacity).fill(0)]));
  }

  pushSample(totalMs: number, sectionMs: Record<string, number>) {
    const cap = this.capacity;
    const i = this.write;
    this.totals[i] = totalMs;
    for (const key of this.sectionKeys) {
      this.sections.get(key)![i] = sectionMs[key] ?? 0;
    }
    this.write = (this.write + 1) % cap;
    this.filled = Math.min(cap, this.filled + 1);
  }

  snapshot(): PerfHudStats {
    const cap = this.capacity;
    const n = this.filled;
    const totals = n === cap ? [...this.totals] : this.totals.slice(0, n);
    const sortedTotals = [...totals].sort((a, b) => a - b);
    const meanTotal = totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length);

    const sectionMeansMs: Record<string, number> = {};
    for (const key of this.sectionKeys) {
      const buf = this.sections.get(key)!;
      const slice = n === cap ? [...buf] : buf.slice(0, n);
      sectionMeansMs[key] = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
    }

    return {
      frames: n,
      meanTotalMs: meanTotal,
      p95TotalMs: percentile(sortedTotals, 0.95),
      sectionMeansMs,
    };
  }
}

export type SectionTimings = Record<string, number>;

/** Sequential marks inside one animation frame; times are exclusive per section. */
export function createSectionTimer() {
  let frameStart = 0;
  let mark = 0;
  const sections: SectionTimings = {};

  return {
    start() {
      frameStart = performance.now();
      mark = frameStart;
      for (const key of Object.keys(sections)) delete sections[key];
    },
    /** Ends the previous implicit slice and starts timing `name`. */
    slice(name: string) {
      const now = performance.now();
      const delta = now - mark;
      sections[name] = (sections[name] ?? 0) + delta;
      mark = now;
    },
    finish() {
      const now = performance.now();
      sections._tail = (sections._tail ?? 0) + (now - mark);
      return { totalMs: now - frameStart, sections };
    },
  };
}

export function attachPerfHud(mount: HTMLElement): {
  update: (stats: PerfHudStats) => void;
  remove: () => void;
} {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.style.cssText = [
    "position:absolute",
    "left:8px",
    "bottom:8px",
    "max-width:min(420px,calc(100% - 16px))",
    "padding:8px 10px",
    "font:11px/1.35 ui-monospace,Menlo,monospace",
    "color:#c8fff0",
    "background:rgba(6,18,16,0.82)",
    "border:1px solid rgba(30,255,194,0.35)",
    "border-radius:6px",
    "pointer-events:none",
    "z-index:30",
    "white-space:pre-wrap",
  ].join(";");
  mount.style.position = mount.style.position || "relative";
  mount.appendChild(el);

  return {
    update(stats: PerfHudStats) {
      const lines = [
        `perf n=${stats.frames}  mean=${stats.meanTotalMs.toFixed(2)}ms  p95=${stats.p95TotalMs.toFixed(2)}ms`,
        ...Object.entries(stats.sectionMeansMs)
          .filter(([k]) => k !== "_tail")
          .map(([k, v]) => `  ${k}: ${v.toFixed(3)}ms`),
      ];
      el.textContent = lines.join("\n");
    },
    remove() {
      el.remove();
    },
  };
}
