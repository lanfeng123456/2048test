import { describe, expect, it } from "vitest";
import {
  createGrid,
  emptyCells,
  emptyGrid,
  hasWon,
  isGameOver,
  move,
  spawnTile,
  type Grid,
} from "./engine";

describe("move - merging and sliding", () => {
  it("slides tiles left and merges equal neighbours once", () => {
    const grid: Grid = [
      [2, 2, 0, 0],
      [4, 0, 4, 0],
      [2, 2, 2, 2],
      [0, 0, 0, 0],
    ];
    const result = move(grid, "left");

    expect(result.grid).toEqual([
      [4, 0, 0, 0],
      [8, 0, 0, 0],
      [4, 4, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(result.gained).toBe(4 + 8 + 4 + 4);
    expect(result.moved).toBe(true);
  });

  it("does not merge three-in-a-row into one tile", () => {
    const grid: Grid = [
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = move(grid, "left");
    expect(result.grid[0]).toEqual([4, 2, 0, 0]);
  });

  it("slides and merges to the right", () => {
    const grid: Grid = [
      [2, 0, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(move(grid, "right").grid[0]).toEqual([0, 0, 4, 4]);
  });

  it("merges upward", () => {
    const grid: Grid = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [4, 0, 0, 0],
    ];
    const result = move(grid, "up");
    expect(result.grid.map((row) => row[0])).toEqual([4, 8, 0, 0]);
  });

  it("merges downward", () => {
    const grid: Grid = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [4, 0, 0, 0],
    ];
    const result = move(grid, "down");
    expect(result.grid.map((row) => row[0])).toEqual([0, 0, 4, 8]);
  });

  it("reports moved=false when nothing changes", () => {
    const grid: Grid = [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(move(grid, "left").moved).toBe(false);
  });

  it("does not mutate the input grid", () => {
    const grid: Grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = JSON.stringify(grid);
    move(grid, "left");
    expect(JSON.stringify(grid)).toBe(snapshot);
  });
});

describe("spawnTile / createGrid", () => {
  it("places a deterministic tile using an injected rng", () => {
    // rng() returns 0 => first empty cell, value 2 (0 < 0.9)
    const grid = spawnTile(emptyGrid(), () => 0);
    expect(grid[0][0]).toBe(2);
    expect(emptyCells(grid)).toHaveLength(15);
  });

  it("spawns a 4 when rng for value is >= 0.9", () => {
    let call = 0;
    // first rng call -> cell index (0), second -> value (0.95 => 4)
    const rng = () => (call++ === 0 ? 0 : 0.95);
    const grid = spawnTile(emptyGrid(), rng);
    expect(grid[0][0]).toBe(4);
  });

  it("returns the same grid when the board is full", () => {
    const full: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(spawnTile(full, () => 0)).toBe(full);
  });

  it("createGrid starts with exactly two tiles", () => {
    const grid = createGrid(() => 0.5);
    const filled = 16 - emptyCells(grid).length;
    expect(filled).toBeGreaterThanOrEqual(1);
    expect(filled).toBeLessThanOrEqual(2);
  });
});

describe("hasWon / isGameOver", () => {
  it("detects a 2048 tile", () => {
    const grid = emptyGrid();
    grid[1][1] = 2048;
    expect(hasWon(grid)).toBe(true);
  });

  it("is not over while empty cells remain", () => {
    const grid = emptyGrid();
    grid[0][0] = 2;
    expect(isGameOver(grid)).toBe(false);
  });

  it("is not over when a merge is still possible on a full board", () => {
    const grid: Grid = [
      [2, 2, 4, 8],
      [16, 32, 64, 128],
      [256, 512, 1024, 2],
      [4, 8, 16, 32],
    ];
    expect(isGameOver(grid)).toBe(false);
  });

  it("is over when full with no possible merges", () => {
    const grid: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(isGameOver(grid)).toBe(true);
  });
});
