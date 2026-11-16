import { get } from 'underscore';

export function position(model) {
  const stamp = model.getTimestamp();
  const time = stamp ? Date.parse(stamp) : Infinity;
  if (Number.isNaN(time)) throw new Error('Invalid interaction timestamp.');
  const fraction = get(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/.exec(stamp || ''), 1, '');
  return { id: model.id.toLowerCase(), time, remainder: fraction.padEnd(9, '0').slice(3) };
}

export function comparePositions(left, right) {
  if (left.time !== right.time) return left.time < right.time ? -1 : 1;
  if (left.remainder !== right.remainder) return left.remainder < right.remainder ? -1 : 1;
  return left.id === right.id ? 0 : left.id < right.id ? -1 : 1;
}
