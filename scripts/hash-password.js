import { hashPassword } from "../src/admin-auth.js";

// Run this script only on the developer's own machine.
const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exitCode = 1;
} else {
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
}
