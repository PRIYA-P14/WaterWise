import { CheckCircle, CalendarX, AlertCircle } from 'lucide-react';

const ITEMS = [
  {
    Icon: CheckCircle,
    iconColor: '#2d8653',
    bg: '#e8f5ee',
    value: '355',
    label: 'Observed daily records',
    note: 'Model-ready, no missing values in the six required features.',
  },
  {
    Icon: CalendarX,
    iconColor: '#e65100',
    bg: '#fff3e0',
    value: '198',
    label: 'Calendar days without observations',
    note: 'Gaps in source data — not treated as zero readings.',
  },
  {
    Icon: AlertCircle,
    iconColor: '#1565c0',
    bg: '#e3f2fd',
    value: '0',
    label: 'Missing values in required features',
    note: 'All six features are complete across the 355 observed records.',
  },
];

export default function DataQualitySummary() {
  return (
    <div className="dq-grid">
      {ITEMS.map(({ Icon, iconColor, bg, value, label, note }) => (
        <div className="dq-card" key={label}>
          <div className="dq-icon" style={{ background: bg }}>
            <Icon size={20} color={iconColor} />
          </div>
          <div className="dq-value">{value}</div>
          <div className="dq-label">{label}</div>
          <div className="dq-note">{note}</div>
        </div>
      ))}
    </div>
  );
}
