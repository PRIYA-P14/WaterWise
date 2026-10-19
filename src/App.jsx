import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { Menu } from 'lucide-react';

import './App.css';
import Sidebar from './components/Sidebar';
import SummaryCards from './components/SummaryCards';
import { ET0Chart, RainfallChart } from './components/TimeSeriesCharts';
import CategoryChart from './components/CategoryChart';
import DailyTable from './components/DailyTable';
import DetailModal from './components/DetailModal';
import LimitationsBanner from './components/LimitationsBanner';
import DataInsights from './components/DataInsights';
import ScenarioSimulator from './components/ScenarioSimulator';
import ModelEvaluation from './components/ModelEvaluation';
import FarmCheck from './components/FarmCheck';

function LoadingState() {
  return (
    <div className="state-box" style={{ minHeight: '60vh' }}>
      <div style={{ fontSize: '2rem' }}>💧</div>
      <p>Loading WaterWise data…</p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="state-box" style={{ minHeight: '60vh', color: '#c62828' }}>
      <div style={{ fontSize: '2rem' }}>⚠️</div>
      <p><strong>Failed to load data</strong></p>
      <p style={{ fontSize: '.82rem', color: '#6c757d' }}>{message}</p>
    </div>
  );
}

export default function App() {
  const [summary, setSummary]   = useState(null);
  const [daily, setDaily]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [selected, setSelected]     = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [tableCatFilter, setTableCatFilter] = useState('');

  // Chart date-range filter — defaults to full dataset bounds
  const [chartFrom, setChartFrom] = useState('');
  const [chartTo,   setChartTo]   = useState('');

  const chartData = useMemo(() => {
    if (!chartFrom && !chartTo) return daily;
    return daily.filter(r => {
      if (chartFrom && r.date < chartFrom) return false;
      if (chartTo   && r.date > chartTo)   return false;
      return true;
    });
  }, [daily, chartFrom, chartTo]);

  // Derive the actual min/max dates from the loaded data for input bounds
  const dateMin = daily.length ? daily[0].date : '';
  const dateMax = daily.length ? daily[daily.length - 1].date : '';

  function handleCategoryClick(category) {
    setTableCatFilter(category);
    setActiveView('daily');
  }

  useEffect(() => {
    async function loadData() {
      try {
        // Load JSON summary
        const jsonRes = await fetch('/data/waterwise_dashboard_summary.json');
        if (!jsonRes.ok) throw new Error(`Summary JSON: ${jsonRes.status} ${jsonRes.statusText}`);
        const jsonData = await jsonRes.json();

        // Load CSV
        const csvRes = await fetch('/data/waterwise_daily_recommendations.csv');
        if (!csvRes.ok) throw new Error(`CSV: ${csvRes.status} ${csvRes.statusText}`);
        const csvText = await csvRes.text();

        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: h => h.trim(),
        });

        if (parsed.errors.length) {
          console.warn('CSV parse warnings:', parsed.errors);
        }

        setSummary(jsonData);
        setDaily(parsed.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="app">
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      <Sidebar
        open={sidebarOpen}
        activeView={activeView}
        onNavigate={(v) => { setActiveView(v); setSidebarOpen(false); }}
      />

      {/* Overlay to close sidebar on mobile */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-content">
        <div className="topbar">
          <h2>
            {{ overview: 'Overview', charts: 'Charts',
               daily: 'Daily Data', insights: 'Data Insights',
               simulator: 'Scenario Simulator',
               evaluation: 'Model Evaluation',
               farmcheck: "Today's Farm Check" }[activeView]}
          </h2>
          <span className="prototype-badge">Experimental Prototype</span>
        </div>

        {loading && activeView !== 'insights' && activeView !== 'simulator' && activeView !== 'evaluation' && activeView !== 'farmcheck' && <LoadingState />}
        {error   && activeView !== 'insights' && activeView !== 'simulator' && activeView !== 'evaluation' && activeView !== 'farmcheck' && <ErrorState message={error} />}

        {/* ── Overview ── */}
        {activeView === 'overview' && !loading && !error && summary && (
          <>
            <LimitationsBanner limitations={summary.limitations} />
            <SummaryCards summary={summary} />
            <CategoryChart counts={summary.irrigation_review_counts} />
          </>
        )}

        {/* ── Charts ── */}
        {activeView === 'charts' && !loading && !error && summary && (
          <>
            <div className="chart-range-bar">
              <span className="chart-range-label">Chart period</span>
              <label>
                From&nbsp;
                <input
                  type="date"
                  value={chartFrom}
                  min={dateMin}
                  max={chartTo || dateMax}
                  onChange={e => setChartFrom(e.target.value)}
                />
              </label>
              <label>
                To&nbsp;
                <input
                  type="date"
                  value={chartTo}
                  min={chartFrom || dateMin}
                  max={dateMax}
                  onChange={e => setChartTo(e.target.value)}
                />
              </label>
              {(chartFrom || chartTo) && (
                <button
                  type="button"
                  className="btn-clear"
                  onClick={() => { setChartFrom(''); setChartTo(''); }}
                >
                  Reset
                </button>
              )}
              <span className="chart-range-count">
                {chartData.length} record{chartData.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="charts-grid">
              <ET0Chart data={chartData} />
              <RainfallChart data={chartData} />
            </div>
          </>
        )}

        {/* ── Daily Data ── */}
        {activeView === 'daily' && !loading && !error && (
          daily.length === 0
            ? <div className="state-box"><p>No daily records found in the CSV.</p></div>
            : <DailyTable
                data={daily}
                onSelectRow={setSelected}
                initialCatFilter={tableCatFilter}
              />
        )}

        {/* ── Data Insights ── */}
        {activeView === 'insights' && (
          <DataInsights onCategoryClick={handleCategoryClick} />
        )}

        {/* ── Scenario Simulator ── */}
        {activeView === 'simulator' && <ScenarioSimulator />}

        {/* ── Model Evaluation ── */}
        {activeView === 'evaluation' && <ModelEvaluation />}

        {/* ── Today's Farm Check ── */}
        {activeView === 'farmcheck' && <FarmCheck />}
      </main>

      <DetailModal row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
