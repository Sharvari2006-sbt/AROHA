import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src', 'components', 'StudyToolScreen.tsx'), 'utf8');
const baseSolution = source.match(/const BASE_SOLUTION = '([0-9]{81})'/)?.[1];
const puzzleBlock = source.match(/const PUZZLES:[\s\S]*?= \{([\s\S]*?)\n\};/)?.[1] ?? '';
const levels = ['Beginner', 'Intermediate', 'Expert'];

if (!baseSolution) throw new Error('Could not read the Sudoku solution from StudyToolScreen.tsx.');

function isValidCompletedGrid(grid) {
  const expected = '123456789';
  const units = [];
  for (let index = 0; index < 9; index += 1) {
    units.push([...Array(9)].map((_, column) => grid[index * 9 + column]));
    units.push([...Array(9)].map((_, row) => grid[row * 9 + index]));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      units.push([...Array(9)].map((_, offset) => grid[(boxRow * 3 + Math.floor(offset / 3)) * 9 + boxColumn * 3 + offset % 3]));
    }
  }
  return units.every((unit) => [...unit].sort().join('') === expected);
}

function solutionCount(puzzle, limit = 2) {
  const board = puzzle.split('').map(Number);
  let count = 0;

  function candidates(index) {
    const row = Math.floor(index / 9);
    const column = index % 9;
    const used = new Set();
    for (let offset = 0; offset < 9; offset += 1) {
      used.add(board[row * 9 + offset]);
      used.add(board[offset * 9 + column]);
      used.add(board[(Math.floor(row / 3) * 3 + Math.floor(offset / 3)) * 9 + Math.floor(column / 3) * 3 + offset % 3]);
    }
    return [...Array(9)].map((_, value) => value + 1).filter((value) => !used.has(value));
  }

  function solve() {
    if (count >= limit) return;
    let target = -1;
    let options = [];
    for (let index = 0; index < 81; index += 1) {
      if (board[index] !== 0) continue;
      const next = candidates(index);
      if (next.length === 0) return;
      if (target < 0 || next.length < options.length) {
        target = index;
        options = next;
        if (next.length === 1) break;
      }
    }
    if (target < 0) {
      count += 1;
      return;
    }
    for (const value of options) {
      board[target] = value;
      solve();
      board[target] = 0;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

if (!isValidCompletedGrid(baseSolution)) throw new Error('The base Sudoku solution is invalid.');

let verified = 0;
for (const level of levels) {
  const section = puzzleBlock.match(new RegExp(`${level}: \\[([\\s\\S]*?)\\]`))?.[1] ?? '';
  const puzzles = [...section.matchAll(/'([0-9]{81})'/g)].map((match) => match[1]);
  if (puzzles.length !== 3) throw new Error(`${level} must contain exactly three puzzles.`);
  for (const [index, puzzle] of puzzles.entries()) {
    for (let cell = 0; cell < 81; cell += 1) {
      if (puzzle[cell] !== '0' && puzzle[cell] !== baseSolution[cell]) {
        throw new Error(`${level} puzzle ${index + 1} has a clue that conflicts with its solution.`);
      }
    }
    const count = solutionCount(puzzle);
    if (count !== 1) throw new Error(`${level} puzzle ${index + 1} has ${count === 0 ? 'no solution' : 'multiple solutions'}.`);
    verified += 1;
  }
}

console.log(`Verified ${verified} Sudoku puzzles: valid grids, consistent clues, and exactly one solution each.`);
