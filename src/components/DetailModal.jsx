import { X, Thermometer, Droplets, CloudRain, Leaf, FlaskConical, Info } from 'lucide-react';
import CategoryBadge from './CategoryBadge';
import { applyScreeningRules } from '../screeningRules';

// Safe numeric formatter — returns fallback string when value is missing or non-numeric
function fmt(value, decimals, fallback = 'N/A') {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : fallback;
}

// Derive a structured rule explanation from the actual row values
// by delegating to the shared screening-rules module.
function RuleBreakdown({ row }) {
  const et0  = Number(row.et0_mm_day);
  const sm   = Number(row.surface_soil_moisture);
  const rain = Number(row.rainfall_mm);

  if (!Number.isFinite(et0) || !Number.isFinite(sm) || !Number.isFinite(rain)) return null;

  const { conditions } = applyScreeningRules(et0, rain, sm);

  return (
    <div className="modal-rule-breakdown">
      <p className="modal-rule-title">Screening conditions for this record</p>
      <ul className="modal-rule-list">
        {conditions.map((c, i) => (
          <li key={i} className={c.met ? 'rule-met' : 'rule-not-met'}>
            <span className="rule-icon">{c.met ? '✓' : '✗'}</span>
            {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value, icon: Icon }) {
  return (
    <div className="modal-field">
      <label>
        {Icon && <Icon size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
        {label}
      </label>
      <p>{value}</p>
    </div>
  );
}

export default function DetailModal({ row, onClose }) {
  if (!row) return null;

  const hasExplanation = row.review_explanation && row.review_explanation.trim() !== '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h3>Daily Review — {row.date ?? 'Unknown date'}</h3>

        {/* ── Measured fields ── */}
        <div className="modal-grid">
          <Field
            label="Temperature"
            icon={Thermometer}
            value={`${fmt(row.temperature_c, 1)} °C`}
          />
          <Field
            label="Relative Humidity"
            icon={Droplets}
            value={`${fmt(row.humidity_percent, 1)} %`}
          />
          <Field
            label="Rainfall"
            icon={CloudRain}
            value={`${fmt(row.rainfall_mm, 2)} mm`}
          />
          <Field
            label="ET₀ (ref. evapotranspiration)"
            icon={Leaf}
            value={`${fmt(row.et0_mm_day, 2)} mm/day`}
          />
          <Field
            label="Surface Soil Moisture† (0–7 cm)"
            value={fmt(row.surface_soil_moisture, 4)}
          />
          <Field
            label="Deeper Soil Moisture† (7–28 cm)"
            value={fmt(row.deeper_soil_moisture, 4)}
          />
        </div>

        {/* ── Category badge ── */}
        <div className="modal-category-row">
          <span className="modal-category-label">Review category</span>
          <CategoryBadge category={row.irrigation_review} />
        </div>

        {/* ── CSV explanation text ── */}
        {hasExplanation && (
          <div className="modal-explanation">
            <span className="modal-explanation-icon"><Info size={13} /></span>
            {row.review_explanation}
          </div>
        )}

        {/* ── Structured rule breakdown ── */}
        <RuleBreakdown row={row} />

        {/* ── Disclaimers ── */}
        <div className="modal-disclaimer-box">
          <p>
            <strong>Experimental screening result.</strong> This category was assigned by
            rule-based screening using experimental thresholds. It is not a confirmed
            irrigation requirement and does not represent a validated agronomic recommendation.
          </p>
          <p style={{ marginTop: 6 }}>
            † Soil-moisture values are modelled estimates, not field-calibrated measurements.
            Soil texture is not specified. Missing calendar days in the dataset are not
            treated as zero readings.
          </p>
        </div>
      </div>
    </div>
  );
}
