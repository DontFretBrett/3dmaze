import type { LayeredLevelDefinition, LegacyLevelDefinition, MazeLayer, Tile } from "../levelRuntime";

type AuthoredRow = `${string}`;
type TileGlyph = keyof typeof TILE_GLYPHS;

const TILE_GLYPHS = {
  "#": 1,
  ".": 0,
  L: "ladder",
  O: "hole",
} as const satisfies Record<string, Tile>;

function parseLayer(rows: readonly AuthoredRow[]): MazeLayer {
  const expectedWidth = rows[0]?.length ?? 0;
  if (expectedWidth === 0) {
    throw new Error("Authored levels must contain at least one non-empty row.");
  }

  return rows.map((row, rowIndex) => {
    if (row.length !== expectedWidth) {
      throw new Error(`Authored layer row ${rowIndex} width ${row.length} does not match ${expectedWidth}.`);
    }

    return Array.from(row, (glyph, columnIndex) => {
      if (!(glyph in TILE_GLYPHS)) {
        throw new Error(`Unsupported authored tile "${glyph}" at row ${rowIndex}, column ${columnIndex}.`);
      }

      const tile = TILE_GLYPHS[glyph as TileGlyph];
      if (tile === undefined) {
        throw new Error(`Unsupported authored tile "${glyph}" at row ${rowIndex}, column ${columnIndex}.`);
      }
      return tile;
    });
  });
}

function setGlyph(rows: readonly AuthoredRow[], x: number, z: number, glyph: TileGlyph): AuthoredRow[] {
  return rows.map((row, rowIndex) => {
    if (rowIndex !== z) return row;
    return `${row.slice(0, x)}${glyph}${row.slice(x + 1)}` as AuthoredRow;
  });
}

const ORBITAL_SHELL_ROWS = [
  "#############",
  "#.....L.....#",
  "#.####.####.#",
  "#.#.......#.#",
  "#.#.#####.#.#",
  "#.#.#...#.#.#",
  "#...#.L.#...#",
  "#.#.#...#.#.#",
  "#.#.#####.#.#",
  "#.#.......#.#",
  "#.####.####.#",
  "#.....L.....#",
  "#############",
] as const satisfies readonly AuthoredRow[];

const CUBE_FACE_ROWS = [
  "#############",
  "#L....#....L#",
  "#.##.....##.#",
  "#.#.###.#.#.#",
  "#...#...#...#",
  "###.#.#.#.###",
  "#.....L.....#",
  "###.#.#.#.###",
  "#...#...#...#",
  "#.#.###.#.#.#",
  "#.##.....##.#",
  "#L....#....L#",
  "#############",
] as const satisfies readonly AuthoredRow[];

const HELIX_ROWS = [
  "#############",
  "#L..........#",
  "###########.#",
  "#...........#",
  "#.###########",
  "#...........#",
  "###########.#",
  "#...........#",
  "#.###########",
  "#...........#",
  "###########.#",
  "#..........L#",
  "#############",
] as const satisfies readonly AuthoredRow[];

const TRIANGLE_ROWS = [
  "#############",
  "#L..........#",
  "##.........##",
  "###.......###",
  "####.....####",
  "#####...#####",
  "#.....L.....#",
  "#####...#####",
  "####.....####",
  "###.......###",
  "##.........##",
  "#..........L#",
  "#############",
] as const satisfies readonly AuthoredRow[];

const VAULT_ROWS = [
  "#############",
  "#L...#.....L#",
  "#.##.#.###..#",
  "#....#...#..#",
  "####.###.#.##",
  "#....#...#..#",
  "#.##...L...##",
  "#..#...#....#",
  "##.#.###.####",
  "#..#...#....#",
  "#..###.#.##.#",
  "#L.....#...L#",
  "#############",
] as const satisfies readonly AuthoredRow[];

const FINAL_NEXUS_ROWS = [
  "#############",
  "#L....#....L#",
  "#.##..#..##.#",
  "#...#...#...#",
  "###.#.#.#.###",
  "#.....#.....#",
  "#.#.#L#.#.#.#",
  "#.....#.....#",
  "###.#.#.#.###",
  "#...#...#...#",
  "#.##..#..##.#",
  "#L....#....L#",
  "#############",
] as const satisfies readonly AuthoredRow[];

export const LEVEL_1: LegacyLevelDefinition = {
  id: "level-1-neon-run",
  title: "Neon Run",
  maze: parseLayer([
    "###########",
    "#...#.....#",
    "#.#.#.###.#",
    "#.#.#...#.#",
    "#.#.###.#.#",
    "#.#.....#.#",
    "#.#####.#.#",
    "#...#...#.#",
    "###.#.###.#",
    "#.....#...#",
    "###########",
  ]),
  start: { x: 1, z: 1 },
  finish: { x: 9, z: 9 },
};

export const LEVEL_2: LegacyLevelDefinition = {
  id: "level-2-forked-grid",
  title: "Switchback Grid",
  maze: parseLayer([
    "###########",
    "#.........#",
    "#########.#",
    "#.........#",
    "#.#########",
    "#.........#",
    "#########.#",
    "#.........#",
    "#.#########",
    "#.........#",
    "###########",
  ]),
  start: { x: 1, z: 1 },
  finish: { x: 9, z: 9 },
};

export const LEVEL_3: LayeredLevelDefinition = {
  id: "level-3-vertical-drift",
  title: "Vertical Drift",
  layers: [
    parseLayer([
      "###########",
      "#...#L....#",
      "#.#.#.###.#",
      "#.#.#...#.#",
      "#.#.###.#.#",
      "#...#...#.#",
      "###.#.###.#",
      "#...#..L#.#",
      "#.###.#.#.#",
      "#.....#...#",
      "###########",
    ]),
    parseLayer([
      "###########",
      "#.#.#L....#",
      "#.#.#.###.#",
      "#...#...#.#",
      "###.###.#.#",
      "#...#O..#.#",
      "#.###.###.#",
      "#.#.#..L#.#",
      "#.#.###.#.#",
      "#.....#...#",
      "###########",
    ]),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 9, z: 9, layer: 1 },
  enemy: {
    path: [
      { x: 5, z: 7, layer: 1 },
      { x: 6, z: 7, layer: 1 },
      { x: 7, z: 7, layer: 1 },
    ],
    secondsPerCell: 1.08,
    initialDelayMs: 850,
    pauseMsBetweenSteps: 140,
  },
};

export const LEVEL_4: LayeredLevelDefinition = {
  id: "level-4-lockdown-labyrinth",
  title: "Prism Spire",
  layers: [
    parseLayer([
      "#############",
      "#....L......#",
      "#.###.#####.#",
      "#.#.......#.#",
      "#.#.#####.#.#",
      "#.#.#...#.#.#",
      "#...#.#.#...#",
      "#####.#.###.#",
      "#.....#.....#",
      "#.#####.###.#",
      "#.#.....#...#",
      "#....L..#...#",
      "#############",
    ]),
    parseLayer([
      "#############",
      "#....L..#...#",
      "#.###.#.#.#.#",
      "#...#.#...#.#",
      "###.#.#####.#",
      "#...#O..#.#.#",
      "#.#####.#.###",
      "#...#...#...#",
      "###.#.###.#.#",
      "#...#.....#.#",
      "#.###.#####.#",
      "#....L......#",
      "#############",
    ]),
    parseLayer([
      "#############",
      "#....L......#",
      "#.#####.###.#",
      "#.....#...#.#",
      "#.###.###.#.#",
      "#...#...#...#",
      "###.#.#.###.#",
      "#...#.#.....#",
      "#.###.#####.#",
      "#.#...#...#.#",
      "#.#.###.#.#.#",
      "#....L..#...#",
      "#############",
    ]),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 11, z: 11, layer: 2 },
  enemy: {
    path: [
      { x: 7, z: 7, layer: 2 },
      { x: 8, z: 7, layer: 2 },
      { x: 9, z: 7, layer: 2 },
      { x: 10, z: 7, layer: 2 },
      { x: 11, z: 7, layer: 2 },
    ],
    secondsPerCell: 1.04,
    initialDelayMs: 700,
    pauseMsBetweenSteps: 120,
  },
};

export const LEVEL_5: LayeredLevelDefinition = {
  id: "level-5-orbital-shell",
  title: "Orbital Shell",
  layers: [
    parseLayer(ORBITAL_SHELL_ROWS),
    parseLayer(setGlyph(ORBITAL_SHELL_ROWS, 3, 6, "O")),
    parseLayer(setGlyph(ORBITAL_SHELL_ROWS, 9, 6, "O")),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 11, z: 11, layer: 2 },
  enemy: {
    path: [
      { x: 3, z: 3, layer: 1 },
      { x: 4, z: 3, layer: 1 },
      { x: 5, z: 3, layer: 1 },
      { x: 6, z: 3, layer: 1 },
      { x: 7, z: 3, layer: 1 },
      { x: 8, z: 3, layer: 1 },
      { x: 9, z: 3, layer: 1 },
    ],
    secondsPerCell: 0.98,
    initialDelayMs: 620,
    pauseMsBetweenSteps: 105,
  },
};

export const LEVEL_6: LayeredLevelDefinition = {
  id: "level-6-gravity-cube",
  title: "Gravity Cube",
  layers: [
    parseLayer(CUBE_FACE_ROWS),
    parseLayer(setGlyph(CUBE_FACE_ROWS, 2, 6, "O")),
    parseLayer(setGlyph(CUBE_FACE_ROWS, 10, 6, "O")),
    parseLayer(CUBE_FACE_ROWS),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 11, z: 11, layer: 3 },
  enemy: {
    path: [
      { x: 5, z: 4, layer: 2 },
      { x: 6, z: 4, layer: 2 },
      { x: 7, z: 4, layer: 2 },
    ],
    secondsPerCell: 0.94,
    initialDelayMs: 560,
    pauseMsBetweenSteps: 95,
  },
};

export const LEVEL_7: LayeredLevelDefinition = {
  id: "level-7-helix-ramp",
  title: "Helix Ramp",
  layers: [
    parseLayer(HELIX_ROWS),
    parseLayer(setGlyph(HELIX_ROWS, 6, 5, "O")),
    parseLayer(setGlyph(HELIX_ROWS, 6, 7, "O")),
    parseLayer(HELIX_ROWS),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 11, z: 11, layer: 3 },
  enemy: {
    path: [
      { x: 3, z: 5, layer: 2 },
      { x: 4, z: 5, layer: 2 },
      { x: 5, z: 5, layer: 2 },
      { x: 6, z: 5, layer: 2 },
      { x: 7, z: 5, layer: 2 },
      { x: 8, z: 5, layer: 2 },
      { x: 9, z: 5, layer: 2 },
    ],
    secondsPerCell: 0.9,
    initialDelayMs: 520,
    pauseMsBetweenSteps: 90,
  },
};

export const LEVEL_8: LayeredLevelDefinition = {
  id: "level-8-pyramid-fold",
  title: "Pyramid Fold",
  layers: [
    parseLayer(TRIANGLE_ROWS),
    parseLayer(setGlyph(TRIANGLE_ROWS, 6, 3, "O")),
    parseLayer(setGlyph(TRIANGLE_ROWS, 6, 9, "O")),
    parseLayer(TRIANGLE_ROWS),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 11, z: 11, layer: 3 },
  enemy: {
    path: [
      { x: 5, z: 6, layer: 2 },
      { x: 6, z: 6, layer: 2 },
      { x: 7, z: 6, layer: 2 },
    ],
    secondsPerCell: 0.86,
    initialDelayMs: 480,
    pauseMsBetweenSteps: 82,
  },
};

export const LEVEL_9: LayeredLevelDefinition = {
  id: "level-9-mirror-vault",
  title: "Mirror Vault",
  layers: [
    parseLayer(VAULT_ROWS),
    parseLayer(setGlyph(VAULT_ROWS, 6, 3, "O")),
    parseLayer(setGlyph(VAULT_ROWS, 6, 9, "O")),
    parseLayer(setGlyph(VAULT_ROWS, 5, 6, "O")),
    parseLayer(VAULT_ROWS),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 11, z: 11, layer: 4 },
  enemy: {
    path: [
      { x: 8, z: 7, layer: 3 },
      { x: 8, z: 8, layer: 3 },
      { x: 8, z: 9, layer: 3 },
      { x: 8, z: 10, layer: 3 },
    ],
    secondsPerCell: 0.82,
    initialDelayMs: 440,
    pauseMsBetweenSteps: 72,
  },
};

export const LEVEL_10: LayeredLevelDefinition = {
  id: "level-10-astral-nexus",
  title: "Astral Nexus",
  layers: [
    parseLayer(FINAL_NEXUS_ROWS),
    parseLayer(setGlyph(FINAL_NEXUS_ROWS, 3, 5, "O")),
    parseLayer(setGlyph(FINAL_NEXUS_ROWS, 9, 5, "O")),
    parseLayer(setGlyph(FINAL_NEXUS_ROWS, 3, 7, "O")),
    parseLayer(setGlyph(FINAL_NEXUS_ROWS, 9, 7, "O")),
  ],
  start: { x: 1, z: 1, layer: 0 },
  finish: { x: 11, z: 11, layer: 4 },
  enemy: {
    path: [
      { x: 5, z: 5, layer: 3 },
      { x: 5, z: 6, layer: 3 },
      { x: 5, z: 7, layer: 3 },
      { x: 5, z: 8, layer: 3 },
    ],
    secondsPerCell: 0.78,
    initialDelayMs: 420,
    pauseMsBetweenSteps: 64,
  },
};

export const CAMPAIGN_LEVEL_DEFINITIONS = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
  LEVEL_8,
  LEVEL_9,
  LEVEL_10,
] as const;

export const ACTIVE_LEVEL = LEVEL_1;
export const MULTI_LAYER_PREVIEW_LEVEL = LEVEL_3;
