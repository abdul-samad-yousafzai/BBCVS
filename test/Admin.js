import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { network } from "hardhat";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "../src/admin-auth.js";
import { app } from "../src/server.js";

const ADMIN_PASSWORD = "test-admin-password";
const SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
const server = createServer(app);
const storedRecords = new Map();
let baseUrl;
let adminCookie;
let issuedPdfPath;
let originalAdminPasswordHash;
let originalSessionSecret;
let originalCertificate;
let originalRepository;
let connection;
let certificate;

const fakeRepository = {
  async findByRollNumber(rollNumber) {
    return storedRecords.get(rollNumber) ?? null;
  },
  async insertCertificate(record) {
    storedRecords.set(record.rollNumber, record);
    issuedPdfPath = record.pdfPath;
    return record;
  },
};

async function login(password) {
  return fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.10",
    },
    body: JSON.stringify({ password }),
  });
}

describe("Admin authentication", () => {
  before(async () => {
    app.set("trust proxy", "loopback");
    originalAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    originalSessionSecret = process.env.SESSION_SECRET;
    originalCertificate = app.locals.certificate;
    originalRepository = app.locals.repository;
    process.env.ADMIN_PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);
    process.env.SESSION_SECRET = SESSION_SECRET;

    connection = await network.create();
    certificate = await connection.ethers.deployContract("Certificate");
    app.locals.certificate = certificate;
    app.locals.repository = fakeRepository;
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server.close();
    await once(server, "close");
    if (originalAdminPasswordHash === undefined) {
      delete process.env.ADMIN_PASSWORD_HASH;
    } else {
      process.env.ADMIN_PASSWORD_HASH = originalAdminPasswordHash;
    }
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
    if (originalCertificate === undefined) {
      delete app.locals.certificate;
    } else {
      app.locals.certificate = originalCertificate;
    }
    if (originalRepository === undefined) {
      delete app.locals.repository;
    } else {
      app.locals.repository = originalRepository;
    }
    storedRecords.clear();
    if (issuedPdfPath) {
      await rm(issuedPdfPath, { force: true });
    }
    await connection.close();
  });

  it("hashes and verifies a password and rejects a wrong password", () => {
    const stored = hashPassword(ADMIN_PASSWORD);
    assert.equal(verifyPassword(ADMIN_PASSWORD, stored), true);
    assert.equal(verifyPassword("incorrect-password", stored), false);
  });

  it("rejects a wrong password with one generic error", async () => {
    const response = await login("incorrect-password");
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid password." });
  });

  it("sets an HttpOnly session cookie after a successful login", async () => {
    const response = await login(ADMIN_PASSWORD);
    const setCookie = response.headers.get("set-cookie");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(setCookie, /admin_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Path=\//i);
    assert.match(setCookie, /Max-Age=28800/i);
    assert.match(setCookie, /SameSite=None/i);
    adminCookie = setCookie.split(";")[0];

    const sessionResponse = await fetch(`${baseUrl}/admin/session`, {
      headers: { Cookie: adminCookie },
    });
    assert.deepEqual(await sessionResponse.json(), { authenticated: true });
  });

  it("requires a session to issue a certificate", async () => {
    const details = {
      studentName: "Admin Test Student",
      rollNumber: "ADMIN-SESSION-001",
      program: "Computer Science",
      issueDate: "2026-10-31",
      verificationUrl: "https://example.edu/verify/ADMIN-SESSION-001",
    };
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    };
    const unauthenticated = await fetch(`${baseUrl}/issue`, options);
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(await unauthenticated.json(), { error: "Admin login required." });

    const authenticated = await fetch(`${baseUrl}/issue`, {
      ...options,
      headers: { ...options.headers, Cookie: adminCookie },
    });
    assert.equal(authenticated.status, 201);
    assert.equal((await authenticated.json()).rollNumber, undefined);
    assert.equal(storedRecords.has(details.rollNumber), true);
  });

  it("rejects tampered and expired session tokens", async () => {
    const validToken = adminCookie.slice("admin_session=".length);
    const tamperedToken = `${validToken.slice(0, -1)}${validToken.endsWith("a") ? "b" : "a"}`;
    assert.equal(verifySessionToken(tamperedToken, SESSION_SECRET), false);
    const expiredToken = createSessionToken(SESSION_SECRET, -1);
    assert.equal(verifySessionToken(expiredToken, SESSION_SECRET), false);

    for (const token of [tamperedToken, expiredToken]) {
      const response = await fetch(`${baseUrl}/admin/alerts`, {
        headers: { Cookie: `admin_session=${token}` },
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Admin login required." });
    }
  });

  it("keeps certificate verification public", async () => {
    const response = await fetch(`${baseUrl}/verify/0x${"a".repeat(64)}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "NOT FOUND");
  });

  it("clears the session cookie on logout", async () => {
    const response = await fetch(`${baseUrl}/admin/logout`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);

    const sessionResponse = await fetch(`${baseUrl}/admin/session`);
    assert.deepEqual(await sessionResponse.json(), { authenticated: false });
  });

  it("returns 429 on the sixth login attempt in the window", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await login("incorrect-password")).status, 401);
    }
    const sixthAttempt = await login("incorrect-password");
    assert.equal(sixthAttempt.status, 429);
  });

  it("sets credentialed CORS headers for an allowed origin", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");

    const disallowed = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://not-allowed.example" },
    });
    assert.equal(disallowed.headers.get("access-control-allow-origin"), null);
  });
});
