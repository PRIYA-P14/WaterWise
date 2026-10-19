/**
 * Initial software freshness policy for this experimental prototype.
 *
 * A successful forecast fetch is fresh for up to and including 60 minutes.
 * This is not an agronomic or official weather standard. Future fetch
 * timestamps are rejected because they cannot prove that the data is current.
 */

export const FORECAST_FRESHNESS_WINDOW_MS = 60 * 60 * 1000;

export function validateForecastFreshness(weather, nowMs = Date.now()) {
  const fetchedAtMs = Date.parse(weather?.fetchedAt ?? '');
  if (!Number.isFinite(fetchedAtMs)) {
    return {
      fresh: false,
      reason: 'The forecast fetch timestamp is missing or invalid. Refresh the forecast before reassessing.',
    };
  }

  if (!Number.isFinite(nowMs)) {
    return {
      fresh: false,
      reason: 'The current time could not be validated. Refresh the forecast before reassessing.',
    };
  }

  if (fetchedAtMs > nowMs) {
    return {
      fresh: false,
      reason: 'The forecast fetch timestamp is in the future and cannot be validated. Refresh the forecast before reassessing.',
    };
  }

  if (nowMs - fetchedAtMs > FORECAST_FRESHNESS_WINDOW_MS) {
    return {
      fresh: false,
      reason: 'The forecast is more than 60 minutes old. Refresh the forecast before reassessing.',
    };
  }

  return { fresh: true, reason: '' };
}
