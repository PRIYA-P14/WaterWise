/**
 * weatherService.js
 *
 * External services (both free, no API key required):
 *
 *  1. Nominatim (OpenStreetMap) — reverse geocoding
 *     https://nominatim.openstreetmap.org/reverse
 *     Rate limit: 1 req/s. One call per user click — well within limits.
 *
 *  2. Open-Meteo — weather forecast
 *     https://api.open-meteo.com/v1/forecast
 *     Free for non-commercial use, no API key required.
 *
 * To add a commercial geocoding key later:
 *   Store it as VITE_GEOCODE_API_KEY in a .env file and read via
 *   import.meta.env.VITE_GEOCODE_API_KEY — never hardcode keys in source.
 */

// ── Coordinate validation ────────────────────────────────────────────────────

/**
 * Throws a descriptive Error if lat/lon are outside valid WGS-84 ranges.
 * Called before every external request so we never send garbage to an API.
 */
export function validateCoords(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || la < -90  || la > 90)
    throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
  if (!Number.isFinite(lo) || lo < -180 || lo > 180)
    throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
}

// ── Fetch with timeout ───────────────────────────────────────────────────────

/**
 * fetch() wrapper that aborts after `ms` milliseconds.
 * Throws a plain Error with a user-friendly message on timeout.
 */
async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === 'AbortError')
      throw new Error('Request timed out. Check your internet connection and try again.', { cause: err });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Retry with exponential backoff ───────────────────────────────────────────

/**
 * Retries `fn` up to `maxAttempts` times for retryable HTTP status codes
 * (503 Service Unavailable, 429 Too Many Requests) and network errors.
 * Waits baseDelayMs * 2^attempt before each retry (capped at 8 s).
 * Does NOT retry on 4xx client errors (bad request, not found, etc.)
 * except 429.
 *
 * Returns the parsed JSON on success.
 * Throws the last error if all attempts fail.
 */
const RETRYABLE = new Set([429, 503, 502, 504]);

async function fetchWithRetry(url, fetchOptions = {}, maxAttempts = 3, baseDelayMs = 800) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(baseDelayMs * 2 ** attempt, 8000);
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const res = await fetchWithTimeout(url, fetchOptions, 12000);
      if (res.ok) return await res.json();

      // For retryable codes keep looping; for others throw immediately
      const msg = `HTTP ${res.status} ${res.statusText}`;
      if (!RETRYABLE.has(res.status)) throw new Error(msg);
      lastErr = new Error(msg);
      // loop continues → retry
    } catch (err) {
      lastErr = err;
      // Network / timeout errors are retryable; abort errors propagate
      if (err.message.includes('timed out') || err.name === 'TypeError') continue;
      throw err; // non-retryable
    }
  }
  throw lastErr;
}

// ── Forward geocoding (manual entry → coords) ───────────────────────────────

/**
 * Searches Nominatim for a place name string (e.g. "Namakkal, Tamil Nadu").
 * Returns { lat, lon, displayName } for the best match, or throws if none found.
 * Used when the user types their location manually and wants a weather forecast.
 */
export async function forwardGeocode(query) {
  if (!query || !query.trim()) throw new Error('Please enter a location to search.');

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query.trim())}&format=json&limit=1&addressdetails=1`;

  const data = await fetchWithRetry(
    url,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'WaterWise-FarmAI/1.0 (educational prototype)' } },
    2,
    600,
  );

  if (!Array.isArray(data) || data.length === 0)
    throw new Error(`No location found for "${query.trim()}". Try a different spelling or add the district/state.`);

  const result = data[0];
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  validateCoords(lat, lon);

  return {
    lat,
    lon,
    displayName: result.display_name || '',
  };
}

// ── Reverse geocoding ────────────────────────────────────────────────────────

/**
 * Given validated lat/lon, returns:
 * { village, district, country, displayName, lat, lon }
 *
 * Uses the exact coordinates from GPS — no substitution or guessing.
 * Falls back to empty strings for fields Nominatim does not return.
 */
export async function reverseGeocode(lat, lon) {
  validateCoords(lat, lon);

  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1`;

  const data = await fetchWithRetry(
    url,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'WaterWise-FarmAI/1.0 (educational prototype)' } },
    2,   // max 2 attempts for geocoding
    600,
  );

  const addr = data.address || {};

  // Exact place name from OSM — most specific available level
  const village =
    addr.village      ||
    addr.town         ||
    addr.suburb       ||
    addr.hamlet       ||
    addr.city_district||
    addr.city         ||
    '';

  const district =
    addr.county        ||
    addr.state_district||
    addr.district      ||
    addr.state         ||
    '';

  return {
    village,
    district,
    country:     addr.country      || '',
    displayName: data.display_name || '',
    lat,   // exact GPS lat — not modified
    lon,   // exact GPS lon — not modified
  };
}

// ── Weather forecast ─────────────────────────────────────────────────────────

/**
 * Fetches current weather + 48-hour hourly forecast from Open-Meteo.
 * Validates coordinates before constructing the URL.
 * Retries up to 3 times on 503/429/network errors with backoff.
 *
 * Returns:
 * {
 *   fetchedAt: ISO string,   — when this data was retrieved (display to user)
 *   timezone:  string,
 *   current: {
 *     time,                  — local forecast timestamp from Open-Meteo
 *     temperature,           — °C
 *     apparentTemperature,   — °C feels-like
 *     humidity,              — %
 *     windspeed,             — km/h
 *     weathercode,           — WMO integer
 *     description,           — human-readable
 *     precipitation,         — mm in the last hour (observed, not forecast)
 *   },
 *   hourly: [{
 *     time,                  — "YYYY-MM-DDTHH:MM" in location's local timezone
 *     temperature,           — °C
 *     apparentTemperature,   — °C feels-like
 *     precipitation,         — mm forecast amount
 *     precipitationProbability, — % 0–100 (model estimate, not guaranteed)
 *     weathercode,
 *     description,
 *   }, ...]                  — 192 entries (8 days × 24 h)
 *   daily: [{
 *     date,                  — "YYYY-MM-DD"
 *     tempMax,               — °C daily high
 *     tempMin,               — °C daily low
 *     precipitationSum,      — mm total for the day
 *     precipitationProbabilityMax, — % max probability for the day
 *     weathercode,
 *     description,
 *   }, ...]                  — 8 entries
 * }
 */
export async function fetchWeather(lat, lon) {
  // Validate before touching the network — prevents 503s from bad coords
  validateCoords(lat, lon);

  // Round to 4 decimal places (~11 m precision) — sufficient for weather grids
  const latR = Number(lat).toFixed(4);
  const lonR = Number(lon).toFixed(4);

  const params = new URLSearchParams({
    latitude:  latR,
    longitude: lonR,
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'weathercode',
      'windspeed_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation_probability',
      'precipitation',
      'weathercode',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'weathercode',
    ].join(','),
    forecast_days: 8,
    timezone: 'auto',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const data = await fetchWithRetry(url, {}, 3, 800);

  // ── Parse current conditions ──
  const current = {
    time:                 data.current?.time                  ?? null,
    temperature:         data.current?.temperature_2m        ?? null,
    apparentTemperature: data.current?.apparent_temperature  ?? null,
    humidity:            data.current?.relative_humidity_2m  ?? null,
    windspeed:           data.current?.windspeed_10m         ?? null,
    weathercode:         data.current?.weathercode           ?? null,
    precipitation:       data.current?.precipitation         ?? null,
    description:         wmoDescription(data.current?.weathercode),
  };

  // ── Parse hourly arrays ──
  const times      = data.hourly?.time                      ?? [];
  const temps      = data.hourly?.temperature_2m            ?? [];
  const apparent   = data.hourly?.apparent_temperature      ?? [];
  const probs      = data.hourly?.precipitation_probability ?? [];
  const precip     = data.hourly?.precipitation             ?? [];
  const codes      = data.hourly?.weathercode               ?? [];

  if (times.length === 0) {
    throw new Error('Weather API returned no hourly data. Please try again.');
  }

  const hourly = times.map((t, i) => ({
    time:                     t,
    temperature:              temps[i]    ?? null,
    apparentTemperature:      apparent[i] ?? null,
    precipitationProbability: probs[i]    ?? null,
    precipitation:            precip[i]   ?? null,
    weathercode:              codes[i]    ?? null,
    description:              wmoDescription(codes[i]),
  }));

  // ── Parse daily arrays ──
  const dDates    = data.daily?.time                          ?? [];
  const dTempMax  = data.daily?.temperature_2m_max            ?? [];
  const dTempMin  = data.daily?.temperature_2m_min            ?? [];
  const dPrecip   = data.daily?.precipitation_sum             ?? [];
  const dProbMax  = data.daily?.precipitation_probability_max ?? [];
  const dCodes    = data.daily?.weathercode                   ?? [];

  const daily = dDates.map((date, i) => ({
    date,
    tempMax:                    dTempMax[i]  ?? null,
    tempMin:                    dTempMin[i]  ?? null,
    precipitationSum:           dPrecip[i]   ?? null,
    precipitationProbabilityMax: dProbMax[i] ?? null,
    weathercode:                dCodes[i]    ?? null,
    description:                wmoDescription(dCodes[i]),
  }));

  return {
    fetchedAt: new Date().toISOString(),
    timezone:  data.timezone ?? 'UTC',
    current,
    hourly,
    daily,
  };
}

// ── WMO weather code → human description ────────────────────────────────────

export function wmoDescription(code) {
  if (code === null || code === undefined) return 'Unknown';
  const map = {
    0:  'Clear sky',
    1:  'Mainly clear',    2: 'Partly cloudy',     3: 'Overcast',
    45: 'Fog',            48: 'Icy fog',
    51: 'Light drizzle',  53: 'Moderate drizzle',  55: 'Dense drizzle',
    61: 'Slight rain',    63: 'Moderate rain',      65: 'Heavy rain',
    71: 'Slight snow',    73: 'Moderate snow',      75: 'Heavy snow',
    80: 'Slight showers', 81: 'Moderate showers',   82: 'Violent showers',
    95: 'Thunderstorm',   96: 'Thunderstorm + hail', 99: 'Heavy thunderstorm',
  };
  return map[code] ?? `Condition ${code}`;
}

export function wmoIcon(code) {
  if (code === null || code === undefined) return '❓';
  if (code === 0)  return '☀️';
  if (code <= 3)   return '⛅';
  if (code <= 48)  return '🌫️';
  if (code <= 55)  return '🌦️';
  if (code <= 65)  return '🌧️';
  if (code <= 75)  return '❄️';
  if (code <= 82)  return '🌦️';
  return '⛈️';
}
