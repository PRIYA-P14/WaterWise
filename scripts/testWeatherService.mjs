/**
 * testWeatherService.mjs
 *
 * Standalone verification of src/services/weatherService.js data mapping.
 * Stubs globalThis.fetch — no network access required.
 *
 * Run: node scripts/testWeatherService.mjs
 */

import {
  fetchWeather,
  validateCoords,
  wmoDescription,
  wmoIcon,
} from '../src/services/weatherService.js';

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`);
  }
}

// ── Realistic Open-Meteo payload (trimmed to 3 hourly + 8 daily entries) ─────
function makePayload({ omitDailyProbability = false, dailyWithoutLastEntry = false } = {}) {
  const dailyTime = dailyWithoutLastEntry
    ? ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']
    : ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  const n = dailyTime.length;
  const pad = (arr, len, fill = null) => [...arr, ...Array(Math.max(0, len - arr.length)).fill(fill)];

  return {
    latitude: 11.1667,
    longitude: 78.1667,
    timezone: 'Asia/Kolkata',
    current: {
      time: '2026-10-17T09:15',
      temperature_2m: 28.4,
      apparent_temperature: 31.2,
      relative_humidity_2m: 74,
      precipitation: 0,
      weathercode: 2,
      windspeed_10m: 11.3,
    },
    hourly: {
      time: ['2026-10-17T09:00', '2026-10-17T10:00', '2026-10-17T11:00'],
      temperature_2m: [28.4, 29.1, 30.0],
      apparent_temperature: [31.2, 32.0, 33.1],
      precipitation_probability: [20, 25, null],
      precipitation: [0, 0, 0.1],
      weathercode: [2, 3, 61],
    },
    daily: {
      time: dailyTime,
      temperature_2m_max: pad([33.2, 34.0, 32.8, 31.5, 30.9, 32.0, 33.1, 34.2], n),
      temperature_2m_min: pad([24.1, 24.5, 23.9, 23.0, 22.8, 23.4, 24.0, 24.6], n),
      precipitation_sum: pad([0, 4.6, 12.3, 0.2, 0, 0, 1.1, 0], n),
      ...(omitDailyProbability
        ? {}
        : {
            precipitation_probability_max: pad([10, 65, 90, 30, 5, 8, 45, 12], n),
          }),
      weathercode: pad([2, 61, 63, 80, 0, 1, 80, 3], n),
    },
  };
}

function installFetchMock(payloadOrFn, { status = 200, statusText = 'OK' } = {}) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const body = typeof payloadOrFn === 'function' ? payloadOrFn(String(url)) : payloadOrFn;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: async () => body,
    };
  };
  return calls;
}


// ── 1. Request URL includes daily fields, 8 forecast days, auto timezone ─────
console.log('\n[1] Request construction');
{
  const calls = installFetchMock(makePayload());
  await fetchWeather(11.1667, 78.1667);
  const url = new URL(calls[0].url);
  assert(url.hostname === 'api.open-meteo.com', 'targets api.open-meteo.com');
  const dailyFields = url.searchParams.get('daily').split(',');
  for (const f of ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_probability_max', 'weathercode'])
    assert(dailyFields.includes(f), `daily field requested: ${f}`);
  assert(url.searchParams.get('forecast_days') === '8', 'forecast_days=8 requested');
  assert(url.searchParams.get('timezone') === 'auto', 'timezone=auto requested');
}

// ── 2. Daily mapping: shape, units passthrough, 8 entries ────────────────────
console.log('\n[2] Daily mapping');
{
  installFetchMock(makePayload());
  const wx = await fetchWeather(11.1667, 78.1667);
  assert(Array.isArray(wx.daily) && wx.daily.length === 8, 'daily has 8 entries');
  const d1 = wx.daily[1];
  assert(d1.date === '2026-10-18', 'date maps from time');
  assert(d1.tempMax === 34.0, 'tempMax maps (°C passthrough)');
  assert(d1.tempMin === 24.5, 'tempMin maps (°C passthrough)');
  assert(d1.precipitationSum === 4.6, 'precipitationSum maps (mm passthrough)');
  assert(d1.precipitationProbabilityMax === 65, 'precipitationProbabilityMax maps (% passthrough)');
  assert(d1.weathercode === 61, 'weathercode maps');
  assert(d1.description === 'Slight rain', 'description derived from WMO code');
  assert(typeof wx.fetchedAt === 'string' && !isNaN(Date.parse(wx.fetchedAt)), 'fetchedAt is ISO timestamp');
  assert(wx.timezone === 'Asia/Kolkata', 'timezone passed through');
}

// ── 3. Missing daily probability field → null, no invented values ────────────
console.log('\n[3] Missing fields');
{
  installFetchMock(makePayload({ omitDailyProbability: true }));
  const wx = await fetchWeather(11.1667, 78.1667);
  assert(wx.daily.length === 8, 'daily still returned without probability field');
  assert(wx.daily.every((d) => d.precipitationProbabilityMax === null), 'missing probability maps to null');
  assert(wx.daily[1].precipitationSum === 4.6, 'other daily fields unaffected');
}

// ── 4. Short daily arrays (API returned fewer entries) — no crash, no padding ─
console.log('\n[4] Short/empty daily arrays');
{
  installFetchMock(makePayload({ dailyWithoutLastEntry: true }));
  const wx = await fetchWeather(11.1667, 78.1667);
  assert(wx.daily.length === 7, 'short daily array maps to 7 entries (no padding)');
  assert(wx.daily[6].tempMax === 33.1, 'last available entry mapped');

  installFetchMock({ ...makePayload(), daily: undefined });
  const wx2 = await fetchWeather(11.1667, 78.1667);
  assert(Array.isArray(wx2.daily) && wx2.daily.length === 0, 'absent daily object maps to [] (UI hides section)');
}

// ── 5. Hourly mapping still intact (existing feature regression) ─────────────
console.log('\n[5] Hourly + current mapping (regression)');
{
  installFetchMock(makePayload());
  const wx = await fetchWeather(11.1667, 78.1667);
  assert(wx.hourly.length === 3, 'hourly entries mapped');
  const h0 = wx.hourly[0];
  assert(h0.temperature === 28.4 && h0.apparentTemperature === 31.2, 'hourly temps map');
  assert(h0.precipitationProbability === 20, 'hourly probability maps');
  assert(wx.hourly[2].precipitationProbability === null, 'null hourly probability stays null');
  assert(wx.current.temperature === 28.4, 'current temperature maps');
  assert(wx.current.time === '2026-10-17T09:15', 'current local timestamp maps');
  assert(wx.current.description === 'Partly cloudy', 'current description from WMO code');
}

// ── 6. Error states: HTTP error propagates, no invented data ─────────────────
console.log('\n[6] Error handling');
{
  installFetchMock({}, { status: 400, statusText: 'Bad Request' });
  let err = null;
  try { await fetchWeather(11.1667, 78.1667); } catch (e) { err = e; }
  assert(err !== null && err.message.includes('HTTP 400'), 'HTTP 400 throws with status message');

  installFetchMock({ hourly: { time: [] } }, { status: 200 });
  err = null;
  try { await fetchWeather(11.1667, 78.1667); } catch (e) { err = e; }
  assert(err !== null && err.message.includes('no hourly data'), 'empty hourly data throws descriptive error');

  let threw = false;
  try { validateCoords(999, 0); } catch { threw = true; }
  assert(threw, 'invalid latitude rejected before any request');
}

// ── 7. WMO helpers handle null without inventing values ──────────────────────
console.log('\n[7] WMO helpers');
{
  assert(wmoDescription(null) === 'Unknown', 'null code → Unknown description');
  assert(wmoIcon(null) === '❓', 'null code → ❓ icon');
  assert(wmoDescription(63) === 'Moderate rain', 'code 63 → Moderate rain');
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
