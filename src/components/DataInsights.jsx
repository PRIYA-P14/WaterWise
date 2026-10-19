import {
  FlaskConical, Database, LayoutList, GitMerge,
  ShieldCheck, PieChart, AlertTriangle, Download,
} from 'lucide-react';
import DataQualitySummary from './DataQualitySummary';
import DownloadButtons from './DownloadButtons';

const FEATURES = [
  { name: 'Daily mean air temperature',              unit: '°C',        note: '' },
  { name: 'Daily mean relative humidity',            unit: '%',         note: '' },
  { name: 'Daily rainfall',                          unit: 'mm',        note: '' },
  { name: 'Surface soil-moisture estimate, 0–7 cm',  unit: '—',         note: 'Modelled estimate' },
  { name: 'Deeper soil-moisture estimate, 7–28 cm',  unit: '—',         note: 'Modelled estimate' },
  { name: 'Daily reference evapotranspiration (ET₀)', unit: 'mm/day',   note: '' },
];

const WORKFLOW = [
  'Load and inspect source files.',
  'Aggregate hourly Open-Meteo data into daily features.',
  'Check missing values and duplicate dates.',
  'Prepare the 355 observed daily records.',
  'Apply experimental screening rules.',
  'Generate daily recommendations and dashboard summary files.',
];

const QUALITY = [
  '355 model-ready records.',
  'No duplicate dates in the model-ready dataset.',
  'No missing values in its six required features.',
  'Rule validation passed with zero mismatches.',
  'Recommendation output quality validation passed.',
];

const CATEGORIES = [
  { label: 'Monitor - lower ET0',                count: 183, cls: 'badge-monitor' },
  { label: 'Review - moisture not relatively low', count: 66,  cls: 'badge-review-moisture' },
  { label: 'Potential irrigation review',          count: 61,  cls: 'badge-potential' },
  { label: 'Review rainfall before irrigation',    count: 45,  cls: 'badge-rainfall' },
];

const LIMITATIONS = [
  'Soil texture is not specified.',
  'Soil-moisture values are modelled estimates and are not field-calibrated measurements.',
  'The screening thresholds are experimental.',
  'Crop growth-stage parameters and effective rainfall are not fully established.',
  'No validated irrigation-water quantity is calculated.',
  'No actual water savings or crop-stress prevention has been demonstrated.',
  'The current system uses rule-based screening; it is not a trained machine-learning model.',
];

function Section({ icon: Icon, title, children }) {
  return (
    <div className="insights-section">
      <div className="insights-section-header">
        <Icon size={18} color="var(--green-mid)" />
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function DataInsights({ onCategoryClick }) {
  return (
    <div className="insights-page">

      <Section icon={FlaskConical} title="Project Overview">
        <div className="insights-kv-grid">
          <div className="insights-kv"><span>Project</span><p>WaterWise Farm AI</p></div>
          <div className="insights-kv"><span>Purpose</span><p>Weather-aware irrigation scheduling and water-saving optimization research</p></div>
          <div className="insights-kv"><span>Status</span><p>Experimental, historical-data-based decision-support prototype</p></div>
        </div>
      </Section>

      <Section icon={Database} title="Dataset Information">
        <div className="insights-kv-grid">
          <div className="insights-kv"><span>Source</span><p>AgriDataValue Pilot 18 and accompanying Open-Meteo data</p></div>
          <div className="insights-kv"><span>Location ID</span><p>4599-2049 (selected Open-Meteo corn-field location)</p></div>
          <div className="insights-kv"><span>Observed records</span><p>355 daily records</p></div>
          <div className="insights-kv"><span>Date range</span><p>2024-03-29 to 2025-10-02</p></div>
          <div className="insights-kv"><span>Missing calendar days</span><p>198 days — not treated as zero readings</p></div>
        </div>
        <p className="insights-note">
          Missing calendar days represent gaps in the source data. They are excluded from all calculations
          and are not imputed or replaced with zero values.
        </p>
        <div style={{ marginTop: 16 }}>
          <DataQualitySummary />
        </div>
      </Section>

      <Section icon={LayoutList} title="Six Main Features">
        <div className="insights-features-table">
          <div className="insights-features-header">
            <span>Feature</span><span>Unit</span><span>Note</span>
          </div>
          {FEATURES.map(f => (
            <div className="insights-features-row" key={f.name}>
              <span>{f.name}</span>
              <span>{f.unit}</span>
              <span>{f.note || '—'}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={GitMerge} title="Data Preparation Workflow">
        <ol className="insights-steps">
          {WORKFLOW.map((step, i) => (
            <li key={i}>
              <span className="insights-step-num">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </Section>

      <Section icon={ShieldCheck} title="Data Quality and Validation">
        <ul className="insights-checklist">
          {QUALITY.map((item, i) => (
            <li key={i}>
              <span className="insights-check">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={PieChart} title="Screening Categories">
        <p className="insights-note" style={{ marginBottom: 12 }}>
          Categories indicate days flagged for review under experimental thresholds.
          They are not confirmed irrigation requirements.
          Click a category to explore its records in the Daily Data table.
        </p>
        <div className="insights-cat-list">
          {CATEGORIES.map(({ label, count, cls }) => (
            <button
              key={label}
              type="button"
              className="insights-cat-row insights-cat-btn"
              onClick={() => onCategoryClick(label)}
            >
              <span className={`badge ${cls}`}>{label}</span>
              <span className="insights-cat-count">{count} days ›</span>
            </button>
          ))}
          <div className="insights-cat-row insights-cat-total">
            <span>Total observed days</span>
            <span>{CATEGORIES.reduce((s, c) => s + c.count, 0)} days</span>
          </div>
        </div>
      </Section>

      <Section icon={AlertTriangle} title="Limitations">
        <ul className="insights-limitations">
          {LIMITATIONS.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section icon={Download} title="Download Data Files">
        <DownloadButtons />
      </Section>

    </div>
  );
}
