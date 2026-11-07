// Provides the shared inline CertSure mark and wordmark.
export default function Logo({ className = "" }) {
  return (
    <span className={`brand ${className}`.trim()}>
      <svg className="brand-mark" viewBox="0 0 40 40" role="img" aria-label="CertSure">
        <rect width="40" height="40" rx="11" fill="#1F3A5F" />
        <path
          d="m10 20 7 7 14-15"
          fill="none"
          stroke="#B8912F"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>CertSure</span>
    </span>
  );
}
