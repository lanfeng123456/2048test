// Pure, immutable 2048 game engine. No function mutates its inputs; every
// transformation returns a new grid. Randomness is injected via an `rng`
// parameter so the engine is fully deterministic under test.

export type Grid = number[][];
export type Direction = "up" | "down" | "left" | "right";

export const SIZE = 4;
export const WINNING_TILE = 2048;

export interface MoveResult {
  grid: Grid;
  gained: number;
  moved: boolean;
}

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

export function emptyCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value === 0) cells.push([r, c]);
    }),
  );
  return cells;
}

// Place a single new tile (2 with 90% probability, otherwise 4) in a random
// empty cell. Returns the original grid unchanged when the board is full.
export function spawnTile(grid: Grid, rng: () => number = Math.random): Grid {
  const cells = emptyCells(grid);
  if (cells.length === 0) return grid;

  const [r, c] = cells[Math.floor(rng() * cells.length)];
  const value = rng() < 0.9 ? 2 : 4;
  return grid.map((row, ri) =>
    row.map((v, ci) => (ri === r && ci === c ? value : v)),
  );
}

export function createGrid(rng: () => number = Math.random): Grid {
  return spawnTile(spawnTile(emptyGrid(), rng), rng);
}

// Slide a single row toward the left, merging equal adjacent tiles once.
function collapseRow(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0);
  const result: number[] = [];
  let gained = 0;

  for (let i = 0; i < tiles.length; i++) {
    if (i < tiles.length - 1 && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      result.push(merged);
      gained += merged;
      i++; // consume the merged neighbour
    } else {
      result.push(tiles[i]);
    }
  }

  while (result.length < SIZE) result.push(0);
  return { row: result, gained };
}

function transpose(grid: Grid): Grid {
  return grid[0].map((_, c) => grid.map((row) => row[c]));
}

function reverseRows(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse());
}

function gridsEqual(a: Grid, b: Grid): boolean {
  return a.every((row, r) => row.every((value, c) => value === b[r][c]));
}

// Apply a move in the given direction. Every direction is reduced to a
// "collapse left" by transposing/reversing into canonical orientation and back.
export function move(grid: Grid, direction: Direction): MoveResult {
  let working = grid;
  if (direction === "right") working = reverseRows(working);
  else if (direction === "up") working = transpose(working);
  else if (direction === "down") working = reverseRows(transpose(working));

  let gained = 0;
  const collapsed = working.map((row) => {
    const { row: next, gained: rowGain } = collapseRow(row);
    gained += rowGain;
    return next;
  });

  let nextGrid = collapsed;
  if (direction === "right") nextGrid = reverseRows(collapsed);
  else if (direction === "up") nextGrid = transpose(collapsed);
  else if (direction === "down") nextGrid = transpose(reverseRows(collapsed));

  return { grid: nextGrid, gained, moved: !gridsEqual(grid, nextGrid) };
}

export function hasWon(grid: Grid): boolean {
  return grid.some((row) => row.some((value) => value >= WINNING_TILE));
}

export function isGameOver(grid: Grid): boolean {
  if (emptyCells(grid).length > 0) return false;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r][c];
      if (c + 1 < SIZE && grid[r][c + 1] === value) return false;
      if (r + 1 < SIZE && grid[r + 1][c] === value) return false;
    }
  }
  return true;
}
