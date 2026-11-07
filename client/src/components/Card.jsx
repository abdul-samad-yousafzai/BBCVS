// Provides a bordered, responsive surface for page content.
export default function Card({ as: Element = "section", className = "", children, ...props }) {
  return <Element className={`card ${className}`.trim()} {...props}>{children}</Element>;
}
