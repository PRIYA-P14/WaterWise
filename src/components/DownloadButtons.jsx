import { useState } from 'react';
import { Download, AlertCircle } from 'lucide-react';

const FILES = [
  {
    label: 'Daily Recommendations (CSV)',
    path: '/data/waterwise_daily_recommendations.csv',
    filename: 'waterwise_daily_recommendations.csv',
  },
  {
    label: 'Dashboard Summary (JSON)',
    path: '/data/waterwise_dashboard_summary.json',
    filename: 'waterwise_dashboard_summary.json',
  },
];

function DownloadButton({ label, path, filename }) {
  const [status, setStatus] = useState('idle'); // idle | loading | error

  async function handleDownload() {
    setStatus('loading');
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch (err) {
      console.error('Download failed:', err);
      setStatus('error');
    }
  }

  return (
    <div className="dl-item">
      <button
        className="btn-download"
        onClick={handleDownload}
        disabled={status === 'loading'}
        type="button"
      >
        <Download size={15} />
        {status === 'loading' ? 'Preparing…' : label}
      </button>
      {status === 'error' && (
        <span className="dl-error">
          <AlertCircle size={13} />
          File not found. Check that <code>{path}</code> exists in the public folder.
        </span>
      )}
    </div>
  );
}

export default function DownloadButtons() {
  return (
    <div className="dl-bar">
      <span className="dl-heading">Download data files</span>
      {FILES.map(f => <DownloadButton key={f.path} {...f} />)}
    </div>
  );
}
