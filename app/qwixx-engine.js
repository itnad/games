export const QWIXX_COLORS = ["red", "yellow", "green", "blue"];

export const QWIXX_ROWS = {
  red: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  yellow: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  green: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  blue: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};

export function qwixxCellIndex(color, value) {
  return QWIXX_ROWS[color].indexOf(value);
}

export function qwixxCanMark(marks, color, value, rowLocked = false) {
  if (rowLocked) return false;
  const index = qwixxCellIndex(color, value);
  if (index < 0) return false;
  const rowMarks = marks[color] ?? [];
  const last = rowMarks.length ? Math.max(...rowMarks) : -1;
  if (index <= last) return false;
  return index !== 10 || rowMarks.length >= 5;
}

export function qwixxApplyMark(marks, color, value) {
  const index = qwixxCellIndex(color, value);
  return {
    ...marks,
    [color]: [...(marks[color] ?? []), index],
  };
}

export function qwixxCrossScore(crosses) {
  return (crosses * (crosses + 1)) / 2;
}

export function qwixxPlayerScore(player) {
  const rowScore = QWIXX_COLORS.reduce((sum, color) => {
    const crosses = (player.marks[color]?.length ?? 0) + (player.locks.includes(color) ? 1 : 0);
    return sum + qwixxCrossScore(crosses);
  }, 0);
  return rowScore - player.penalties * 5;
}
