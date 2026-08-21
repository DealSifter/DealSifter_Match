function toStableSnapshot(value, ancestors = new WeakSet()) {
  if (value === undefined) return ['__undefined__'];
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return ['__date__', value.toISOString()];
  if (ancestors.has(value)) throw new TypeError('Circular state snapshot');

  ancestors.add(value);
  let snapshot;
  if (Array.isArray(value)) {
    snapshot = value.map((entry) => toStableSnapshot(entry, ancestors));
  } else if (value instanceof Map) {
    snapshot = ['__map__', [...value.entries()]
      .map(([key, entry]) => [String(key), toStableSnapshot(entry, ancestors)])
      .sort(([left], [right]) => left.localeCompare(right))];
  } else if (value instanceof Set) {
    snapshot = ['__set__', [...value]
      .map((entry) => toStableSnapshot(entry, ancestors))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))];
  } else {
    snapshot = Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = toStableSnapshot(value[key], ancestors);
        return result;
      }, {});
  }
  ancestors.delete(value);
  return snapshot;
}

export function areDataSnapshotsEquivalent(left, right) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(toStableSnapshot(left)) === JSON.stringify(toStableSnapshot(right));
  } catch {
    return false;
  }
}

export function preserveEquivalentState(previous, next) {
  return areDataSnapshotsEquivalent(previous, next) ? previous : next;
}
