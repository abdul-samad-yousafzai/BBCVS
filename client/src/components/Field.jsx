// Adds a visible label and accessible hint or validation text to form controls.
export default function Field({
  id,
  label,
  hint,
  error,
  className = "",
  children,
  ...inputProps
}) {
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
    inputProps["aria-describedby"],
  ].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {children || <input id={id} aria-describedby={describedBy} aria-invalid={Boolean(error)} {...inputProps} />}
      {hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
