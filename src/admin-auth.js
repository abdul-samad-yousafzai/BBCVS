import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const PASSWORD_HASH_BYTES = 64;

export function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Password must be a non-empty string.");
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, PASSWORD_HASH_BYTES);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") {
    return false;
  }

  const parts = stored.split(":");
  if (parts.length !== 2 || !/^[0-9a-f]{32}$/i.test(parts[0])) {
    return false;
  }

  if (!/^[0-9a-f]{128}$/i.test(parts[1])) {
    return false;
  }

  const salt = Buffer.from(parts[0], "hex");
  const expectedHash = Buffer.from(parts[1], "hex");
  const actualHash = scryptSync(password, salt, expectedHash.length);
  return actualHash.length === expectedHash.length
    && timingSafeEqual(actualHash, expectedHash);
}

function signPayload(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createSessionToken(secret, ttlMs) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("Session secret must be at least 32 characters.");
  }
  if (!Number.isFinite(ttlMs)) {
    throw new TypeError("Session lifetime must be a finite number.");
  }

  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + ttlMs,
  })).toString("base64url");
  const signature = signPayload(payload, secret).toString("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token, secret) {
  if (
    typeof token !== "string" ||
    typeof secret !== "string" ||
    secret.length < 32
  ) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }

  let actualSignature;
  let payload;
  try {
    actualSignature = Buffer.from(parts[1], "base64url");
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return false;
  }

  const expectedSignature = signPayload(parts[0], secret);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return false;
  }

  return payload !== null
    && typeof payload === "object"
    && Number.isFinite(payload.exp)
    && payload.exp > Date.now();
}

export function parseCookies(headerValue) {
  if (typeof headerValue !== "string" || headerValue === "") {
    return {};
  }

  return Object.fromEntries(
    headerValue.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) {
        return [];
      }

      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (!name) {
        return [];
      }

      try {
        return [[name, decodeURIComponent(value)]];
      } catch {
        return [[name, value]];
      }
    }),
  );
}
