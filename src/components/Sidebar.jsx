import { LayoutDashboard, BarChart2, TableProperties, Lightbulb, FlaskConical, TrendingUp, ClipboardList } from 'lucide-react';

const links = [
  { id: 'overview',   label: 'Overview',           Icon: LayoutDashboard },
  { id: 'charts',     label: 'Charts',             Icon: BarChart2 },
  { id: 'daily',      label: 'Daily Data',         Icon: TableProperties },
  { id: 'insights',   label: 'Data Insights',      Icon: Lightbulb },
  { id: 'simulator',  label: 'Scenario Simulator', Icon: FlaskConical },
  { id: 'evaluation', label: 'Model Evaluation',   Icon: TrendingUp },
  { id: 'farmcheck',  label: "Today's Farm Check", Icon: ClipboardList },
];

export default function Sidebar({ open, activeView, onNavigate }) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <h1>💧 WaterWise Farm AI</h1>
        <p>Weather-Aware Irrigation Scheduling</p>
      </div>
      <nav className="sidebar-nav">
        {links.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={activeView === id ? 'active' : ''}
            onClick={() => onNavigate(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        Experimental decision-support prototype.<br />
        Not a validated irrigation system.
      </div>
    </aside>
  );
}
