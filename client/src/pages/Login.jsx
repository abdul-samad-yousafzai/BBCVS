// Provides the public admin login while retaining session and return-path behavior.
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { adminLogin, getAdminSession } from "../api.js";
import Alert from "../components/Alert.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import Field from "../components/Field.jsx";
import Logo from "../components/Logo.jsx";
import Spinner from "../components/Spinner.jsx";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);

  useEffect(() => {
    let active = true;
    getAdminSession()
      .then(({ authenticated }) => {
        if (active && authenticated) navigate("/issuer", { replace: true });
      })
      .catch((sessionError) => {
        if (active) setError(sessionError.message);
      })
      .finally(() => {
        if (active) setSessionChecking(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminLogin(password);
      const originalLocation = location.state?.from;
      const returnPath = originalLocation
        ? `${originalLocation.pathname || ""}${originalLocation.search || ""}${originalLocation.hash || ""}`
        : "";
      navigate(returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/issuer", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  if (sessionChecking) return <Spinner label="Checking admin session…" />;

  return (
    <div className="login-page">
      <Card className="login-card">
        <Logo className="login-logo" />
        <div className="section-heading">
          <p className="eyebrow">Admin access</p>
          <h1>Issuer login</h1>
          <p>Sign in to issue or revoke certificates.</p>
        </div>
        <form onSubmit={handleSubmit} className="form-stack">
          <Field
            id="admin-password"
            label="Admin password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading}>
            {loading ? <Spinner label="Signing in…" /> : "Sign in"}
          </Button>
        </form>
        <p className="supporting-text"><Link to="/verify">Return to verification</Link></p>
      </Card>
    </div>
  );
}
