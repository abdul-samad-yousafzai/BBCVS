// Maps backend answer sources to short, user-facing labels.
export function formatSourceLabel(source, intent) {
  if (source === "ml") {
    return intent
      ? `Answered by ML (intent: ${intent})`
      : "Answered by ML";
  }
  if (source === "tfidf") return "Answered by local search";
  if (source === "anthropic") return "Answered by AI";
  return "Answered by CertSure";
}
