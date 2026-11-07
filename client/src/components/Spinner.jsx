// Exposes a small status indicator that becomes static with reduced motion.
export default function Spinner({ label = "Loading…" }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
