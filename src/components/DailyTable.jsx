import { useState, useMemo, useEffect } from 'react';
import CategoryBadge from './CategoryBadge';

const PAGE_SIZE = 20;

const CATEGORIES = [
  'Monitor - lower ET0',
  'Review - moisture not relatively low',
  'Potential irrigation review',
  'Review rainfall before irrigation',
];

export default function DailyTable({ data, onSelectRow, initialCatFilter = '' }) {
  const [dateFilter, setDateFilter] = useState('');
  const [catFilter, setCatFilter]   = useState(initialCatFilter);
  const [page, setPage]             = useState(1);

  // Sync when the parent navigates here with a pre-selected category
  useEffect(() => {
    setCatFilter(initialCatFilter);
    setPage(1);
  }, [initialCatFilter]);

  const filtered = useMemo(() => {
    return data.filter(row => {
      const matchDate = !dateFilter || row.date.includes(dateFilter);
      const matchCat  = !catFilter  || row.irrigation_review === catFilter;
      return matchDate && matchCat;
    });
  }, [data, dateFilter, catFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleFilter(setter) {
    return e => { setter(e.target.value); setPage(1); };
  }

  return (
    <div className="table-card" id="table">
      <h3 style={{ padding: '16px 18px 12px' }}>Daily Review Data</h3>
      <div className="filters-bar" style={{ padding: '0 18px 12px' }}>
        <div>
          <label>Date&nbsp;</label>
          <input
            type="text"
            placeholder="e.g. 2024-07"
            value={dateFilter}
            onChange={handleFilter(setDateFilter)}
            style={{ width: 130 }}
          />
        </div>
        <div>
          <label>Category&nbsp;</label>
          <select value={catFilter} onChange={handleFilter(setCatFilter)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {(dateFilter || catFilter) && (
          <button className="btn-clear" onClick={() => { setDateFilter(''); setCatFilter(''); setPage(1); }}>
            Clear filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#6c757d' }}>
          {filtered.length} row{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="table-wrapper">
        {pageData.length === 0 ? (
          <div className="state-box"><p>No rows match the current filters.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Temp (°C)</th>
                <th>Humidity (%)</th>
                <th>Rainfall (mm)</th>
                <th>Surface SM*</th>
                <th>Deeper SM*</th>
                <th>ET₀ (mm/d)</th>
                <th>Review Category</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map(row => (
                <tr key={row.date} onClick={() => onSelectRow(row)}>
                  <td>{row.date}</td>
                  <td>{Number(row.temperature_c).toFixed(1)}</td>
                  <td>{Number(row.humidity_percent).toFixed(1)}</td>
                  <td>{Number(row.rainfall_mm).toFixed(2)}</td>
                  <td>{Number(row.surface_soil_moisture).toFixed(4)}</td>
                  <td>{Number(row.deeper_soil_moisture).toFixed(4)}</td>
                  <td>{Number(row.et0_mm_day).toFixed(2)}</td>
                  <td><CategoryBadge category={row.irrigation_review} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <span>Page {safePage} of {totalPages}</span>
        <div className="pagination-btns">
          <button onClick={() => setPage(p => p - 1)} disabled={safePage <= 1}>← Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={safePage >= totalPages}>Next →</button>
        </div>
      </div>
      <p style={{ padding: '0 18px 12px', fontSize: '.7rem', color: '#6c757d' }}>
        * Soil moisture values are modelled estimates. Soil texture is not specified.
        Click any row to view the review explanation.
      </p>
    </div>
  );
}
