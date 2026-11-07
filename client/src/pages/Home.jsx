// Presents public certificate actions, lifecycle information, and system FAQ.
import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import ChatBox from "../components/ChatBox.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const steps = [
  { title: "Issued", text: "An authorized issuer creates a certificate record." },
  { title: "Fingerprinted", text: "The certificate document is represented by a unique hash." },
  { title: "Verified on-chain", text: "The hash is checked against its blockchain record." },
];

const statuses = [
  { status: "VALID", meaning: "The certificate hash has an active blockchain record." },
  { status: "REVOKED", meaning: "The recorded certificate has been revoked." },
  { status: "NOT FOUND", meaning: "No certificate record matches the submitted hash." },
];

function HomeIcon({ name }) {
  const paths = {
    document: <><path d="M7 3.75h7l4 4v12.5H7z" /><path d="M14 3.75v4h4M10 12h5m-5 3.5h5" /></>,
    shield: <><path d="M12 3.5 19 6v5.3c0 4.3-2.8 7.5-7 9.2-4.2-1.7-7-4.9-7-9.2V6z" /><path d="m9 12 2 2 4-4" /></>,
    check: <><circle cx="12" cy="12" r="8.5" /><path d="m8 12 2.6 2.6L16.5 9" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4 4" /></>,
  };
  return <svg className="home-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero">
        <p className="eyebrow hero-stagger-1">Trusted academic credentials</p>
        <h1 className="hero-stagger-2">Verify academic certificates in seconds</h1>
        <p className="hero-copy hero-stagger-3">
          Check a certificate document or hash against its blockchain record,
          or find a record using a student’s roll number.
        </p>
        <div className="hero-actions hero-stagger-4">
          <Button as={Link} to="/verify">Verify a certificate</Button>
          <Button as={Link} to="/lookup" variant="secondary">
            <HomeIcon name="search" />
            Look up by roll number
          </Button>
        </div>
      </section>

      <section className="section-block" aria-labelledby="how-it-works-heading">
        <div className="section-heading">
          <p className="eyebrow">A clear verification trail</p>
          <h2 id="how-it-works-heading">How it works</h2>
        </div>
        <div className="three-column-grid">
          {steps.map((step, index) => (
            <Card className="process-card feature-card" key={step.title}>
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="home-icon-wrap">
                <HomeIcon name={["document", "shield", "check"][index]} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="status-legend" aria-labelledby="status-legend-heading">
        <div className="section-heading">
          <p className="eyebrow">Read the result</p>
          <h2 id="status-legend-heading">Verification status</h2>
        </div>
        <div className="legend-grid">
          {statuses.map(({ status, meaning }) => (
            <div className="legend-item" key={status}>
              <StatusBadge status={status} />
              <p>{meaning}</p>
            </div>
          ))}
        </div>
      </Card>

      <ChatBox />
    </div>
  );
}
