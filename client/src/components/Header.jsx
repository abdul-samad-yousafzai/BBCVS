// Renders the public navigation and accessible responsive menu.
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { checkHealth } from "../api.js";
import Logo from "./Logo.jsx";

export default function Header() {
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

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-link" to="/" onClick={closeMenu} aria-label="CertSure home">
          <Logo />
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
          <span className="visually-hidden">Navigation menu</span>
        </button>
        <nav
          id="primary-navigation"
          className={`primary-navigation${menuOpen ? " is-open" : ""}`}
          aria-label="Main navigation"
        >
          <NavLink to="/" onClick={closeMenu}>Home</NavLink>
          <NavLink to="/verify" onClick={closeMenu}>Verify</NavLink>
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
