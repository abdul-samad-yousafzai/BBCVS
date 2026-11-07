// Provides protected certificate issue, bulk upload, revoke, and alert tools.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  adminLogout,
  checkCertificateDesign,
  extractCertificateDetails,
  getAdminAlerts,
  getAdminSession,
  issueBatch,
  issueCertificate,
  revokeCertificate,
} from "../api.js";
import Alert from "../components/Alert.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import CopyButton from "../components/CopyButton.jsx";
import Field from "../components/Field.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Tabs from "../components/Tabs.jsx";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const INITIAL_DETAILS = {
  studentName: "",
  rollNumber: "",
  program: "",
  issueDate: "",
  verificationUrl: "",
};

export default function Issuer() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState("checking");
  const [sessionError, setSessionError] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);
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
  const [revokeHash, setRevokeHash] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMessage, setRevokeMessage] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminSession()
      .then(({ authenticated }) => {
        if (!active) return;
        if (authenticated) {
          setSessionState("authenticated");
        } else {
          navigate("/login", { replace: true });
        }
      })
      .catch((error) => {
        if (!active) return;
        setSessionError(error.message);
        setSessionState("unavailable");
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleRefreshAlerts() {
    setAlertsLoading(true);
    setAlertsError("");
    try {
      const response = await getAdminAlerts();
      setAlerts(response.alerts || []);
    } catch (error) {
      setAlertsError(error.message);
    } finally {
      setAlertsLoading(false);
    }
  }

  useEffect(() => {
    if (sessionState === "authenticated") void handleRefreshAlerts();
  }, [sessionState]);

  async function handleLogout() {
    setLogoutLoading(true);
    setSessionError("");
    try {
      await adminLogout();
      navigate("/", { replace: true });
    } catch (error) {
      setSessionError(error.message);
    } finally {
      setLogoutLoading(false);
    }
  }

  function updateDetails(event) {
    const { name, value } = event.target;
    setDetails((current) => ({ ...current, [name]: value }));
    setIssueError("");
    if (suggestedFieldsRequireConfirmation) setSuggestionConfirmed(false);
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
      void handleRefreshAlerts();
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
      void handleRefreshAlerts();
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
      void handleRefreshAlerts();
    } catch (error) {
      setBatchErrors(Array.isArray(error.errors) ? error.errors : []);
      setBatchSuggestion(error.suggestion || "");
      setBatchError(error.errors ? "" : error.message);
    } finally {
      setBatchLoading(false);
    }
  }

  const issueContent = (
    <div className="issuer-section-stack">
      <Card>
        <div className="section-heading">
          <p className="eyebrow">New credential</p>
          <h2>Issue a certificate</h2>
          <p>Student details are stored with the certificate hash.</p>
        </div>
        <div className="form-stack">
          <Field
            id="prefill-certificate-file"
            label="Certificate PDF for optional suggestions"
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
          <div className="action-row">
            <Button
              variant="secondary"
              type="button"
              onClick={handleExtractDetails}
              disabled={extractLoading || !pdfFile}
            >
              {extractLoading ? <Spinner label="Reading PDF…" /> : "Prefill from PDF"}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={handleDesignCheck}
              disabled={designLoading || !pdfFile}
            >
              {designLoading ? <Spinner label="Checking design…" /> : "Check PDF design"}
            </Button>
          </div>
          {extractError && <Alert variant="error">{extractError}</Alert>}
          {suggestionNotice && <Alert variant="info">{suggestionNotice}</Alert>}
          {designError && <Alert variant="error">{designError}</Alert>}
          {designAdvice && (
            <Alert variant="info">
              <p>{designAdvice}</p>
              <p>{designDisclaimer}</p>
            </Alert>
          )}
        </div>

        <form onSubmit={handleIssue} noValidate className="form-stack issue-form">
          <div className="field-grid">
            <Field id="studentName" label="Student name" name="studentName" value={details.studentName} onChange={updateDetails} autoComplete="name" required />
            <Field id="rollNumber" label="Roll number" name="rollNumber" value={details.rollNumber} onChange={updateDetails} required />
            <Field id="program" label="Program" name="program" value={details.program} onChange={updateDetails} required />
            <Field id="issueDate" label="Issue date" name="issueDate" type="date" value={details.issueDate} onChange={updateDetails} required />
            <Field id="verificationUrl" className="field-wide" label="Verification URL" name="verificationUrl" type="url" value={details.verificationUrl} onChange={updateDetails} placeholder="https://example.test/verify" required />
          </div>
          {suggestedFieldsRequireConfirmation && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={suggestionConfirmed}
                onChange={(event) => {
                  setSuggestionConfirmed(event.target.checked);
                  setIssueError("");
                }}
              />
              <span>I have checked every field suggested from the PDF.</span>
            </label>
          )}
          {issueError && <Alert variant="error">{issueError}</Alert>}
          <Button type="submit" disabled={issueLoading}>
            {issueLoading ? <Spinner label="Generating and issuing…" /> : "Generate and issue"}
          </Button>
        </form>
      </Card>

      {issued && (
        <Card className="issuer-success" aria-live="polite">
          <div className="result-heading">
            <div>
              <p className="eyebrow">Transaction confirmed</p>
              <h2>Certificate issued successfully</h2>
            </div>
            <StatusBadge status="VALID" />
          </div>
          <div className="copy-list">
            <div className="copy-field">
              <div><span className="copy-label">Certificate hash</span><code>{issued.hash}</code></div>
              <CopyButton value={issued.hash} onError={() => setIssueError("Clipboard access was denied. Select and copy the value manually.")} />
            </div>
            <div className="copy-field">
              <div><span className="copy-label">Transaction hash</span><code>{issued.transactionHash}</code></div>
              <CopyButton value={issued.transactionHash} onError={() => setIssueError("Clipboard access was denied. Select and copy the value manually.")} />
            </div>
          </div>
          {issued.pdfPath && <p className="supporting-text">PDF saved at: <span className="break-all">{issued.pdfPath}</span></p>}
        </Card>
      )}
    </div>
  );

  const batchContent = (
    <Card>
      <div className="section-heading">
        <p className="eyebrow">CSV workflow</p>
        <h2>Bulk issue</h2>
        <p>Every row is validated before any certificate is issued.</p>
      </div>
      <form onSubmit={handleBatchIssue} className="form-stack">
        <Field
          id="batch-csv-file"
          label="CSV file"
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
        {batchError && <Alert variant="error">{batchError}</Alert>}
        <Button type="submit" disabled={batchLoading}>
          {batchLoading ? <Spinner label="Issuing certificates…" /> : "Upload and issue"}
        </Button>
      </form>
      {batchErrors.length > 0 && (
        <Alert variant="error" className="batch-errors">
          <p>The CSV has validation errors. No certificates were issued.</p>
          <ul>
            {batchErrors.map((error, index) => (
              <li key={`${error.line}-${error.field}-${index}`}>
                Line {error.line}{error.field ? `, ${error.field}` : ""}: {error.message}
              </li>
            ))}
          </ul>
          {batchSuggestion && <p>{batchSuggestion}</p>}
        </Alert>
      )}
      {batchResult && (
        <div className="batch-result" aria-live="polite">
          <p className="supporting-text">Issued: {batchResult.issued.length}. Failed: {batchResult.failed.length}.</p>
          {(batchResult.issued.length > 0 || batchResult.failed.length > 0) && (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Bulk issue results">
              <table className="batch-results-table">
                <thead><tr><th>Status</th><th>Roll number</th><th>Result</th></tr></thead>
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
    </Card>
  );

  const revokeContent = (
    <Card>
      <div className="section-heading">
        <p className="eyebrow">Permanent action</p>
        <h2>Revoke a certificate</h2>
        <p>Revocation is permanent. Confirm before submitting.</p>
      </div>
      <form onSubmit={handleRevoke} noValidate className="form-stack">
        <Field
          id="revokeHash"
          label="Certificate hash"
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
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setRevokeError("");
            }}
          />
          <span>I confirm that this certificate should be revoked.</span>
        </label>
        {revokeError && <Alert variant="error">{revokeError}</Alert>}
        {revokeMessage && <Alert variant="success">{revokeMessage}</Alert>}
        <Button variant="danger" type="submit" disabled={revokeLoading}>
          {revokeLoading ? <Spinner label="Revoking…" /> : "Revoke certificate"}
        </Button>
      </form>
    </Card>
  );

  const alertsContent = (
    <Card>
      <div className="section-heading">
        <p className="eyebrow">Issuance activity</p>
        <h2>Activity alerts</h2>
        <p>Alerts identify unusually frequent issuance activity.</p>
      </div>
      {alertsError && <Alert variant="error">{alertsError}</Alert>}
      {alertsLoading ? (
        <Spinner label="Loading alerts…" />
      ) : alerts.length === 0 ? (
        <Alert variant="info">There are no current issuance alerts.</Alert>
      ) : (
        <ul className="alerts-list" aria-live="polite">
          {alerts.map((alert, index) => (
            <li key={`${alert.level}-${alert.windowMs}-${index}`}>
              <span className="alert-level-badge">Warning</span>
              <span>
                {alert.level === "warning" ? "Warning" : alert.level}: {alert.count} issuance events
                in a {Math.round(alert.windowMs / 1000)} second window.
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" type="button" onClick={() => void handleRefreshAlerts()} disabled={alertsLoading}>
        Refresh alerts
      </Button>
    </Card>
  );

  if (sessionState === "checking") return <Spinner label="Checking admin session…" />;
  if (sessionState !== "authenticated") {
    return (
      <Card className="auth-required" role="alert">
        <p>{sessionError || "Admin login is required to use the issuer portal."}</p>
        <Button as={Link} to="/login">Go to login</Button>
      </Card>
    );
  }

  return (
    <div className="content-page issuer-page">
      <header className="issuer-header">
        <div>
          <p className="eyebrow">Authorized issuers</p>
          <h1>Issuer portal</h1>
          <p>Manage certificate issuance and revocation.</p>
        </div>
        <Button variant="secondary" type="button" onClick={handleLogout} disabled={logoutLoading}>
          {logoutLoading ? <Spinner label="Signing out…" /> : "Logout"}
        </Button>
      </header>
      {sessionError && <Alert variant="error">{sessionError}</Alert>}
      <Tabs
        label="Issuer actions"
        defaultTab="issue"
        items={[
          { id: "issue", label: "Issue", content: issueContent },
          { id: "bulk-csv", label: "Bulk CSV", content: batchContent },
          { id: "revoke", label: "Revoke", content: revokeContent },
          { id: "alerts", label: "Alerts", content: alertsContent },
        ]}
      />
    </div>
  );
}
