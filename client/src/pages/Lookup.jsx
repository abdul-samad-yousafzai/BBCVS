// Looks up certificate metadata by roll number using the existing API flow.
import { useState } from "react";
import { getCertificateByRoll } from "../api.js";
import Alert from "../components/Alert.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import Field from "../components/Field.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

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

      <Card>
        <form onSubmit={handleSubmit} className="search-form">
          <Field
            id="lookup-roll"
            label="Roll number"
            value={rollNumber}
            onChange={(event) => {
              setRollNumber(event.target.value);
              setError("");
            }}
            autoComplete="off"
            required
            error={error}
          />
          <Button type="submit" disabled={loading}>
            {loading ? <Spinner label="Searching…" /> : "Search"}
          </Button>
        </form>
      </Card>

      <div className="feedback-region" aria-live="polite">
        {loading && <Spinner label="Searching certificate records…" />}
        {record && (
          <Card className="lookup-result" aria-labelledby="lookup-result-heading">
            <div className="result-heading">
              <div>
                <p className="eyebrow">Certificate record</p>
                <h2 id="lookup-result-heading">Student details</h2>
              </div>
              {record.revoked && <StatusBadge status="REVOKED" />}
            </div>
            <dl className="data-list">
              <div><dt>Student</dt><dd>{field(record, "studentName", "student_name")}</dd></div>
              <div><dt>Roll number</dt><dd>{field(record, "rollNumber", "roll_number")}</dd></div>
              <div><dt>Program</dt><dd>{field(record, "program", "program")}</dd></div>
              <div><dt>Issue date</dt><dd>{field(record, "issueDate", "issue_date")}</dd></div>
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}
