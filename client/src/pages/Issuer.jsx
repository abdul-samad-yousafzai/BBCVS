import { useState } from "react";
import { issueCertificate, revokeCertificate } from "../api.js";

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
  }

  async function handleIssue(event) {
    event.preventDefault();
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
    } catch (error) {
      setIssueError(error.message);
    } finally {
      setIssueLoading(false);
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
          {issueError && <p className="alert alert-error" role="alert">{issueError}</p>}
          <button className="button button-primary" type="submit" disabled={issueLoading}>
            {issueLoading ? "Generating and issuing…" : "Generate and issue"}
          </button>
        </form>
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
