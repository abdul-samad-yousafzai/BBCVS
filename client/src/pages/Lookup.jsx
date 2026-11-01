import { useState } from "react";
import { getCertificateByRoll } from "../api.js";

function field(record, camelCase, snakeCase) {
  return record[camelCase] ?? record[snakeCase] ?? "N/A";
}

export default function Lookup() {
  const [rollNumber, setRollNumber] = useState("");
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const roll = rollNumber.trim();
    if (!roll) {
      setError("Enter a roll number to search.");
      return;
    }

    setLoading(true);
    setError("");
    setRecord(null);
    try {
      setRecord(await getCertificateByRoll(roll));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content-page narrow-page">
      <header className="page-heading">
        <p className="eyebrow">Certificate records</p>
        <h1>Look up a student</h1>
        <p>Find an issued certificate record using the student’s roll number.</p>
      </header>

      <section className="panel">
        <form onSubmit={handleSubmit}>
          <label htmlFor="lookup-roll">Roll number</label>
          <div className="inline-form">
            <input
              id="lookup-roll"
              value={rollNumber}
              onChange={(event) => {
                setRollNumber(event.target.value);
                setError("");
              }}
              autoComplete="off"
              required
            />
            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
      </section>

      <div aria-live="polite">
        {loading && <p className="loading-message"><span className="spinner" /> Searching certificate records…</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {record && (
          <section className="panel lookup-result">
            <div className="result-heading">
              <span className={`status-pill ${record.revoked ? "pill-revoked" : "pill-valid"}`}>
                {record.revoked ? "REVOKED" : "ACTIVE"}
              </span>
              <h2>Certificate record</h2>
            </div>
            <dl className="data-list">
              <div><dt>Student</dt><dd>{field(record, "studentName", "student_name")}</dd></div>
              <div><dt>Roll number</dt><dd>{field(record, "rollNumber", "roll_number")}</dd></div>
              <div><dt>Program</dt><dd>{field(record, "program", "program")}</dd></div>
              <div><dt>Issue date</dt><dd>{field(record, "issueDate", "issue_date")}</dd></div>
              <div><dt>Status</dt><dd>{record.revoked ? "Revoked" : "Not revoked"}</dd></div>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
