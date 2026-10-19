import { useState } from 'react';
import { FlaskConical, RotateCcw, Play } from 'lucide-react';
import CategoryBadge from './CategoryBadge';
import { applyScreeningRules, ET0_THRESHOLD, SM_P25_THRESHOLD } from '../screeningRules';

const DEFAULTS = { et0: '4.70', rain: '0.00', sm: '0.2500' };

function validate(fields) {
  const errors = {};
  const et0  = Number(fields.et0);
  const rain = Number(fields.rain);
  const sm   = Number(fields.sm);

  if (fields.et0 === '' || !Number.isFinite(et0))
    errors.et0 = 'Enter a valid number.';
  else if (et0 < 0)
    errors.et0 = 'ET₀ cannot be negative.';

  if (fields.rain === '' || !Number.isFinite(rain))
    errors.rain = 'Enter a valid number.';
  else if (rain < 0)
    errors.rain = 'Rainfall cannot be negative.';

  if (fields.sm === '' || !Number.isFinite(sm))
    errors.sm = 'Enter a valid number.';
  else if (sm < 0 || sm > 1)
    errors.sm = 'Soil-moisture must be between 0 and 1.';

  return errors;
}

function InputRow({ id, label, unit, hint, value, error, onChange }) {
  return (
    <div className="sim-field">
      <label htmlFor={id} className="sim-label">
        {label}
        {unit && <span className="sim-unit">{unit}</span>}
      </label>
      {hint && <p className="sim-hint">{hint}</p>}
      <input
        id={id}
        type="number"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`sim-input${error ? ' sim-input-error' : ''}`}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      {error && <p id={`${id}-err`} className="sim-error">{error}</p>}
    </div>
  );
}

export default function ScenarioSimulator() {
  const [fields, setFields]   = useState(DEFAULTS);
  const [result, setResult]   = useState(null);
  const [errors, setErrors]   = useState({});

  function setField(key) {
    return val => {
      setFields(f => ({ ...f, [key]: val }));
      // Clear the error for this field as the user types
      setErrors(e => ({ ...e, [key]: undefined }));
      // Clear the result so stale output is not shown
      setResult(null);
    };
  }

  function handleRun() {
    const errs = validate(fields);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const et0  = Number(fields.et0);
    const rain = Number(fields.rain);
    const sm   = Number(fields.sm);
    setResult(applyScreeningRules(et0, rain, sm));
  }

  function handleReset() {
    setFields(DEFAULTS);
    setErrors({});
    setResult(null);
  }

  return (
    <div className="sim-page">

      {/* ── Header card ── */}
      <div className="sim-header-card">
        <div className="sim-header-icon"><FlaskConical size={22} color="var(--green-mid)" /></div>
        <div>
          <h3>Scenario Simulator</h3>
          <p>
            Enter hypothetical daily values to see which experimental screening category
            would be assigned. This is a <strong>simulation only</strong> — results are not
            real field observations and do not constitute irrigation recommendations.
          </p>
        </div>
      </div>

      <div className="sim-layout">

        {/* ── Input panel ── */}
        <div className="sim-inputs-card">
          <p className="sim-section-title">Hypothetical inputs</p>

          <InputRow
            id="et0"
            label="Reference Evapotranspiration (ET₀)"
            unit="mm/day"
            hint={`Experimental threshold: > ${ET0_THRESHOLD} mm/day triggers elevated screening.`}
            value={fields.et0}
            error={errors.et0}
            onChange={setField('et0')}
          />
          <InputRow
            id="rain"
            label="Daily Rainfall"
            unit="mm"
            hint="Any value > 0 mm triggers the rainfall-review path."
            value={fields.rain}
            error={errors.rain}
            onChange={setField('rain')}
          />
          <InputRow
            id="sm"
            label="Surface Soil-Moisture Estimate (0–7 cm)"
            unit="0 – 1"
            hint={`Dataset 25th-percentile threshold: ≤ ${SM_P25_THRESHOLD} is considered relatively low.`}
            value={fields.sm}
            error={errors.sm}
            onChange={setField('sm')}
          />

          <div className="sim-actions">
            <button type="button" className="btn-sim-run" onClick={handleRun}>
              <Play size={15} /> Run screening
            </button>
            <button type="button" className="btn-sim-reset" onClick={handleReset}>
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>

        {/* ── Result panel ── */}
        <div className="sim-result-card">
          {!result ? (
            <div className="sim-result-empty">
              <FlaskConical size={32} color="var(--neutral-400)" />
              <p>Enter values and click <strong>Run screening</strong> to see the simulated category.</p>
            </div>
          ) : (
            <>
              <p className="sim-section-title">Simulated screening result</p>

              <div className="sim-result-badge">
                <CategoryBadge category={result.category} />
              </div>

              <div className="sim-conditions">
                <p className="sim-conditions-title">Conditions evaluated</p>
                <ul className="modal-rule-list">
                  {result.conditions.map((c, i) => (
                    <li key={i} className={c.met ? 'rule-met' : 'rule-not-met'}>
                      <span className="rule-icon">{c.met ? '✓' : '✗'}</span>
                      {c.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sim-disclaimer">
                <strong>Hypothetical simulation.</strong> This result was produced by applying
                experimental rule-based thresholds to the values you entered. It is not a
                real field observation, a validated agronomic recommendation, or a confirmed
                irrigation requirement. No irrigation-water quantity is calculated.
                Soil-moisture inputs are treated as modelled estimates.
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Rule reference ── */}
      <div className="sim-rules-card">
        <p className="sim-section-title">Screening rule reference</p>
        <div className="sim-rules-grid">
          <div className="sim-rule-row">
            <span className="badge badge-monitor">Monitor - lower ET0</span>
            <span>ET₀ ≤ {ET0_THRESHOLD} mm/day</span>
          </div>
          <div className="sim-rule-row">
            <span className="badge badge-rainfall">Review rainfall before irrigation</span>
            <span>ET₀ &gt; {ET0_THRESHOLD} mm/day <em>and</em> rainfall &gt; 0 mm</span>
          </div>
          <div className="sim-rule-row">
            <span className="badge badge-potential">Potential irrigation review</span>
            <span>ET₀ &gt; {ET0_THRESHOLD} mm/day <em>and</em> rainfall = 0 mm <em>and</em> surface SM ≤ {SM_P25_THRESHOLD}</span>
          </div>
          <div className="sim-rule-row">
            <span className="badge badge-review-moisture">Review - moisture not relatively low</span>
            <span>ET₀ &gt; {ET0_THRESHOLD} mm/day <em>and</em> rainfall = 0 mm <em>and</em> surface SM &gt; {SM_P25_THRESHOLD}</span>
          </div>
        </div>
        <p className="sim-rules-note">
          Thresholds are experimental and derived from the 355-record WaterWise dataset.
          They are not validated agronomic values and may not generalise to other locations or crops.
        </p>
      </div>

    </div>
  );
}
