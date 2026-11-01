import { Link } from "react-router-dom";

export default function Home() {
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
    </div>
  );
}
