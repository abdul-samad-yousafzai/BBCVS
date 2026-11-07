// Displays accessible success, error, and informational messages.
export default function Alert({ variant = "info", className = "", children, ...props }) {
  const isError = variant === "error";
  return (
    <div
      className={`alert alert-${variant} ${className}`.trim()}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      {...props}
    >
      {children}
    </div>
  );
}
