import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404 · Page not found</p>
      <h1>This page is not in the record.</h1>
      <p>The address may be incorrect, or the page may have moved.</p>
      <Link className="button button-primary" to="/">Return home</Link>
    </section>
  );
}
