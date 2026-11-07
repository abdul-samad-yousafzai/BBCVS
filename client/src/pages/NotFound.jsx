// Shows a concise not-found state with a safe route back to Home.
import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";

export default function NotFound() {
  return (
    <Card className="empty-state">
      <p className="eyebrow">404 · Page not found</p>
      <h1>This page is not in the record.</h1>
      <p>The address may be incorrect, or the page may have moved.</p>
      <Button as={Link} to="/">Return home</Button>
    </Card>
  );
}
