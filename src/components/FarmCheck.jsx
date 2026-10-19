import { useState } from 'react';
import {
  MapPin, Leaf, Calendar, CloudRain, Droplets,
  RotateCcw, ClipboardList, LocateFixed, AlertTriangle,
  CheckCircle, RefreshCw,
} from 'lucide-react';
import { reverseGeocode, forwardGeocode, fetchWeather } from '../services/weatherService';
import WeatherPanel from './WeatherPanel';
import { evaluateIrrigationDecision } from '../irrigationDecisionEngine';

const SOIL_OPTIONS = ['Dry', 'Moist', 'Wet', 'Not Sure'];

const EMPTY = {
  village: '',
  district: '',
  crop: '',
  cropAge: '',
  lastIrrigation: '',
  rainfall: '',
  soilCondition: '',
};

// GPS accuracy thresholds
const ACCURACY_WARN_M  = 500;   // warn but allow confirmation
const ACCURACY_BLOCK_M = 2000;  // require retry or manual entry

// watchPosition collection window — gather readings for this many ms,
// then pick the one with the best (lowest) reported accuracy.
const WATCH_WINDOW_MS = 8000;

// Geolocation state machine
const GEO = {
  IDLE:       'idle',
  LOCATING:   'locating',   // watchPosition running, collecting readings
  GEOCODING:  'geocoding',
  CONFIRM:    'confirm',    // user sees coords + place before weather loads
  DONE:       'done',
  ERROR:      'error',
};

function validate(fields) {
  const errs = {};
  if (!fields.village.trim())  errs.village  = 'Village or town is required.';
  if (!fields.district.trim()) errs.district = 'District is required.';
  if (!fields.crop.trim())     errs.crop     = 'Crop name is required.';
  if (fields.cropAge === '')   errs.cropAge  = 'Crop age is required.';
  else if (Number(fields.cropAge) < 0 || !Number.isFinite(Number(fields.cropAge)))
    errs.cropAge = 'Enter a valid number of days (0 or more).';
  if (!fields.lastIrrigation)  errs.lastIrrigation = 'Last irrigation date and time is required.';
  if (!fields.soilCondition)   errs.soilCondition  = 'Please select a soil condition.';
  return errs;
}

// ── Accuracy badge ────────────────────────────────────────────────────────────

function AccuracyBadge({ accuracy }) {
  if (accuracy === null) return null;
  const m = Math.round(accuracy);
  const good = m <= ACCURACY_WARN_M;
  return (
    <span className={`fc-accuracy-badge ${good ? 'good' : 'poor'}`}>
      GPS ±{m} m {good ? '✓' : '⚠'}
    </span>
  );
}

// ── Location confirmation panel ───────────────────────────────────────────────

function LocationConfirm({ geo, accuracy, readingCount, onConfirm, onRetry, onManual }) {
  const tooInaccurate = accuracy !== null && accuracy > ACCURACY_BLOCK_M;
  const warnInaccurate = accuracy !== null && accuracy > ACCURACY_WARN_M && !tooInaccurate;

  // Generic wrong-location detection: resolved place doesn't contain the
  // typed village/district (if any). We show a general Wi-Fi database warning
  // rather than hardcoding any specific place name.
  const resolvedFull = [geo.village, geo.district, geo.country].filter(Boolean).join(', ');

  return (
    <div className="fc-confirm-box">
      <p className="fc-confirm-title">
        <MapPin size={14} /> Confirm Your Location
      </p>

      <div className="fc-confirm-coords">
        <span className="fc-confirm-label">Coordinates</span>
        <span className="fc-confirm-value">
          {geo.lat.toFixed(5)}°, {geo.lon.toFixed(5)}°
        </span>
        <AccuracyBadge accuracy={accuracy} />
        {readingCount > 1 && (
          <span className="fc-reading-count">best of {readingCount} readings</span>
        )}
      </div>

      <div className="fc-confirm-place">
        <span className="fc-confirm-label">Resolved place</span>
        <span className="fc-confirm-value fc-confirm-place-name">
          {geo.displayName || resolvedFull || 'Place name not available — check coordinates above'}
        </span>
      </div>

      {/* General Wi-Fi triangulation warning — shown for any poor-accuracy fix */}
      {(tooInaccurate || warnInaccurate) && (
        <div className={tooInaccurate ? 'fc-geo-error' : 'fc-accuracy-warn'}
             style={{ marginTop: '10px' }}>
          <AlertTriangle size={13} />
          <span>
            GPS accuracy is ±{Math.round(accuracy)} m.{' '}
            {tooInaccurate
              ? 'This is too imprecise to use reliably. '
              : 'This may not match your exact farm location. '}
            Your browser is using Wi-Fi or cell tower triangulation rather than
            a hardware GPS chip. If the resolved place looks wrong, this is
            because a nearby Wi-Fi router is registered at a different address
            in your browser's location database — <strong>retrying will not fix
            a database error</strong>. Use <strong>"Enter manually"</strong> to
            type your actual location instead.
          </span>
        </div>
      )}

      <div className="fc-confirm-actions">
        {!tooInaccurate && (
          <button type="button" className="btn-fc-confirm" onClick={onConfirm}>
            <CheckCircle size={14} /> Yes, use this location
          </button>
        )}
        <button type="button" className="btn-fc-locate" onClick={onRetry}>
          <RefreshCw size={14} /> Retry GPS
        </button>
        <button type="button" className="btn-fc-reset" onClick={onManual}>
          Enter manually
        </button>
      </div>
    </div>
  );
}

// ── Summary panel ─────────────────────────────────────────────────────────────

function DecisionPanel({ data, weather, weatherLoading, weatherError, onRetryWeather }) {
  const decision = evaluateIrrigationDecision(
    {
      location: [data.village, data.district].filter(Boolean).join(', '),
      crop: data.crop,
      cropAge: data.cropAge,
      lastIrrigation: data.lastIrrigation,
      rainfall: data.rainfall,
      soilCondition: data.soilCondition,
    },
    weather,
  );

  return (
    <div className="fc-decision-card" aria-live="polite">
      <div className="fc-decision-header">
        <div>
          <span className="fc-decision-kicker">Experimental decision support</span>
          <h3>{decision.label}</h3>
        </div>
        <span className={`fc-decision-status fc-decision-${decision.label === 'Irrigation may need review' ? 'review' : decision.label === 'Wait and reassess' ? 'wait' : 'more'}`}>
          {decision.label}
        </span>
      </div>

      {weatherLoading && (
        <div className="fc-decision-loading">Loading forecast data; the decision will update when it is available.</div>
      )}
      {decision.missing.includes('a fresh weather forecast') && (
        <div className="fc-decision-missing">
          <strong>Refresh needed:</strong> {decision.conditions.find((condition) => !condition.met && condition.text.includes('forecast'))?.text}
          {onRetryWeather && (
            <button type="button" className="btn-fc-retry-weather" onClick={onRetryWeather}>
              <RefreshCw size={14} /> Refresh Weather
            </button>
          )}
        </div>
      )}
      {weatherError && (
        <div className="fc-weather-error-inline">
          <div className="fc-geo-error">
            <AlertTriangle size={14} /> {weatherError}
          </div>
        </div>
      )}

      <p className="fc-decision-intro">
        The result is based only on the entered details and the available forecast fields.
        It is not a validated agronomic recommendation and does not prescribe an amount or schedule.
      </p>

      <div className="fc-decision-next">
        <p className="fc-decision-rule-title">What to do next</p>
        <ul>
          {decision.nextSteps.map((step, index) => (
            <li key={`${step}-${index}`}>{step}</li>
          ))}
        </ul>
      </div>

      <div className="fc-decision-rules">
        <p className="fc-decision-rule-title">Conditions used</p>
        <ul>
          {decision.conditions.map((condition, index) => (
            <li key={`${condition.text}-${index}`} className={condition.met ? 'fc-decision-met' : 'fc-decision-not-met'}>
              <span aria-hidden="true">{condition.met ? '✓' : '—'}</span>
              {condition.text}
            </li>
          ))}
        </ul>
      </div>

      {decision.missing.length > 0 && (
        <div className="fc-decision-missing">
          <strong>Needed before this can be screened:</strong> {decision.missing.join(', ')}.
        </div>
      )}

      <p className="fc-decision-disclaimer">{decision.disclaimer}</p>
    </div>
  );
}

function SummaryPanel({ data, weather, weatherLoading, weatherError, geoLocation, onEdit, onRetryWeather }) {
  const irrigationDate = new Date(data.lastIrrigation);
  const formattedIrrigation = isNaN(irrigationDate)
    ? data.lastIrrigation
    : irrigationDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="fc-page">
      <div className="fc-summary-card">
        <div className="fc-summary-header">
          <ClipboardList size={18} />
          <h3>Farm Details Summary</h3>
        </div>

        <div className="fc-notice">
          Your farm details have been recorded. The experimental decision support result
          below uses observed soil condition and forecast signals without inventing soil
          moisture, crop water requirements, irrigation quantities, or validated thresholds.
        </div>

        <div className="fc-summary-grid">
          <div className="fc-summary-item">
            <span className="fc-summary-label"><MapPin size={12} /> Location</span>
            <p>{data.village.trim()}, {data.district.trim()}</p>
          </div>
          <div className="fc-summary-item">
            <span className="fc-summary-label"><Leaf size={12} /> Crop</span>
            <p>{data.crop.trim()}</p>
          </div>
          <div className="fc-summary-item">
            <span className="fc-summary-label"><Calendar size={12} /> Crop Age</span>
            <p>{data.cropAge} day{Number(data.cropAge) !== 1 ? 's' : ''}</p>
          </div>
          <div className="fc-summary-item">
            <span className="fc-summary-label"><Droplets size={12} /> Last Irrigation</span>
            <p>{formattedIrrigation}</p>
          </div>
          <div className="fc-summary-item">
            <span className="fc-summary-label"><CloudRain size={12} /> Recent Rainfall</span>
            <p>{data.rainfall.trim() || 'Not provided'}</p>
          </div>
          <div className="fc-summary-item">
            <span className="fc-summary-label"><Droplets size={12} /> Soil Condition</span>
            <p>
              <span className={`fc-soil-badge fc-soil-${data.soilCondition.toLowerCase().replace(' ', '-')}`}>
                {data.soilCondition}
              </span>
            </p>
          </div>
        </div>

        <DecisionPanel
          data={data}
          weather={weather}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          onRetryWeather={onRetryWeather}
        />

        <div className="fc-disclaimer">
          This summary is based on information you entered. This tool is an experimental
          prototype — always consult a qualified agronomist before making irrigation
          decisions. Weather forecasts are sourced from Open-Meteo and are model
          estimates only. The system does not measure soil moisture or guarantee
          rainfall predictions.
        </div>

        <button type="button" className="btn-fc-edit" onClick={onEdit}>
          <RotateCcw size={14} /> Edit Details
        </button>
      </div>

      {/* Weather error with retry */}
      {weatherError && !weather && (
        <div className="fc-weather-error-card">
          <div className="fc-geo-error">
            <AlertTriangle size={14} />
            <span>{weatherError}</span>
          </div>
          {onRetryWeather && (
            <button type="button" className="btn-fc-retry-weather" onClick={onRetryWeather}>
              <RefreshCw size={14} /> Retry Weather
            </button>
          )}
        </div>
      )}

      {weather && geoLocation && (
        <WeatherPanel weather={weather} location={geoLocation} />
      )}
    </div>
  );
}

// ── Main FarmCheck component ──────────────────────────────────────────────────

export default function FarmCheck() {
  const [fields, setFields]       = useState(EMPTY);
  const [errors, setErrors]       = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [snapshot, setSnapshot]   = useState(null);

  // Geolocation state
  const [geoStatus, setGeoStatus]     = useState(GEO.IDLE);
  const [geoError, setGeoError]       = useState('');
  const [geoLocation, setGeoLocation] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null); // metres
  const [gpsReadingCount, setGpsReadingCount] = useState(0); // how many watchPosition readings collected

  // Manual weather lookup state
  const [manualWeatherLoading, setManualWeatherLoading] = useState(false);
  const [manualWeatherError, setManualWeatherError]     = useState('');

  // Weather state
  const [weather, setWeather]               = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError]     = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setFields(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  }

  // ── Step 1: Request GPS via watchPosition ────────────────────────────────
  // watchPosition collects multiple readings over WATCH_WINDOW_MS milliseconds
  // and selects the one with the best (lowest) reported accuracy.
  // This helps with genuine GPS drift but cannot fix a Wi-Fi database error —
  // if all readings point to the same wrong place, the confirmation panel
  // explains why and offers manual entry.

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setGeoStatus(GEO.ERROR);
      setGeoError('Your browser does not support GPS location. Please enter your location manually.');
      return;
    }

    // Reset all location + weather state for a completely fresh attempt
    setGeoStatus(GEO.LOCATING);
    setGeoError('');
    setGeoLocation(null);
    setGpsAccuracy(null);
    setGpsReadingCount(0);
    setWeather(null);
    setWeatherError('');

    // Collect readings into a local array; React state updates are async
    // so we use a plain array ref here to avoid stale closure issues.
    const readings = [];
    let watchId = null;
    let settled = false;

    async function finishWithBest() {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      if (readings.length === 0) {
        setGeoStatus(GEO.ERROR);
        setGeoError('No GPS reading received. Try moving outdoors or enter your location manually.');
        return;
      }

      // Pick the reading with the lowest accuracy value (= most precise)
      const best = readings.reduce((a, b) => (a.accuracy <= b.accuracy ? a : b));
      setGpsAccuracy(best.accuracy);
      setGpsReadingCount(readings.length);

      // Reverse-geocode the exact coordinates from the best reading
      setGeoStatus(GEO.GEOCODING);
      let geo = { lat: best.lat, lon: best.lon, village: '', district: '', country: '', displayName: '' };
      try {
        geo = await reverseGeocode(best.lat, best.lon);
      } catch (err) {
        setGeoError(`Place name lookup failed: ${err.message}. You can type it manually below.`);
      }

      setGeoLocation(geo);
      // Show confirmation panel — user must approve before weather is fetched
      setGeoStatus(GEO.CONFIRM);
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        readings.push({
          lat:      pos.coords.latitude,
          lon:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        // Update the live reading count so the UI shows progress
        setGpsReadingCount(readings.length);
      },
      (err) => {
        if (settled) return;
        settled = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        setGeoStatus(GEO.ERROR);
        switch (err.code) {
          case 1:
            setGeoError('Location permission was denied. Please enter your village and district manually.');
            break;
          case 2:
            setGeoError('Your location could not be determined (no GPS signal). Please enter it manually.');
            break;
          case 3:
            setGeoError('Location request timed out. Try moving outdoors or enter your location manually.');
            break;
          default:
            setGeoError('An unexpected location error occurred. Please enter your location manually.');
        }
      },
      {
        enableHighAccuracy: true, // request the best available fix from the OS
        maximumAge: 0,            // never serve a cached position
        timeout: 15000,           // per-reading timeout
      },
    );

    // After the collection window, stop watching and process the best reading
    setTimeout(finishWithBest, WATCH_WINDOW_MS);
  }

  // ── Step 2: User confirms location → fetch weather ────────────────────────

  async function handleConfirmLocation() {
    if (!geoLocation) return;

    // Pre-fill village/district (user can still edit)
    setFields(f => ({
      ...f,
      village:  geoLocation.village  || f.village,
      district: geoLocation.district || f.district,
    }));
    setErrors(prev => {
      const n = { ...prev };
      if (geoLocation.village)  delete n.village;
      if (geoLocation.district) delete n.district;
      return n;
    });

    setGeoStatus(GEO.DONE);
    await doFetchWeather(geoLocation.lat, geoLocation.lon);
  }

  // ── Weather fetch (also used by Retry) ───────────────────────────────────

  async function doFetchWeather(lat, lon) {
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const wx = await fetchWeather(lat, lon);
      setWeather(wx);
    } catch (err) {
      // Show a user-friendly message; keep the technical detail for debugging
      const userMsg = err.message.startsWith('Invalid')
        ? err.message
        : `Weather data could not be loaded (${err.message}). Check your connection and retry.`;
      setWeatherError(userMsg);
      console.error('[WeatherFetch]', err);
    } finally {
      setWeatherLoading(false);
    }
  }

  function handleRetryWeather() {
    if (geoLocation) doFetchWeather(geoLocation.lat, geoLocation.lon);
  }

  // ── Manual entry fallback ─────────────────────────────────────────────────

  function handleManualEntry() {
    setGeoStatus(GEO.IDLE);
    setGeoError('');
    setGeoLocation(null);
    setGpsAccuracy(null);
    setWeather(null);
    setWeatherError('');
    setManualWeatherError('');
  }

  // ── Manual weather fetch (forward-geocode typed village+district) ─────────

  async function handleManualWeatherFetch() {
    const query = [fields.village.trim(), fields.district.trim()].filter(Boolean).join(', ');
    if (!query) {
      setManualWeatherError('Enter a village/town and district first, then click this button.');
      return;
    }
    setManualWeatherLoading(true);
    setManualWeatherError('');
    setWeather(null);
    setWeatherError('');
    try {
      const found = await forwardGeocode(query);
      // Store as geoLocation so WeatherPanel can show coords + the summary page can retry
      setGeoLocation({ lat: found.lat, lon: found.lon, village: fields.village.trim(),
        district: fields.district.trim(), country: '', displayName: found.displayName });
      await doFetchWeather(found.lat, found.lon);
    } catch (err) {
      setManualWeatherError(err.message);
    } finally {
      setManualWeatherLoading(false);
    }
  }

  // ── Form submit / reset ───────────────────────────────────────────────────

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSnapshot({ ...fields });
    setSubmitted(true);
  }

  function handleReset() {
    setFields(EMPTY);
    setErrors({});
    setSubmitted(false);
    setSnapshot(null);
    setGeoStatus(GEO.IDLE);
    setGeoError('');
    setGeoLocation(null);
    setGpsAccuracy(null);
    setGpsReadingCount(0);
    setWeather(null);
    setWeatherError('');
    setWeatherLoading(false);
    setManualWeatherError('');
    setManualWeatherLoading(false);
  }

  // ── Summary view ──────────────────────────────────────────────────────────

  if (submitted && snapshot) {
    return (
      <SummaryPanel
        data={snapshot}
        weather={weather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
        geoLocation={geoLocation}
        onEdit={() => setSubmitted(false)}
        onRetryWeather={geoLocation ? handleRetryWeather : null}
      />
    );
  }

  const isLocating = geoStatus === GEO.LOCATING || geoStatus === GEO.GEOCODING;

  return (
    <div className="fc-page">

      {/* Header */}
      <div className="fc-header-card">
        <div className="fc-header-icon">
          <ClipboardList size={20} color="var(--green-dark)" />
        </div>
        <div>
          <h3>Today's Farm Check</h3>
          <p>
            Enter your farm details below. Fields marked{' '}
            <span className="fc-required-star">*</span> are required.
            Use the location button to detect your GPS position and load a live
            weather forecast — or type your location manually.
          </p>
        </div>
      </div>

      <form className="fc-form-card" onSubmit={handleSubmit} noValidate>

        {/* ── Location section ── */}
        <p className="fc-section-title">Farm Location</p>

        {/* Location button — hidden during confirmation to avoid double-click */}
        {geoStatus !== GEO.CONFIRM && (
          <div className="fc-geo-row">
            <button
              type="button"
              className={`btn-fc-locate${isLocating ? ' loading' : ''}`}
              onClick={handleUseLocation}
              disabled={isLocating}
            >
              <LocateFixed size={15} />
              {geoStatus === GEO.LOCATING  && `Collecting GPS readings${gpsReadingCount > 0 ? ` (${gpsReadingCount} so far)…` : '…'}`}
              {geoStatus === GEO.GEOCODING && 'Looking up place name…'}
              {(geoStatus === GEO.IDLE || geoStatus === GEO.ERROR) && 'Use My Current Location'}
              {geoStatus === GEO.DONE && 'Update My Location'}
            </button>

            {geoStatus === GEO.DONE && geoLocation && (
              <span className="fc-geo-success">
                📍 {geoLocation.lat.toFixed(4)}°, {geoLocation.lon.toFixed(4)}°
                {geoLocation.country ? ` · ${geoLocation.country}` : ''}
                <AccuracyBadge accuracy={gpsAccuracy} />
              </span>
            )}
          </div>
        )}

        {/* Geo error */}
        {geoError && (
          <div className="fc-geo-error">
            <AlertTriangle size={14} />
            {geoError}
          </div>
        )}

        {/* Confirmation panel */}
        {geoStatus === GEO.CONFIRM && geoLocation && (
          <LocationConfirm
            geo={geoLocation}
            accuracy={gpsAccuracy}
            readingCount={gpsReadingCount}
            onConfirm={handleConfirmLocation}
            onRetry={handleUseLocation}
            onManual={handleManualEntry}
          />
        )}

        {/* Privacy notice */}
        {geoStatus !== GEO.IDLE && (
          <div className="fc-privacy-note">
            Your coordinates are sent only to Open-Meteo (weather) and Nominatim
            (place name lookup). They are not stored by this application.
          </div>
        )}

        {/* Village / District inputs */}
        <div className="fc-row-2">
          <div className="fc-field">
            <label className="fc-label" htmlFor="fc-village">
              <MapPin size={13} /> Village / Town <span className="fc-required-star">*</span>
            </label>
            <input
              id="fc-village"
              name="village"
              type="text"
              className={`fc-input${errors.village ? ' fc-input-error' : ''}`}
              placeholder="e.g. Matara"
              value={fields.village}
              onChange={handleChange}
              autoComplete="off"
            />
            {errors.village && <span className="fc-error">{errors.village}</span>}
          </div>

          <div className="fc-field">
            <label className="fc-label" htmlFor="fc-district">
              <MapPin size={13} /> District <span className="fc-required-star">*</span>
            </label>
            <input
              id="fc-district"
              name="district"
              type="text"
              className={`fc-input${errors.district ? ' fc-input-error' : ''}`}
              placeholder="e.g. Galle"
              value={fields.district}
              onChange={handleChange}
              autoComplete="off"
            />
            {errors.district && <span className="fc-error">{errors.district}</span>}
          </div>
        </div>

        {/* Manual weather fetch — shown when user is in manual/idle mode and has typed a location */}
        {geoStatus === GEO.IDLE && (
          <div className="fc-manual-weather-row">
            <button
              type="button"
              className={`btn-fc-manual-weather${manualWeatherLoading ? ' loading' : ''}`}
              onClick={handleManualWeatherFetch}
              disabled={manualWeatherLoading}
            >
              <CloudRain size={14} />
              {manualWeatherLoading ? 'Looking up location…' : 'Get weather for entered location'}
            </button>
            <span className="fc-manual-weather-hint">
              Searches for your typed village and district, then loads the forecast.
            </span>
          </div>
        )}
        {manualWeatherError && (
          <div className="fc-geo-error">
            <AlertTriangle size={14} /> {manualWeatherError}
          </div>
        )}

        {/* Weather status */}
        {(weatherLoading || manualWeatherLoading) && (
          <div className="fc-weather-loading">
            ⏳ Loading weather forecast for your location…
          </div>
        )}
        {weatherError && !weatherLoading && (
          <div className="fc-weather-error-inline">
            <div className="fc-geo-error">
              <AlertTriangle size={14} /> {weatherError}
            </div>
            <button type="button" className="btn-fc-retry-weather" onClick={handleRetryWeather}>
              <RefreshCw size={14} /> Retry Weather
            </button>
          </div>
        )}
        {weather && !weatherLoading && !manualWeatherLoading && (
          <div className="fc-weather-ready">
            ✅ Weather forecast loaded — visible after you submit.
          </div>
        )}

        {/* ── Crop section ── */}
        <p className="fc-section-title" style={{ marginTop: '8px' }}>Crop Information</p>

        <div className="fc-row-2">
          <div className="fc-field">
            <label className="fc-label" htmlFor="fc-crop">
              <Leaf size={13} /> Vegetable Crop <span className="fc-required-star">*</span>
            </label>
            <input
              id="fc-crop"
              name="crop"
              type="text"
              className={`fc-input${errors.crop ? ' fc-input-error' : ''}`}
              placeholder="e.g. Tomato"
              value={fields.crop}
              onChange={handleChange}
              autoComplete="off"
            />
            {errors.crop && <span className="fc-error">{errors.crop}</span>}
          </div>

          <div className="fc-field">
            <label className="fc-label" htmlFor="fc-cropAge">
              <Calendar size={13} /> Crop Age (days) <span className="fc-required-star">*</span>
            </label>
            <input
              id="fc-cropAge"
              name="cropAge"
              type="number"
              min="0"
              step="1"
              className={`fc-input${errors.cropAge ? ' fc-input-error' : ''}`}
              placeholder="e.g. 30"
              value={fields.cropAge}
              onChange={handleChange}
            />
            {errors.cropAge && <span className="fc-error">{errors.cropAge}</span>}
          </div>
        </div>

        {/* ── Irrigation & Observed Weather ── */}
        <p className="fc-section-title" style={{ marginTop: '8px' }}>Irrigation &amp; Observed Weather</p>

        <div className="fc-field">
          <label className="fc-label" htmlFor="fc-lastIrrigation">
            <Droplets size={13} /> Last Irrigation Date &amp; Time <span className="fc-required-star">*</span>
          </label>
          <input
            id="fc-lastIrrigation"
            name="lastIrrigation"
            type="datetime-local"
            className={`fc-input fc-input-date${errors.lastIrrigation ? ' fc-input-error' : ''}`}
            value={fields.lastIrrigation}
            onChange={handleChange}
          />
          {errors.lastIrrigation && <span className="fc-error">{errors.lastIrrigation}</span>}
        </div>

        <div className="fc-field">
          <label className="fc-label" htmlFor="fc-rainfall">
            <CloudRain size={13} /> Recent Rainfall Information
            <span className="fc-optional"> (optional)</span>
          </label>
          <input
            id="fc-rainfall"
            name="rainfall"
            type="text"
            className="fc-input"
            placeholder="e.g. Light rain yesterday, approx. 5 mm"
            value={fields.rainfall}
            onChange={handleChange}
            autoComplete="off"
          />
          <span className="fc-hint">Describe what you observed — no sensor data required.</span>
        </div>

        <div className="fc-field">
          <label className="fc-label">
            <Droplets size={13} /> Soil Condition <span className="fc-required-star">*</span>
          </label>
          <div className="fc-soil-options">
            {SOIL_OPTIONS.map(opt => (
              <label
                key={opt}
                className={`fc-soil-option${fields.soilCondition === opt ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="soilCondition"
                  value={opt}
                  checked={fields.soilCondition === opt}
                  onChange={handleChange}
                />
                {opt}
              </label>
            ))}
          </div>
          {errors.soilCondition && <span className="fc-error">{errors.soilCondition}</span>}
        </div>

        {/* Actions */}
        <div className="fc-actions">
          <button type="submit" className="btn-fc-submit">
            <ClipboardList size={15} /> Submit Farm Check
          </button>
          <button type="button" className="btn-fc-reset" onClick={handleReset}>
            <RotateCcw size={14} /> Clear / Reset
          </button>
        </div>
      </form>
    </div>
  );
}
