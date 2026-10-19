import { CalendarDays, Thermometer, Droplets, CloudRain, Leaf } from 'lucide-react';

const CARDS = [
  {
    key: 'total_observed_days',
    label: 'Observed Days',
    unit: 'days',
    Icon: CalendarDays,
    color: '#e8f5ee',
    iconColor: '#2d8653',
    format: v => v,
  },
  {
    key: 'average_temperature_c',
    label: 'Avg Temperature',
    unit: '°C',
    Icon: Thermometer,
    color: '#fff3e0',
    iconColor: '#e65100',
    format: v => v.toFixed(1),
  },
  {
    key: 'average_humidity_percent',
    label: 'Avg Humidity',
    unit: '%',
    Icon: Droplets,
    color: '#e3f2fd',
    iconColor: '#1565c0',
    format: v => v.toFixed(1),
  },
  {
    key: 'total_recorded_rainfall_mm',
    label: 'Total Rainfall',
    unit: 'mm',
    Icon: CloudRain,
    color: '#e8f5e9',
    iconColor: '#2e7d32',
    format: v => v.toFixed(1),
  },
  {
    key: 'average_et0_mm_day',
    label: 'Avg ET₀',
    unit: 'mm/day',
    Icon: Leaf,
    color: '#f3e5f5',
    iconColor: '#6a1b9a',
    format: v => v.toFixed(2),
  },
];

export default function SummaryCards({ summary }) {
  const ws = summary.weather_summary;
  const values = {
    total_observed_days: summary.total_observed_days,
    ...ws,
  };

  return (
    <div className="cards-grid" id="overview">
      {CARDS.map(({ key, label, unit, Icon, color, iconColor, format }) => (
        <div className="card" key={key}>
          <div className="card-icon" style={{ background: color }}>
            <Icon size={18} color={iconColor} />
          </div>
          <span className="card-label">{label}</span>
          <span className="card-value">{format(values[key])}</span>
          <span className="card-unit">{unit}</span>
        </div>
      ))}
    </div>
  );
}
