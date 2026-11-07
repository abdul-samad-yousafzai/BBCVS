// Shares accessible button styles across native buttons and route links.
import { Link } from "react-router-dom";

export default function Button({
  as = "button",
  variant = "primary",
  size = "medium",
  className = "",
  children,
  ...props
}) {
  const classes = `button button-${variant} button-${size} ${className}`.trim();
  if (as === Link) return <Link className={classes} {...props}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
