// Presents a certificate status with a text label and a decorative status icon.
export default function StatusBadge({ status }) {
  const normalized = status === "VALID" ? "valid" : status === "REVOKED" ? "revoked" : "notfound";
  const label = status === "NOT FOUND" ? "NOT FOUND" : status;

  return (
    <span className={`status-badge status-${normalized}`} aria-label={`Certificate status: ${label}`}>
      <svg className="status-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
        {normalized === "valid" ? (
          <path d="m5 12 4.5 4.5L19 7" />
        ) : normalized === "revoked" ? (
          <path d="M12 7v6m0 4h.01M12 3 2.8 20h18.4L12 3Z" />
        ) : (
          <path d="M12 8v5m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        )}
      </svg>
      <span>{label}</span>
    </span>
  );
}
