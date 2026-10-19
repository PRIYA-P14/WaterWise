import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle, Info } from 'lucide-react';

const CSV_PATH = '/data/waterwise_model_evaluation.csv';

// Colours consistent with the existing green-and-neutral palette
const COLOR_MAE  = '#2d8653';
const COLOR_RMSE = '#1976d2';

// Safe numeric parse — returns null for missing / non-finite values
function safeNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function MetricTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 6, padding: '8px 12px', fontSize: '.8rem' }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number.isFinite(p.value) ? p.value.toFixed(3) : 'N/A'} mm/day
        </p>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="state-box">
      <div style={{ fontSize: '2rem' }}>📊</div>
      <p>Loading evaluation data…</p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="state-box" style={{ color: '#c62828' }}>
      <AlertTriangle size={32} />
      <p><strong>Could not load evaluation data</strong></p>
      <p style={{ fontSize: '.82rem', color: '#6c757d', maxWidth: 420, textAlign: 'center' }}>
        {message}
      </p>
      <p style={{ fontSize: '.78rem', color: '#6c757d' }}>
        Expected file: <code style={{ background: '#f1f3f5', padding: '1px 5px', borderRadius: 3 }}>{CSV_PATH}</code>
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="state-box">
      <Info size={28} />
      <p>The evaluation file was loaded but contains no valid model rows.</p>
    </div>
  );
}

export default function ModelEvaluation() {
  const [rows,    setRows]    = useState(null);   // null = not yet loaded
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(CSV_PATH);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const text = await res.text();
        const { data, errors } = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: h => h.trim(),
        });
        if (errors.length) console.warn('Evaluation CSV parse warnings:', errors);

        // Validate and coerce each row; drop rows with missing required fields
        const valid = data
          .map(r => ({
            model:        (r.model ?? '').trim(),
            test_records: safeNum(r.test_records),
            mae:          safeNum(r.mae_mm_day),
            rmse:         safeNum(r.rmse_mm_day),
          }))
          .filter(r => r.model && r.mae !== null && r.rmse !== null);

        setRows(valid);
      } catch (err) {
        setLoadErr(err.message);
      }
    }
    load();
  }, []);

  if (loadErr)        return <ErrorState message={loadErr} />;
  if (rows === null)  return <LoadingState />;
  if (rows.length === 0) return <EmptyState />;

  // Identify the best model by lowest MAE
  const bestMAE   = Math.min(...rows.map(r => r.mae));
  const bestModel = rows.find(r => r.mae === bestMAE)?.model ?? '';

  // Chart data — model name on X axis, MAE and RMSE as grouped bars
  const chartData = rows.map(r => ({
    name: r.model,
    MAE:  r.mae,
    RMSE: r.rmse,
  }));

  return (
    <div className="eval-page">

      {/* ── Header ── */}
      <div className="eval-header-card">
        <div className="eval-header-icon"><TrendingUp size={22} color="var(--green-mid)" /></div>
        <div>
          <h3>Model Evaluation — Next-Day ET₀ Forecasting</h3>
          <p>
            Comparison of three approaches for predicting next-day reference
            evapotranspiration (ET₀) on a held-out test set of{' '}
            <strong>{rows[0]?.test_records ?? 71} records</strong>.
            Lower MAE and RMSE indicate smaller prediction errors.
          </p>
        </div>
      </div>

      {/* ── Scope notice ── */}
      <div className="eval-scope-notice">
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          These models forecast <strong>reference evapotranspiration (ET₀)</strong> only.
          They do not predict irrigation requirements, crop water demand, or irrigation quantities.
          No water savings have been demonstrated.
        </span>
      </div>

      {/* ── Metrics table ── */}
      <div className="eval-card">
        <p className="eval-section-title">Metrics by model</p>
        <div className="eval-table-wrapper">
          <table className="eval-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Test records</th>
                <th>MAE (mm/day)</th>
                <th>RMSE (mm/day)</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.model} className={r.model === bestModel ? 'eval-row-best' : ''}>
                  <td>
                    {r.model}
                    {r.model === bestModel && (
                      <span className="eval-best-tag">lowest MAE</span>
                    )}
                  </td>
                  <td>{r.test_records ?? '—'}</td>
                  <td>{r.mae.toFixed(3)}</td>
                  <td>{r.rmse.toFixed(3)}</td>
                  <td className="eval-note-cell">
                    {r.model === 'Persistence Baseline'
                      ? 'Best-performing approach on this test period'
                      : r.model === 'Random Forest'
                      ? 'Did not outperform the persistence baseline'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="eval-table-note">
          MAE = Mean Absolute Error. RMSE = Root Mean Squared Error.
          Both are in mm/day. Lower values indicate smaller prediction errors.
        </p>
      </div>

      {/* ── Comparison chart ── */}
      <div className="eval-card">
        <p className="eval-section-title">MAE and RMSE comparison</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 20, left: -10, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-15}
              textAnchor="end"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              unit=" mm"
              domain={[0, 'auto']}
            />
            <Tooltip content={<MetricTooltip />} />
            <Legend
              verticalAlign="top"
              wrapperStyle={{ fontSize: '.8rem', paddingBottom: 4 }}
            />
            <Bar dataKey="MAE"  name="MAE (mm/day)"  fill={COLOR_MAE}  radius={[3,3,0,0]} maxBarSize={40} />
            <Bar dataKey="RMSE" name="RMSE (mm/day)" fill={COLOR_RMSE} radius={[3,3,0,0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Findings ── */}
      <div className="eval-card">
        <p className="eval-section-title">Findings</p>
        <ul className="eval-findings">
          <li>
            <span className="eval-finding-icon eval-icon-best">✓</span>
            <span>
              <strong>Persistence Baseline</strong> achieved the lowest MAE ({rows.find(r=>r.model==='Persistence Baseline')?.mae.toFixed(3)} mm/day)
              and is the best-performing tested approach on this particular test period.
              The persistence baseline predicts that tomorrow's ET₀ equals today's ET₀.
            </span>
          </li>
          <li>
            <span className="eval-finding-icon eval-icon-neutral">–</span>
            <span>
              <strong>Random Forest</strong> produced a higher MAE ({rows.find(r=>r.model==='Random Forest')?.mae.toFixed(3)} mm/day)
              than the persistence baseline and did not outperform it on this test set.
            </span>
          </li>
          <li>
            <span className="eval-finding-icon eval-icon-neutral">–</span>
            <span>
              <strong>7-day Seasonal Baseline</strong> had the highest MAE ({rows.find(r=>r.model==='7-day Seasonal Baseline')?.mae.toFixed(3)} mm/day)
              of the three approaches tested.
            </span>
          </li>
          <li>
            <span className="eval-finding-icon eval-icon-info">i</span>
            <span>
              All three approaches forecast ET₀ only. Results apply to the specific
              test period and location in this dataset and may not generalise.
            </span>
          </li>
        </ul>
      </div>

      {/* ── Limitations ── */}
      <div className="eval-disclaimer-box">
        <strong>Important limitations</strong>
        <ul>
          <li>Evaluation covers next-day ET₀ forecasting only — not irrigation scheduling or water-use prediction.</li>
          <li>Results are specific to the 71-record test period from this dataset and location.</li>
          <li>The Random Forest model was not tuned extensively; results reflect an initial experimental run.</li>
          <li>No claim is made that machine learning improves ET₀ forecasting in general.</li>
          <li>No irrigation quantities, crop-stress outcomes, or water savings are predicted or implied.</li>
        </ul>
      </div>

    </div>
  );
}
