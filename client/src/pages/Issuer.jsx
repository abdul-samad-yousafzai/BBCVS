import { useState } from "react";
import {
  checkCertificateDesign,
  extractCertificateDetails,
  issueBatch,
  issueCertificate,
  revokeCertificate,
} from "../api.js";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const INITIAL_DETAILS = {
  studentName: "",
  rollNumber: "",
  program: "",
  issueDate: "",
  verificationUrl: "",
};

function CopyField({ label, value, onCopy, copied }) {
  return (
    <div className="copy-field">
      <div><span className="copy-label">{label}</span><code>{value}</code></div>
      <button className="button button-secondary button-small" type="button" onClick={() => onCopy(value)}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function Issuer() {
  const [details, setDetails] = useState(INITIAL_DETAILS);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issued, setIssued] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const [suggestedFieldsRequireConfirmation, setSuggestedFieldsRequireConfirmation] = useState(false);
  const [suggestionConfirmed, setSuggestionConfirmed] = useState(false);
  const [designLoading, setDesignLoading] = useState(false);
  const [designAdvice, setDesignAdvice] = useState("");
  const [designDisclaimer, setDesignDisclaimer] = useState("");
  const [designError, setDesignError] = useState("");
  const [batchFile, setBatchFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [batchErrors, setBatchErrors] = useState([]);
  const [batchSuggestion, setBatchSuggestion] = useState("");
  const [batchError, setBatchError] = useState("");
  const [copiedValue, setCopiedValue] = useState("");
  const [revokeHash, setRevokeHash] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMessage, setRevokeMessage] = useState("");
  const [revokeError, setRevokeError] = useState("");

  function updateDetails(event) {
    const { name, value } = event.target;
    setDetails((current) => ({ ...current, [name]: value }));
    setIssueError("");
    if (suggestedFieldsRequireConfirmation) {
      setSuggestionConfirmed(false);
    }
  }

  async function handleIssue(event) {
    event.preventDefault();
    if (suggestedFieldsRequireConfirmation && !suggestionConfirmed) {
      setIssueError("Review and confirm every suggested field before issuing.");
      return;
    }
    const cleanedDetails = Object.fromEntries(
      Object.entries(details).map(([key, value]) => [key, value.trim()]),
    );
    const emptyField = Object.entries(cleanedDetails).find(([, value]) => !value);
    if (emptyField) {
      setIssueError(`${emptyField[0]} is required.`);
      return;
    }
    try {
      new URL(cleanedDetails.verificationUrl);
    } catch {
      setIssueError("Enter a valid verification URL.");
      return;
    }
    if (!/^https?:$/.test(new URL(cleanedDetails.verificationUrl).protocol)) {
      setIssueError("Verification URL must use HTTP or HTTPS.");
      return;
    }

    setIssueLoading(true);
    setIssueError("");
    setIssued(null);
    try {
      setIssued(await issueCertificate(cleanedDetails));
      setSuggestedFieldsRequireConfirmation(false);
      setSuggestionConfirmed(false);
    } catch (error) {
      setIssueError(error.message);
    } finally {
      setIssueLoading(false);
    }
  }

  async function handleExtractDetails() {
    if (!pdfFile) {
      setExtractError("Choose a PDF file first.");
      return;
    }

    setExtractLoading(true);
    setExtractError("");
    setSuggestionNotice("");
    setIssueError("");
    try {
      const { suggestion } = await extractCertificateDetails(pdfFile);
      setDetails((current) => ({
        ...current,
        studentName: suggestion.studentName ?? "",
        rollNumber: suggestion.rollNumber ?? "",
        program: suggestion.program ?? "",
        issueDate: suggestion.issueDate ?? "",
      }));
      setSuggestedFieldsRequireConfirmation(true);
      setSuggestionConfirmed(false);
      setSuggestionNotice(
        "Check every field before issuing. The values were suggested by AI and are not verified. The verification URL is not extracted; check or enter it manually.",
      );
    } catch (error) {
      setExtractError(error.message);
    } finally {
      setExtractLoading(false);
    }
  }

  async function handleDesignCheck() {
    if (!pdfFile) {
      setDesignError("Choose a PDF file first.");
      return;
    }

    setDesignLoading(true);
    setDesignAdvice("");
    setDesignDisclaimer("");
    setDesignError("");
    try {
      const result = await checkCertificateDesign(pdfFile);
      setDesignAdvice(result.advice);
      setDesignDisclaimer(result.disclaimer);
    } catch (error) {
      setDesignError(error.message);
    } finally {
      setDesignLoading(false);
    }
  }

  async function copyValue(value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(""), 1800);
    } catch {
      setIssueError("Clipboard access was denied. Select and copy the value manually.");
    }
  }

  async function handleRevoke(event) {
    event.preventDefault();
    const hash = revokeHash.trim();
    if (!HASH_PATTERN.test(hash)) {
      setRevokeError("Enter a valid 0x-prefixed 32-byte hexadecimal hash.");
      return;
    }
    if (!confirmed) {
      setRevokeError("Confirm that you want to revoke this certificate.");
      return;
    }

    setRevokeLoading(true);
    setRevokeError("");
    setRevokeMessage("");
    try {
      const result = await revokeCertificate(hash);
      setRevokeMessage(`Certificate revoked. Transaction: ${result.transactionHash}`);
      setRevokeHash("");
      setConfirmed(false);
    } catch (error) {
      setRevokeError(error.message);
    } finally {
      setRevokeLoading(false);
    }
  }

  async function handleBatchIssue(event) {
    event.preventDefault();
    if (!batchFile) {
      setBatchError("Choose a CSV file to issue.");
      return;
    }

    setBatchLoading(true);
    setBatchResult(null);
    setBatchErrors([]);
    setBatchSuggestion("");
    setBatchError("");
    try {
      setBatchResult(await issueBatch(batchFile));
    } catch (error) {
      setBatchErrors(Array.isArray(error.errors) ? error.errors : []);
      setBatchSuggestion(error.suggestion || "");
      setBatchError(error.errors ? "" : error.message);
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className="content-page">
      <header className="page-heading">
        <p className="eyebrow">Authorized issuers</p>
        <h1>Issuer portal</h1>
        <p>Create a certificate record or revoke a certificate that should no longer be valid.</p>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <span className="step-number">01</span>
          <div><h2>Issue a certificate</h2><p>Student details are stored with the certificate hash.</p></div>
        </div>
        <div className="form-field">
          <label htmlFor="prefill-certificate-file">Certificate PDF</label>
          <input
            id="prefill-certificate-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              setPdfFile(event.target.files[0] ?? null);
              setExtractError("");
              setDesignError("");
              setDesignAdvice("");
              setDesignDisclaimer("");
            }}
          />
        </div>
        <div className="pdf-assistant-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={handleExtractDetails}
            disabled={extractLoading || !pdfFile}
          >
            {extractLoading ? "Reading PDF…" : "Prefill from PDF"}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={handleDesignCheck}
            disabled={designLoading || !pdfFile}
          >
            {designLoading ? "Checking design…" : "Check PDF design"}
          </button>
        </div>
        {extractError && <p className="alert alert-error" role="alert">{extractError}</p>}
        {suggestionNotice && <p className="alert alert-info" role="status">{suggestionNotice}</p>}
        {designError && <p className="alert alert-error" role="alert">{designError}</p>}
        {designAdvice && (
          <div className="alert alert-info" aria-live="polite">
            <p>{designAdvice}</p>
            <p>{designDisclaimer}</p>
          </div>
        )}
        <form onSubmit={handleIssue} noValidate>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="studentName">Student name</label>
              <input id="studentName" name="studentName" value={details.studentName} onChange={updateDetails} autoComplete="name" required />
            </div>
            <div className="form-field">
              <label htmlFor="rollNumber">Roll number</label>
              <input id="rollNumber" name="rollNumber" value={details.rollNumber} onChange={updateDetails} required />
            </div>
            <div className="form-field">
              <label htmlFor="program">Program</label>
              <input id="program" name="program" value={details.program} onChange={updateDetails} required />
            </div>
            <div className="form-field">
              <label htmlFor="issueDate">Issue date</label>
              <input id="issueDate" name="issueDate" type="date" value={details.issueDate} onChange={updateDetails} required />
            </div>
            <div className="form-field form-field-wide">
              <label htmlFor="verificationUrl">Verification URL</label>
              <input id="verificationUrl" name="verificationUrl" type="url" value={details.verificationUrl} onChange={updateDetails} placeholder="https://university.example/verify" required />
            </div>
          </div>
          {suggestedFieldsRequireConfirmation && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={suggestionConfirmed}
                onChange={(event) => {
                  setSuggestionConfirmed(event.target.checked);
                  setIssueError("");
                }}
              />
              I have checked every field suggested from the PDF.
            </label>
          )}
          {issueError && <p className="alert alert-error" role="alert">{issueError}</p>}
          <button className="button button-primary" type="submit" disabled={issueLoading}>
            {issueLoading ? "Generating and issuing…" : "Generate and issue"}
          </button>
        </form>
      </section>

      <section className="panel batch-panel">
        <div className="panel-heading">
          <span className="step-number">03</span>
          <div>
            <h2>Bulk issue</h2>
            <p>Upload a CSV file. Every row is validated before any certificate is issued.</p>
          </div>
        </div>
        <form onSubmit={handleBatchIssue}>
          <label htmlFor="batch-csv-file">CSV file</label>
          <input
            id="batch-csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setBatchFile(event.target.files[0] ?? null);
              setBatchResult(null);
              setBatchErrors([]);
              setBatchError("");
              setBatchSuggestion("");
            }}
          />
          {batchError && <p className="alert alert-error" role="alert">{batchError}</p>}
          <button className="button button-primary" type="submit" disabled={batchLoading}>
            {batchLoading ? "Issuing certificates…" : "Upload and issue"}
          </button>
        </form>

        {batchErrors.length > 0 && (
          <div className="alert alert-error" role="alert">
            <p>The CSV has validation errors. No certificates were issued.</p>
            <ul>
              {batchErrors.map((error, index) => (
                <li key={`${error.line}-${error.field}-${index}`}>
                  Line {error.line}{error.field ? `, ${error.field}` : ""}: {error.message}
                </li>
              ))}
            </ul>
            {batchSuggestion && <p>{batchSuggestion}</p>}
          </div>
        )}

        {batchResult && (
          <div className="batch-result">
            <p className="supporting-text">
              Issued: {batchResult.issued.length}. Failed: {batchResult.failed.length}.
            </p>
            {(batchResult.issued.length > 0 || batchResult.failed.length > 0) && (
              <div className="table-scroll">
                <table className="batch-results-table">
                  <thead>
                    <tr><th>Status</th><th>Roll number</th><th>Result</th></tr>
                  </thead>
                  <tbody>
                    {batchResult.issued.map((item) => (
                      <tr key={`issued-${item.rollNumber}`}>
                        <td>Issued</td>
                        <td>{item.rollNumber}</td>
                        <td className="break-all">{item.hash}</td>
                      </tr>
                    ))}
                    {batchResult.failed.map((item, index) => (
                      <tr key={`failed-${item.rollNumber}-${index}`}>
                        <td>Failed</td>
                        <td>{item.rollNumber}</td>
                        <td>{item.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {issued && (
        <section className="result-card valid issuer-success" aria-live="polite">
          <p className="eyebrow">Transaction confirmed</p>
          <h2>Certificate issued successfully</h2>
          <CopyField label="Certificate hash" value={issued.hash} onCopy={copyValue} copied={copiedValue === issued.hash} />
          <CopyField label="Transaction hash" value={issued.transactionHash} onCopy={copyValue} copied={copiedValue === issued.transactionHash} />
          <p className="supporting-text">PDF saved at: <span className="break-all">{issued.pdfPath}</span></p>
        </section>
      )}

      <section className="panel revoke-panel">
        <div className="panel-heading">
          <span className="step-number step-danger">02</span>
          <div><h2>Revoke a certificate</h2><p>Revocation is permanent. Confirm before submitting.</p></div>
        </div>
        <form onSubmit={handleRevoke} noValidate>
          <div className="form-field">
            <label htmlFor="revokeHash">Certificate hash</label>
            <input
              id="revokeHash"
              value={revokeHash}
              onChange={(event) => {
                setRevokeHash(event.target.value);
                setRevokeError("");
                setRevokeMessage("");
              }}
              placeholder="0x followed by 64 hexadecimal characters"
              autoComplete="off"
              spellCheck="false"
              required
            />
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => {
                setConfirmed(event.target.checked);
                setRevokeError("");
              }}
            />
            I confirm that this certificate should be revoked.
          </label>
          {revokeError && <p className="alert alert-error" role="alert">{revokeError}</p>}
          {revokeMessage && <p className="alert alert-success" role="status">{revokeMessage}</p>}
          <button className="button button-danger" type="submit" disabled={revokeLoading}>
            {revokeLoading ? "Revoking…" : "Revoke certificate"}
          </button>
        </form>
      </section>
    </div>
  );
}
