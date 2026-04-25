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

export const CAMPAIGN_LEVEL_DEFINITIONS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4] as const;

export const ACTIVE_LEVEL = LEVEL_1;
export const MULTI_LAYER_PREVIEW_LEVEL = LEVEL_3;
