import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { resolve } from "node:path";
import { network } from "hardhat";
import { hashPassword } from "../src/admin-auth.js";
import { checkIssuanceBurst } from "../src/anomaly.js";
import { parseCsv } from "../src/csv-parser.js";
import { app } from "../src/server.js";

const connection = await network.create();
const { ethers } = connection;
const server = createServer(app);
const generatedPdfPaths = [];
const recordsByRollNumber = new Map();
const recordsByHash = new Map();
let baseUrl;
let originalAssistantFetchFn;
let originalAdminPasswordHash;
let originalSessionSecret;
let adminCookie;

const fakeRepository = {
  async findByRollNumber(rollNumber) {
    return recordsByRollNumber.get(rollNumber) ?? null;
  },
  async findByHash(hash) {
    return recordsByHash.get(hash) ?? null;
  },
  async insertCertificate(record) {
    recordsByRollNumber.set(record.rollNumber, record);
    recordsByHash.set(record.hash, record);
    generatedPdfPaths.push(record.pdfPath);
    return record;
  },
};

function row(name, rollNumber) {
  return `${name},${rollNumber},Computer Science,2026-10-31,https://example.edu/verify/${rollNumber}`;
}

async function postCsv(contents, { type = "text/csv", filename = "students.csv" } = {}) {
  const form = new FormData();
  form.append("file", new Blob([contents], { type }), filename);
  const response = await fetch(`${baseUrl}/issue-batch`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: form,
  });
  return { status: response.status, body: await response.json() };
}

describe("Bulk certificate issuing", () => {
  before(async () => {
    app.set("trust proxy", "loopback");
    originalAdminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    originalSessionSecret = process.env.SESSION_SECRET;
    process.env.ADMIN_PASSWORD_HASH = hashPassword("test-admin-password");
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    originalAssistantFetchFn = app.locals.assistantFetchFn;
    app.locals.assistantFetchFn = async () => new Response(
      JSON.stringify({ content: [{ type: "text", text: "Check the CSV fields and formats." }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    app.locals.certificate = await ethers.deployContract("Certificate");
    app.locals.repository = fakeRepository;
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.11",
      },
      body: JSON.stringify({ password: "test-admin-password" }),
    });
    assert.equal(loginResponse.status, 200);
    adminCookie = loginResponse.headers.get("set-cookie").split(";")[0];
  });

  after(async () => {
    server.close();
    await once(server, "close");
    delete app.locals.certificate;
    delete app.locals.repository;
    if (originalAssistantFetchFn === undefined) {
      delete app.locals.assistantFetchFn;
    } else {
      app.locals.assistantFetchFn = originalAssistantFetchFn;
    }
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
    recordsByRollNumber.clear();
    recordsByHash.clear();
    for (const pdfPath of generatedPdfPaths) {
      await rm(pdfPath, { force: true });
    }
    await connection.close();
  });

  it("parses quoted commas, escaped quotes, and CRLF line endings", () => {
    const records = parseCsv(
      'studentName,rollNumber,program,issueDate,verificationUrl\r\n'
      + '"Ada, Lovelace",CS-1,"Computer ""Science""",2026-10-31,https://example.edu',
    );

    assert.deepEqual(records, [{
      studentName: "Ada, Lovelace",
      rollNumber: "CS-1",
      program: 'Computer "Science"',
      issueDate: "2026-10-31",
      verificationUrl: "https://example.edu",
    }]);
  });

  it("issues both rows from a valid CSV", async () => {
    const result = await postCsv([
      "studentName,rollNumber,program,issueDate,verificationUrl",
      row("Student One", "BATCH-VALID-001"),
      row("Student Two", "BATCH-VALID-002"),
    ].join("\r\n"));

    assert.equal(result.status, 200);
    assert.equal(result.body.issued.length, 2);
    assert.deepEqual(result.body.failed, []);
    assert.deepEqual(
      result.body.issued.map((item) => item.rollNumber),
      ["BATCH-VALID-001", "BATCH-VALID-002"],
    );
  });

  it("rejects duplicate roll numbers in a file without issuing any row", async () => {
    const recordCount = recordsByRollNumber.size;
    const result = await postCsv([
      "studentName,rollNumber,program,issueDate,verificationUrl",
      row("Student One", "BATCH-DUPLICATE"),
      row("Student Two", "BATCH-DUPLICATE"),
    ].join("\n"));

    assert.equal(result.status, 400);
    assert.equal(result.body.errors.some((error) => error.field === "rollNumber"), true);
    assert.equal(recordsByRollNumber.size, recordCount);
  });

  it("reports a missing issueDate on the first data line", async () => {
    const result = await postCsv([
      "studentName,rollNumber,program,issueDate,verificationUrl",
      "Student One,BATCH-NO-DATE,Computer Science,,https://example.edu",
    ].join("\n"));

    assert.equal(result.status, 400);
    assert.equal(
      result.body.errors.some((error) => error.line === 2 && error.field === "issueDate"),
      true,
    );
  });

  it("rejects an impossible calendar date", async () => {
    const result = await postCsv([
      "studentName,rollNumber,program,issueDate,verificationUrl",
      "Student One,BATCH-BAD-DATE,Computer Science,2026-02-30,https://example.edu",
    ].join("\n"));

    assert.equal(result.status, 400);
    assert.equal(
      result.body.errors.some((error) => error.field === "issueDate"),
      true,
    );
  });

  it("rejects files with more than 500 data rows", async () => {
    const contents = [
      "studentName,rollNumber,program,issueDate,verificationUrl",
      ...Array.from({ length: 501 }, (_, index) => row(`Student ${index}`, `BATCH-LIMIT-${index}`)),
    ].join("\n");
    const result = await postCsv(contents);

    assert.equal(result.status, 400);
    assert.equal(result.body.errors.some((error) => /at most 500/.test(error.message)), true);
  });

  it("returns an alert only when a burst exceeds its limit", () => {
    assert.deepEqual(
      checkIssuanceBurst(Array.from({ length: 21 }, (_, index) => index * 100), {
        windowMs: 60000,
        limit: 20,
      }),
      { level: "warning", count: 21, windowMs: 60000 },
    );
    assert.equal(
      checkIssuanceBurst(Array.from({ length: 20 }, (_, index) => index * 100), {
        windowMs: 60000,
        limit: 20,
      }),
      null,
    );
  });

  it("rejects non-CSV uploads with status 400", async () => {
    const result = await postCsv("not a CSV file", { type: "text/plain" });

    assert.equal(result.status, 400);
    assert.match(result.body.error, /Only CSV files/);
  });
});
