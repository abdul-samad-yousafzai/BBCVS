// Calls the optional local intent service without allowing failures to block FAQ answers.
export async function classifyIntent(
  text,
  {
    baseUrl = process.env.ML_SERVICE_URL || "http://localhost:8001",
    timeoutMs = 1500,
    fetchFn = fetch,
  } = {},
) {
  try {
    const response = await fetchFn(`${baseUrl.replace(/\/+$/, "")}/classify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    if (
      typeof result.intent !== "string" ||
      typeof result.confidence !== "number" ||
      !Number.isFinite(result.confidence) ||
      result.confidence < 0 ||
      result.confidence > 1
    ) {
      return null;
    }

    return { intent: result.intent, confidence: result.confidence };
  } catch {
    return null;
  }
}
