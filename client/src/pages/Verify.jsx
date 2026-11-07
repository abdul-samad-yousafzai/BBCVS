// Verifies PDFs, hashes, or QR content and explains blockchain results.
import { useState } from "react";
import { askAssistant, verifyFile, verifyHash } from "../api.js";
import Alert from "../components/Alert.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import CopyButton from "../components/CopyButton.jsx";
import Field from "../components/Field.jsx";
import QrScanner from "../components/QrScanner.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Tabs from "../components/Tabs.jsx";
import { extractCertificateHash } from "../lib/qr.js";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function MethodIcon({ name }) {
  const paths = {
    document: <><path d="M7 3.75h7l4 4v12.5H7z" /><path d="M14 3.75v4h4M10 12h5m-5 3.5h5" /></>,
    check: <><circle cx="12" cy="12" r="8.5" /><path d="m8 12 2.6 2.6L16.5 9" /></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.3" /></>,
  };
  return <svg className="method-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function VerificationResult({ result, hash }) {
  if (!result) return null;

  const timestamp = Number(result.issuedAt);
  const parsedDate = new Date(timestamp * 1000);
  const issueDate = result.status === "NOT FOUND"
    ? "N/A"
    : Number.isFinite(timestamp) && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleString()
      : "N/A";

  return (
    <Card className={`verification-result status-card-${result.status === "NOT FOUND" ? "notfound" : result.status.toLowerCase()}`} aria-live="polite">
      <div className="result-heading">
        <div>
          <p className="eyebrow">Blockchain verification</p>
          <h2>Certificate result</h2>
        </div>
        <StatusBadge status={result.status} />
      </div>
      <dl className="data-list">
        <div><dt>Issuer</dt><dd className="break-all">{result.issuer || "N/A"}</dd></div>
        <div><dt>Issue date</dt><dd>{issueDate}</dd></div>
        <div className="hash-row">
          <dt>Certificate hash</dt>
          <dd className="hash-copy">
            <code className="break-all">{result.hash || hash || "N/A"}</code>
            {(result.hash || hash) && <CopyButton value={result.hash || hash} />}
          </dd>
        </div>
      </dl>
    </Card>
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
  const [assistantOpen, setAssistantOpen] = useState(false);

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
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
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
    verifyHashValue(trimmedHash);
  }

  function verifyHashValue(value) {
    void submitVerification(() => verifyHash(value));
  }

  function handleQrDecoded(text) {
    const certificateHash = extractCertificateHash(text);
    if (!certificateHash) {
      setError("This QR code does not contain a certificate hash.");
      return;
    }
    setHash(certificateHash);
    setError("");
    verifyHashValue(certificateHash);
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

  const tabs = [
    {
      id: "file",
      label: <><MethodIcon name="document" /> File</>,
      content: (
        <form onSubmit={handleFileSubmit} className="form-stack">
          <Field
            id="certificate-file"
            label="Certificate PDF"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              setFile(event.target.files[0] ?? null);
              setError("");
            }}
          />
          <Button type="submit" disabled={loading}>
            {loading ? <Spinner label="Checking certificate…" /> : "Verify PDF"}
          </Button>
        </form>
      ),
    },
    {
      id: "hash",
      label: <><MethodIcon name="check" /> Hash</>,
      content: (
        <form onSubmit={handleHashSubmit} className="form-stack">
          <Field
            id="certificate-hash"
            label="Certificate hash"
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
          <Button type="submit" disabled={loading}>
            {loading ? <Spinner label="Checking certificate…" /> : "Verify hash"}
          </Button>
        </form>
      ),
    },
    {
      id: "qr",
      label: <><MethodIcon name="camera" /> QR</>,
      content: <QrScanner onDecoded={handleQrDecoded} />,
    },
  ];

  return (
    <div className="content-page">
      <header className="page-heading">
        <p className="eyebrow">Certificate authenticity</p>
        <h1>Verify a certificate</h1>
        <p>Choose a PDF, enter a hash, or scan a certificate QR code.</p>
      </header>

      <Card className="verify-panel">
        <Tabs items={tabs} label="Verification method" />
      </Card>

      <div className="feedback-region" aria-live="polite">
        {loading && <Spinner label="Contacting the verification service…" />}
        {error && <Alert variant="error">{error}</Alert>}
        <VerificationResult result={result} hash={hash} />
        {result && (
          <Card className="assistant-card">
            <Button
              variant="ghost"
              className="assistant-toggle"
              type="button"
              aria-expanded={assistantOpen}
              aria-controls="assistant-result-panel"
              onClick={() => setAssistantOpen((open) => !open)}
            >
              Ask about this result
            </Button>
            {assistantOpen && (
              <div id="assistant-result-panel" className="assistant-content">
                <p className="supporting-text">The blockchain determines the status. The assistant only explains it.</p>
                <form onSubmit={handleAssistantSubmit} className="form-stack">
                  <Field
                    id="assistant-result-question"
                    label="Your question"
                    type="text"
                    value={assistantQuestion}
                    onChange={(event) => setAssistantQuestion(event.target.value)}
                    maxLength={1000}
                    required
                  />
                  <Button type="submit" disabled={assistantLoading}>
                    {assistantLoading ? <Spinner label="Preparing an explanation…" /> : "Ask"}
                  </Button>
                </form>
                {assistantError && <Alert variant="error">{assistantError}</Alert>}
                {assistantReply && <Alert variant="info">{assistantReply}</Alert>}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
