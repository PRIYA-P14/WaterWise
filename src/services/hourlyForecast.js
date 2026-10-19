/**
 * Select the upcoming hourly forecast from Open-Meteo's local forecast times.
 *
 * Open-Meteo returns `current.time` and hourly `time` in the location's
 * `timezone=auto` wall-clock format (for example, 2026-10-18T00:00), without
 * a UTC offset. They are therefore compared as local forecast timestamps,
 * rather than converted through the browser's timezone.
 *
 * If currentTime is unavailable or invalid, the earliest valid hourly record
 * is used as a safe fallback. This does not invent a current time; it only
 * prevents a valid forecast from being discarded when the current field is
 * absent.
 */

const LOCAL_FORECAST_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

function timestampKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (LOCAL_FORECAST_TIME.test(trimmed)) return trimmed;

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function isAtOrAfter(value, start) {
  const valueKey = timestampKey(value);
  const startKey = timestampKey(start);
  if (valueKey === null || startKey === null) return false;
  if (typeof valueKey === 'string' && typeof startKey === 'string') {
    return valueKey >= startKey;
  }
  if (typeof valueKey === 'number' && typeof startKey === 'number') {
    return valueKey >= startKey;
  }
  return false;
}

export function selectNext24HourlyForecast(hourly, currentTime = null) {
  if (!Array.isArray(hourly) || hourly.length === 0) return [];

  const validRows = hourly.filter((row) => timestampKey(row?.time) !== null);
  if (validRows.length === 0) return [];

  const requestedStart = timestampKey(currentTime) === null ? null : currentTime;
  const startTime = requestedStart ?? validRows[0].time;

  return validRows
    .filter((row) => isAtOrAfter(row.time, startTime))
    .slice(0, 24);
}
