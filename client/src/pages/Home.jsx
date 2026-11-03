import { Link } from "react-router-dom";
import { useState } from "react";
import { askAssistant } from "../api.js";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFaqSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setReply("");
    setError("");
    try {
      const response = await askAssistant({ message: question.trim(), mode: "faq" });
      setReply(response.reply);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home-page">
      <section className="hero">
        <p className="eyebrow">Trusted credentials, made verifiable</p>
        <h1>Academic achievements you can trust.</h1>
        <p className="hero-copy">
          Verify a certificate against its original document hash, or issue and
          manage credentials through the issuer portal.
        </p>
        <Link className="button button-primary" to="/verify">Verify a certificate</Link>
      </section>

      <section className="home-cards" aria-label="Certificate services">
        <Link className="feature-card" to="/verify">
          <span className="feature-icon" aria-hidden="true">✓</span>
          <h2>Verify a certificate</h2>
          <p>Check a PDF or enter its certificate hash to confirm authenticity.</p>
          <span className="card-link">Start verification <span aria-hidden="true">→</span></span>
        </Link>
        <Link className="feature-card" to="/issuer">
          <span className="feature-icon issuer-icon" aria-hidden="true">＋</span>
          <h2>Issuer portal</h2>
          <p>Create certificates, issue them on-chain, and revoke when needed.</p>
          <span className="card-link">Manage certificates <span aria-hidden="true">→</span></span>
        </Link>
      </section>

      <section className="panel faq-panel" aria-labelledby="faq-heading">
        <div className="panel-heading">
          <span className="step-number">FAQ</span>
          <div>
            <h2 id="faq-heading">Ask how the system works</h2>
            <p>Answers are limited to information about this certificate system.</p>
          </div>
        </div>
        <form onSubmit={handleFaqSubmit}>
          <label htmlFor="faq-question">Your question</label>
          <input
            id="faq-question"
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1000}
            required
          />
          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? "Finding an answer…" : "Ask"}
          </button>
        </form>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {reply && <p className="supporting-text" aria-live="polite">{reply}</p>}
      </section>
    </div>
  );
}
