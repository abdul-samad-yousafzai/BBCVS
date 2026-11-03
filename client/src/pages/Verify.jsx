import { useState } from "react";
import { askAssistant, verifyFile, verifyHash } from "../api.js";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function VerificationResult({ result }) {
  if (!result) return null;

  const statusClass = result.status === "VALID"
    ? "valid"
    : result.status === "REVOKED"
      ? "revoked"
      : "not-found";
  const timestamp = Number(result.issuedAt);
  const parsedDate = new Date(timestamp * 1000);
  const issueDate = result.status === "NOT FOUND"
    ? "N/A"
    : Number.isFinite(timestamp) && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleString()
      : "N/A";

  return (
    <section className={`result-card ${statusClass}`} aria-live="polite">
      <div className="result-heading">
        <span className="status-icon" aria-hidden="true">
          {result.status === "VALID" ? "✓" : result.status === "REVOKED" ? "!" : "—"}
        </span>
        <div>
          <p className="eyebrow">Verification result</p>
          <h2>{result.status}</h2>
        </div>
      </div>
      <dl className="data-list">
        <div><dt>Issuer</dt><dd className="break-all">{result.issuer || "N/A"}</dd></div>
        <div><dt>Issue date</dt><dd>{issueDate}</dd></div>
      </dl>
    </section>
  );
}

export default function Verify() {
  const [hash, setHash] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);

  async function submitVerification(action) {
    setLoading(true);
    setError("");
    setResult(null);
    setAssistantReply("");
    setAssistantError("");
    try {
      setResult(await action());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF file to verify.");
      return;
    }
    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Select a PDF file.");
      return;
    }
    void submitVerification(() => verifyFile(file));
  }

  function handleHashSubmit(event) {
    event.preventDefault();
    const trimmedHash = hash.trim();
    if (!HASH_PATTERN.test(trimmedHash)) {
      setError("Enter a 0x-prefixed 32-byte hexadecimal hash.");
      return;
    }
    void submitVerification(() => verifyHash(trimmedHash));
  }

  async function handleAssistantSubmit(event) {
    event.preventDefault();
    setAssistantLoading(true);
    setAssistantReply("");
    setAssistantError("");
    try {
      const response = await askAssistant({
        message: assistantQuestion.trim(),
        mode: "explain",
        context: {
          status: result.status,
          issuer: result.issuer,
          issuedAt: result.issuedAt,
        },
      });
      setAssistantReply(response.reply);
    } catch (requestError) {
      setAssistantError(requestError.message);
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <div className="content-page">
      <header className="page-heading">
        <p className="eyebrow">Certificate authenticity</p>
        <h1>Verify a certificate</h1>
        <p>Check the original PDF or look up a certificate directly by its hash.</p>
      </header>

      <div className="two-column-grid">
        <section className="panel">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div><h2>Verify by file</h2><p>Upload the original certificate PDF.</p></div>
          </div>
          <form onSubmit={handleFileSubmit}>
            <label htmlFor="certificate-file">Certificate PDF</label>
            <input
              id="certificate-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setFile(event.target.files[0] ?? null);
                setError("");
              }}
            />
            <button className="button button-primary full-width" type="submit" disabled={loading}>
              {loading ? "Checking certificate…" : "Verify PDF"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <span className="step-number">02</span>
            <div><h2>Verify by hash</h2><p>Enter the certificate’s SHA-256 hash.</p></div>
          </div>
          <form onSubmit={handleHashSubmit}>
            <label htmlFor="certificate-hash">Certificate hash</label>
            <input
              id="certificate-hash"
              type="text"
              value={hash}
              onChange={(event) => {
                setHash(event.target.value);
                setError("");
              }}
              placeholder="0x followed by 64 hexadecimal characters"
              autoComplete="off"
              spellCheck="false"
            />
            <button className="button button-primary full-width" type="submit" disabled={loading}>
              {loading ? "Checking certificate…" : "Verify hash"}
            </button>
          </form>
        </section>
      </div>

      <div className="feedback-region" aria-live="polite">
        {loading && <p className="loading-message"><span className="spinner" /> Contacting the verification service…</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <VerificationResult result={result} />
        {result && (
          <section className="panel" aria-labelledby="assistant-result-heading">
            <div className="panel-heading">
              <span className="step-number">AI</span>
              <div>
                <h2 id="assistant-result-heading">Ask about this result</h2>
                <p>The blockchain determines the status. The assistant only explains it.</p>
              </div>
            </div>
            <form onSubmit={handleAssistantSubmit}>
              <label htmlFor="assistant-result-question">Your question</label>
              <input
                id="assistant-result-question"
                type="text"
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
                maxLength={1000}
                required
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={assistantLoading}
              >
                {assistantLoading ? "Preparing an explanation…" : "Ask"}
              </button>
            </form>
            {assistantError && <p className="alert alert-error" role="alert">{assistantError}</p>}
            {assistantReply && <p className="supporting-text" aria-live="polite">{assistantReply}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
