// Copies displayed text and gives brief, accessible confirmation.
import { useEffect, useRef, useState } from "react";
import Button from "./Button.jsx";

export default function CopyButton({ value, label = "Copy", onError }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setCopied(false);
      onError?.(error);
    }
  }

  return (
    <Button variant="secondary" size="small" type="button" onClick={() => void copyValue()} disabled={!value}>
      {copied ? "Copied" : label}
      <span className="visually-hidden" aria-live="polite">{copied ? "Copied to clipboard" : ""}</span>
    </Button>
  );
}
