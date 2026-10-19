import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

function shortDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;

  const rawValue = payload[0]?.value;
  const numericValue = Number(rawValue);
  const formatted =
    rawValue !== null &&
    rawValue !== undefined &&
    rawValue !== '' &&
    Number.isFinite(numericValue)
      ? numericValue.toFixed(2)
      : 'N/A';

  return (
    <div style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 6, padding: '8px 12px', fontSize: '.8rem' }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ color: payload[0].color }}>{formatted} {unit}</p>
    </div>
  );
};

export function ET0Chart({ data }) {
  return (
    <div className="chart-card">
      <h3>Daily Reference Evapotranspiration (ET₀)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="et0grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2d8653" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2d8653" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} unit=" mm" />
          <Tooltip content={<CustomTooltip unit="mm/day" />} labelFormatter={shortDate} />
          <Area type="monotone" dataKey="et0_mm_day" stroke="#2d8653" fill="url(#et0grad)" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RainfallChart({ data }) {
  return (
    <div className="chart-card">
      <h3>Daily Recorded Rainfall</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} unit=" mm" />
          <Tooltip content={<CustomTooltip unit="mm" />} labelFormatter={shortDate} />
          <Bar dataKey="rainfall_mm" fill="#1976d2" radius={[2, 2, 0, 0]} maxBarSize={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
