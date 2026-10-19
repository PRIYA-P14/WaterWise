const MAP = {
  'Monitor - lower ET0':                 'badge-monitor',
  'Review - moisture not relatively low': 'badge-review-moisture',
  'Potential irrigation review':          'badge-potential',
  'Review rainfall before irrigation':    'badge-rainfall',
};

export default function CategoryBadge({ category }) {
  const cls = MAP[category] ?? '';
  return <span className={`badge ${cls}`}>{category}</span>;
}
