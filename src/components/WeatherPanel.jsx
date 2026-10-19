import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { wmoIcon } from '../services/weatherService';
import { selectNext24HourlyForecast } from '../services/hourlyForecast';

// ── Custom tooltips (module scope so they are not recreated during render) ───

function HourlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const get = (key) => payload.find((p) => p.dataKey === key)?.value ?? null;
  return (
    <div className="wp-chart-tooltip">
      <p className="wp-chart-tooltip-time">{label}</p>
      {get('temp')   !== null && <p>🌡 Temp: <strong>{get('temp')}°C</strong></p>}
      {get('feels')  !== null && <p>🤔 Feels like: <strong>{get('feels')}°C</strong></p>}
      {get('prob')   !== null && <p>🌧 Rain prob: <strong>{get('prob')}%</strong></p>}
      {get('precip') !== null && <p>💧 Precip: <strong>{get('precip')} mm</strong></p>}
    </div>
  );
}

function DailyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const get = (key) => payload.find((p) => p.dataKey === key)?.value ?? null;
  return (
    <div className="wp-chart-tooltip">
      <p className="wp-chart-tooltip-time">{label}</p>
      {get('precip') !== null && <p>💧 Precip: <strong>{get('precip')} mm</strong></p>}
      {get('prob')   !== null && <p>🌧 Rain prob: <strong>{get('prob')}%</strong></p>}
    </div>
  );
}

/**
 * WeatherPanel — pure display component, never fetches.
 *
 * Props:
 *   weather  — object returned by fetchWeather()
 *   location — { village, district, country, lat, lon }
 *   accuracy — GPS accuracy in metres (optional)
 */
export default function WeatherPanel({ weather, location, accuracy }) {
  const { current, hourly, daily, fetchedAt, timezone } = weather ?? {};

  // ── Formatters ────────────────────────────────────────────────────────────

  function fmt(val, unit, decimals = 1) {
    if (val === null || val === undefined) return '—';
    const n = Number(val);
    return Number.isFinite(n) ? `${n.toFixed(decimals)}${unit}` : '—';
  }

  function fmtTime(isoStr) {
    const d = new Date(isoStr);
    return isNaN(d) ? isoStr : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  // Parse "YYYY-MM-DD" as a local date (avoids UTC midnight timezone shift)
  function fmtDate(isoStr) {
    const [y, m, day] = isoStr.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    return isNaN(d) ? isoStr : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Short weekday label for chart x-axis
  function fmtDayShort(isoStr) {
    const [y, m, day] = isoStr.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    return isNaN(d) ? isoStr : d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  function fmtUpdated(iso) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const locationLabel =
    [location?.village, location?.district, location?.country].filter(Boolean).join(', ') ||
    'Your location';

  // Today's high/low from daily[0]
  const todayDaily = daily?.[0] ?? null;

  // Next-24-hours slice for hourly chart + table
  const next24 = useMemo(
    () => selectNext24HourlyForecast(hourly, current?.time),
    [hourly, current?.time],
  );

  // Hourly chart data
  const hourlyChartData = useMemo(
    () =>
      next24.map((h) => ({
        time:   fmtTime(h.time),
        temp:   h.temperature          !== null ? Number(h.temperature.toFixed(1))          : null,
        feels:  h.apparentTemperature  !== null ? Number(h.apparentTemperature.toFixed(1))  : null,
        prob:   h.precipitationProbability ?? null,
        precip: h.precipitation        !== null ? Number(h.precipitation.toFixed(1))        : null,
      })),
    [next24],
  );

  // 7-day daily chart data (days 0–6)
  const dailyChartData = useMemo(
    () =>
      (daily ?? []).slice(0, 7).map((d, i) => ({
        day:    i === 0 ? 'Today' : fmtDayShort(d.date),
        precip: d.precipitationSum              !== null ? Number(d.precipitationSum.toFixed(1))              : null,
        prob:   d.precipitationProbabilityMax   ?? null,
      })),
    [daily],
  );

  // ── Farmer rain advisory ──────────────────────────────────────────────────
  // Show a cautious note if any of the next 7 days has ≥40% rain probability
  // or ≥1 mm forecast. Never recommends skipping irrigation — only prompts
  // the farmer to recheck before deciding.
  const rainAdvisory = useMemo(() => {
    if (!daily || daily.length === 0) return null;
    const next7 = daily.slice(0, 7);

    // Days with meaningful rain signal
    const rainyDays = next7.filter(
      (d) =>
        (d.precipitationProbabilityMax !== null && d.precipitationProbabilityMax >= 40) ||
        (d.precipitationSum !== null && d.precipitationSum >= 1),
    );
    if (rainyDays.length === 0) return null;

    // Find the highest single-day probability and total in the window
    const maxProb = Math.max(
      ...rainyDays.map((d) => d.precipitationProbabilityMax ?? 0),
    );
    const totalMm = rainyDays.reduce(
      (sum, d) => sum + (d.precipitationSum ?? 0),
      0,
    );

    return { rainyDays: rainyDays.length, maxProb, totalMm: Number(totalMm.toFixed(1)) };
  }, [daily]);

  // ── Build hourly table rows with day-separator markers ────────────────────
  const next24Rows = useMemo(() => {
    const rows = [];
    let lastDay = '';
    next24.forEach((row) => {
      const dayLabel = fmtDate(row.time.slice(0, 10));
      if (dayLabel !== lastDay) {
        rows.push({ type: 'day', label: dayLabel, key: `day-${row.time}` });
        lastDay = dayLabel;
      }
      rows.push({ type: 'hour', data: row, key: row.time });
    });
    return rows;
  }, [next24]);

  // All hooks must run before any early return (rules of hooks)
  if (!weather) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="wp-card">

      {/* ── Header ── */}
      <div className="wp-header">
        <div className="wp-header-left">
          <span className="wp-title">📡 Live Weather Forecast</span>
          <span className="wp-location">{locationLabel}</span>
          <span className="wp-coords">
            {Number(location.lat).toFixed(5)}°, {Number(location.lon).toFixed(5)}°
            {accuracy != null && (
              <span
                className={`fc-accuracy-badge ${accuracy <= 500 ? 'good' : 'poor'}`}
                style={{ marginLeft: '8px' }}
              >
                GPS ±{Math.round(accuracy)} m {accuracy <= 500 ? '✓' : '⚠'}
              </span>
            )}
          </span>
        </div>
        <div className="wp-fetched">
          Updated: {fmtUpdated(fetchedAt)}
          {timezone && timezone !== 'UTC' && <span className="wp-tz"> · {timezone}</span>}
        </div>
      </div>

      {/* ── Current conditions ── */}
      <div className="wp-current-grid">
        <div className="wp-current-main">
          <span className="wp-current-icon">{wmoIcon(current.weathercode)}</span>
          <div>
            <p className="wp-current-desc">{current.description}</p>
            <p className="wp-current-temp">{fmt(current.temperature, '°C', 1)}</p>
            {current.apparentTemperature !== null && (
              <p className="wp-current-feels">
                Feels like {fmt(current.apparentTemperature, '°C', 1)}
              </p>
            )}
          </div>
        </div>

        <div className="wp-current-stats">
          {todayDaily && (
            <div className="wp-stat wp-stat-hilow">
              <span className="wp-stat-label">Today's forecast</span>
              <span className="wp-stat-value">
                <span className="wp-hi">{fmt(todayDaily.tempMax, '°', 0)}</span>
                {' / '}
                <span className="wp-lo">{fmt(todayDaily.tempMin, '°', 0)}</span>
              </span>
              <span className="wp-stat-sub">High / Low</span>
            </div>
          )}
          <div className="wp-stat">
            <span className="wp-stat-label">Humidity</span>
            <span className="wp-stat-value">{fmt(current.humidity, '%', 0)}</span>
          </div>
          <div className="wp-stat">
            <span className="wp-stat-label">Wind</span>
            <span className="wp-stat-value">{fmt(current.windspeed, ' km/h', 0)}</span>
          </div>
          <div className="wp-stat">
            <span className="wp-stat-label">Precip (last hr)</span>
            <span className="wp-stat-value">{fmt(current.precipitation, ' mm', 1)}</span>
          </div>
        </div>
      </div>

      {/* ── Farmer rain advisory ── */}
      {rainAdvisory && (
        <div className="wp-rain-advisory">
          <span className="wp-rain-advisory-icon">🌧</span>
          <div>
            <strong>Rain may be forecast in the coming days.</strong>{' '}
            The model shows a chance of rain on {rainAdvisory.rainyDays} day
            {rainAdvisory.rainyDays !== 1 ? 's' : ''} in the next 7 days
            (up to {rainAdvisory.maxProb}% probability, forecast total{' '}
            {rainAdvisory.totalMm} mm). Weather forecasts are model estimates
            and can change. <strong>Check the forecast again closer to the time
            and inspect your field conditions before deciding whether to
            irrigate.</strong> Do not skip irrigation based on forecast rain
            alone — actual rainfall may be less than predicted.
          </div>
        </div>
      )}

      {/* ── Forecast disclaimer ── */}
      <div className="wp-forecast-note">
        ℹ️ <strong>Rain probability</strong> is the modelled chance (%) of precipitation
        occurring — a forecast estimate, not a guarantee.{' '}
        <strong>Precip amount</strong> is the forecast quantity in mm. Actual conditions
        may differ from these model values.
      </div>

      {/* ── 7-day daily forecast cards ── */}
      {daily && daily.length > 0 && (
        <>
          <p className="wp-section-label">7-Day Forecast</p>
          <div className="wp-daily-grid">
            {daily.slice(0, 7).map((d, i) => (
              <div key={d.date} className={`wp-daily-card${i === 0 ? ' wp-daily-today' : ''}`}>
                <p className="wp-daily-date">{i === 0 ? 'Today' : fmtDate(d.date)}</p>
                <span className="wp-daily-icon">{wmoIcon(d.weathercode)}</span>
                <p className="wp-daily-desc">{d.description}</p>
                <div className="wp-daily-temps">
                  <span className="wp-hi">{fmt(d.tempMax, '°', 0)}</span>
                  <span className="wp-daily-sep">/</span>
                  <span className="wp-lo">{fmt(d.tempMin, '°', 0)}</span>
                </div>
                <div className="wp-daily-precip">
                  <span className="wp-daily-prob">
                    {d.precipitationProbabilityMax !== null
                      ? `${d.precipitationProbabilityMax}% chance`
                      : '—'}
                  </span>
                  <span className="wp-daily-mm">
                    {d.precipitationSum !== null
                      ? `${Number(d.precipitationSum).toFixed(1)} mm`
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 7-day rain chart ── */}
      {dailyChartData.length > 0 && (
        <>
          <p className="wp-section-label">7-Day Rain Forecast</p>
          <div className="wp-chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={dailyChartData}
                margin={{ top: 4, right: 36, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-200)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'var(--neutral-600)' }}
                  tickLine={false}
                />
                {/* Left axis: precipitation amount in mm */}
                <YAxis
                  yAxisId="mm"
                  tick={{ fontSize: 10, fill: 'var(--neutral-600)' }}
                  tickLine={false}
                  axisLine={false}
                  unit=" mm"
                  width={42}
                  allowDecimals={false}
                />
                {/* Right axis: probability % */}
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#1565c0' }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                  width={34}
                />
                <Tooltip content={<DailyTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '0.72rem', paddingTop: '6px' }}
                  formatter={(value) =>
                    ({ precip: 'Precip amount (mm)', prob: 'Rain probability (%)' }[value] ?? value)
                  }
                />
                <Bar
                  yAxisId="mm"
                  dataKey="precip"
                  name="precip"
                  fill="#90caf9"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="prob"
                  name="prob"
                  stroke="#1565c0"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#1565c0' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="wp-chart-note">
              Bars = forecast precipitation amount (mm) · Line = rain probability (%) · Both are model estimates.
            </p>
          </div>
        </>
      )}

      {/* ── Next-24-hours hourly chart ── */}
      <p className="wp-section-label">Next 24 Hours — Hourly Chart</p>
      <div className="wp-chart-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={hourlyChartData} margin={{ top: 4, right: 36, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-200)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--neutral-600)' }}
              interval={3}
              tickLine={false}
            />
            <YAxis
              yAxisId="temp"
              tick={{ fontSize: 10, fill: 'var(--neutral-600)' }}
              tickLine={false}
              axisLine={false}
              unit="°"
              width={32}
            />
            <YAxis
              yAxisId="prob"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#1565c0' }}
              tickLine={false}
              axisLine={false}
              unit="%"
              width={34}
            />
            <Tooltip content={<HourlyTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.72rem', paddingTop: '6px' }}
              formatter={(value) =>
                ({
                  temp:   'Temp (°C)',
                  feels:  'Feels like (°C)',
                  prob:   'Rain prob (%)',
                  precip: 'Precip (mm)',
                }[value] ?? value)
              }
            />
            <Bar
              yAxisId="prob"
              dataKey="precip"
              name="precip"
              fill="#90caf9"
              opacity={0.55}
              radius={[2, 2, 0, 0]}
              maxBarSize={14}
            />
            <Line
              yAxisId="prob"
              type="monotone"
              dataKey="prob"
              name="prob"
              stroke="#1565c0"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="feels"
              name="feels"
              stroke="#81c784"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name="temp"
              stroke="#e65100"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="wp-chart-note">
          Bars = precip amount (mm) · Blue line = rain probability (%) · Orange = temperature · Green dashed = feels like
        </p>
      </div>

      {/* ── Next-24-hours hourly table ── */}
      <p className="wp-section-label">Next 24 Hours — Hourly Detail</p>
      <div className="wp-table-wrapper">
        <table className="wp-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Condition</th>
              <th>Temp</th>
              <th>Feels like</th>
              <th>Rain prob.</th>
              <th>Precip</th>
            </tr>
          </thead>
          <tbody>
            {next24Rows.map((row) => {
              if (row.type === 'day') {
                return (
                  <tr key={row.key} className="wp-day-row">
                    <td colSpan={6}>{row.label}</td>
                  </tr>
                );
              }
              const { data: r } = row;
              return (
                <tr
                  key={row.key}
                  className={r.precipitationProbability >= 70 ? 'wp-row-rainy' : ''}
                >
                  <td className="wp-time-cell">{fmtTime(r.time)}</td>
                  <td>{wmoIcon(r.weathercode)} {r.description}</td>
                  <td>{fmt(r.temperature, '°C', 1)}</td>
                  <td>{fmt(r.apparentTemperature, '°C', 1)}</td>
                  <td>
                    <div className="wp-prob-bar-wrap">
                      <div
                        className="wp-prob-bar"
                        style={{ width: `${Math.min(r.precipitationProbability ?? 0, 100)}%` }}
                      />
                      <span className="wp-prob-label">
                        {r.precipitationProbability !== null ? `${r.precipitationProbability}%` : '—'}
                      </span>
                    </div>
                  </td>
                  <td>{fmt(r.precipitation, ' mm', 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Attribution ── */}
      <p className="wp-attribution">
        Weather:{' '}
        <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        {' '}(free, open-source) · Location:{' '}
        <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        {' '}/ Nominatim. Forecasts are model estimates — actual conditions may vary.
      </p>
    </div>
  );
}
