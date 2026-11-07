import { describe, expect, it } from "vitest";
import { formatSourceLabel } from "./chat.js";

describe("formatSourceLabel", () => {
  it("includes the intent for ML answers", () => {
    expect(formatSourceLabel("ml", "qr_scan")).toBe("Answered by ML (intent: qr_scan)");
  });

  it("labels local search answers", () => {
    expect(formatSourceLabel("tfidf")).toBe("Answered by local search");
  });

  it("labels AI answers", () => {
    expect(formatSourceLabel("anthropic")).toBe("Answered by AI");
  });

  it("uses a safe label for unknown sources", () => {
    expect(formatSourceLabel("unknown")).toBe("Answered by CertSure");
  });
});
