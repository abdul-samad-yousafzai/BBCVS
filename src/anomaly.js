export function checkIssuanceBurst(timestamps, { windowMs, limit }) {
  if (!Array.isArray(timestamps) || !Number.isFinite(windowMs) || windowMs <= 0
    || !Number.isFinite(limit) || limit < 0) {
    throw new TypeError("Valid timestamps, windowMs, and limit are required.");
  }

  const orderedTimestamps = timestamps
    .map((timestamp) => (timestamp instanceof Date ? timestamp.getTime() : timestamp))
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((left, right) => left - right);

  let maximumCount = 0;
  let start = 0;
  for (let end = 0; end < orderedTimestamps.length; end += 1) {
    while (orderedTimestamps[end] - orderedTimestamps[start] >= windowMs) {
      start += 1;
    }
    maximumCount = Math.max(maximumCount, end - start + 1);
  }

  return maximumCount > limit
    ? { level: "warning", count: maximumCount, windowMs }
    : null;
}
