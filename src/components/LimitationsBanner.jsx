export default function LimitationsBanner({ limitations }) {
  return (
    <div className="limitations-banner" id="about">
      <strong>⚠️ Prototype — Experimental Decision-Support Tool</strong>
      <ul>
        {limitations.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}
