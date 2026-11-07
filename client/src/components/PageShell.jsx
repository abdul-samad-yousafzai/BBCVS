// Adds the shared animated layout wrapper to each routed page.
export default function PageShell({ children, className = "" }) {
  return <div className={`page-enter ${className}`.trim()}>{children}</div>;
}
