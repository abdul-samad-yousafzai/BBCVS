import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { checkHealth } from "./api.js";
import Home from "./pages/Home.jsx";
import Verify from "./pages/Verify.jsx";
import Issuer from "./pages/Issuer.jsx";
import Lookup from "./pages/Lookup.jsx";
import NotFound from "./pages/NotFound.jsx";

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [serviceOnline, setServiceOnline] = useState(null);

  useEffect(() => {
    let active = true;
    checkHealth()
      .then(() => {
        if (active) setServiceOnline(true);
      })
      .catch(() => {
        if (active) setServiceOnline(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" to="/" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CertSure</span>
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
        </button>
        <nav
          id="primary-navigation"
          className={`primary-navigation${menuOpen ? " is-open" : ""}`}
          aria-label="Main navigation"
        >
          <NavLink to="/verify" onClick={closeMenu}>Verify</NavLink>
          <NavLink to="/issuer" onClick={closeMenu}>Issuer</NavLink>
          <NavLink to="/lookup" onClick={closeMenu}>Lookup</NavLink>
        </nav>
        <span
          className={`service-indicator ${serviceOnline === null ? "checking" : serviceOnline ? "online" : "offline"}`}
          aria-live="polite"
        >
          <span className="service-dot" aria-hidden="true" />
          {serviceOnline === null ? "Checking service" : serviceOnline ? "Service online" : "Service unavailable"}
        </span>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span>CertSure · Secure academic credentials</span>
        <Link to="/verify">Verify a certificate</Link>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="container page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/issuer" element={<Issuer />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
