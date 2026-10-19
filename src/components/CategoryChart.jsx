import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LabelList,
} from 'recharts';

const COLORS = {
  'Monitor - lower ET0': '#1976d2',
  'Review - moisture not relatively low': '#e65100',
  'Potential irrigation review': '#c62828',
  'Review rainfall before irrigation': '#2e7d32',
};

export default function CategoryChart({ counts }) {
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <div className="category-chart-card" id="charts">
      <h3>Irrigation Review Category Counts</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={220} />
          <Tooltip
            formatter={(v) => [v, 'Days']}
            contentStyle={{ fontSize: '.8rem', borderRadius: 6 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] ?? '#adb5bd'} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#343a40' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: '.72rem', color: '#6c757d', marginTop: 8 }}>
        Categories use experimental thresholds. They indicate days to review — not confirmed irrigation requirements.
      </p>
    </div>
  );
}
