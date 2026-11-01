import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readdir, rm } from "node:fs/promises";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { resolve } from "node:path";
import { network } from "hardhat";
import { app } from "../src/server.js";
import {
  issueCertificateFromDetails,
  revokeCertificateByHash,
} from "../src/issuer.js";

const connection = await network.create();
const { ethers } = connection;
const server = createServer(app);
const generatedPdfPaths = [];
let baseUrl;
let certificate;
let issuedResult;

const recordsByRollNumber = new Map();
const recordsByHash = new Map();
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
    return record;
  },
  async markRevoked(hash) {
    const record = recordsByHash.get(hash);
    if (!record) {
      throw new Error("No certificate record found for the hash.");
    }
    record.revoked = true;
    return record;
  },
};

const certificateDetails = {
  studentName: "Issuer Test Student",
  rollNumber: "ISSUER-TEST-001",
  program: "Computer Science",
  issueDate: "2026-10-31",
  verificationUrl: "https://example.edu/verify/ISSUER-TEST-001",
};

describe("Certificate issuer", () => {
  before(async () => {
    certificate = await ethers.deployContract("Certificate");
    app.locals.certificate = certificate;
    app.locals.repository = fakeRepository;
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    server.close();
    await once(server, "close");
    delete app.locals.certificate;
    delete app.locals.repository;
    recordsByRollNumber.clear();
    recordsByHash.clear();
    for (const pdfPath of generatedPdfPaths) {
      await rm(pdfPath, { force: true });
    }
    await connection.close();
  });

  it("generates and issues a certificate whose hash verifies as VALID", async () => {
    issuedResult = await issueCertificateFromDetails(
      certificate,
      certificateDetails,
      fakeRepository,
    );
    generatedPdfPaths.push(issuedResult.pdfPath);

    const [valid, revoked, issuer] = await certificate.verifyCertificate(issuedResult.hash);
    const storedRecord = await fakeRepository.findByHash(issuedResult.hash);
    assert.equal(valid, true);
    assert.equal(revoked, false);
    assert.equal(issuer, (await ethers.getSigners())[0].address);
    assert.match(issuedResult.transactionHash, /^0x[0-9a-f]{64}$/);
    assert.equal(storedRecord.rollNumber, certificateDetails.rollNumber);
    assert.equal(storedRecord.hash, issuedResult.hash);
  });

  it("rejects a duplicate roll number before creating a PDF", async () => {
    const duplicateRollNumber = "DUPLICATE-ROLL-NO-PDF-TEST";
    recordsByRollNumber.set(duplicateRollNumber, {
      rollNumber: duplicateRollNumber,
      hash: `0x${"d".repeat(64)}`,
    });

    let matchingFilesBefore = [];
    try {
      matchingFilesBefore = (await readdir(resolve("certificates"))).filter(
        (name) => name.startsWith(`certificate-${duplicateRollNumber}-`),
      );
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    await assert.rejects(
      issueCertificateFromDetails(
        certificate,
        { ...certificateDetails, rollNumber: duplicateRollNumber },
        fakeRepository,
      ),
      /A certificate already exists for this roll number/,
    );

    let matchingFilesAfter = [];
    try {
      matchingFilesAfter = (await readdir(resolve("certificates"))).filter(
        (name) => name.startsWith(`certificate-${duplicateRollNumber}-`),
      );
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    assert.deepEqual(matchingFilesAfter, matchingFilesBefore);
  });

  it("rejects issuing the same certificate hash twice", async () => {
    await assert.rejects(
      certificate.issueCertificate(issuedResult.hash),
      /Already issued/,
    );
  });

  it("marks the issued certificate as REVOKED", async () => {
    const result = await revokeCertificateByHash(
      certificate,
      issuedResult.hash,
      fakeRepository,
    );
    const [valid, revoked] = await certificate.verifyCertificate(result.hash);
    const storedRecord = await fakeRepository.findByHash(result.hash);

    assert.equal(valid, false);
    assert.equal(revoked, true);
    assert.equal(storedRecord.revoked, true);
  });

  it("rejects an empty roll number from the issue endpoint", async () => {
    const response = await fetch(`${baseUrl}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...certificateDetails, rollNumber: " " }),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Roll number is required/);
  });

  it("rejects a malformed hash from the revoke endpoint", async () => {
    const response = await fetch(`${baseUrl}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: "0x1234" }),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /32-byte hexadecimal string/);
  });

  it("serves the issuer portal at /issuer", async () => {
    const response = await fetch(`${baseUrl}/issuer`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Issuer Portal/);
    assert.match(response.headers.get("content-type"), /text\/html/);
  });

  it("issues certificates through the HTTP endpoint", async () => {
    const response = await fetch(`${baseUrl}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...certificateDetails,
        rollNumber: "ISSUER-HTTP-002",
      }),
    });
    const result = await response.json();
    generatedPdfPaths.push(result.pdfPath);

    assert.equal(response.status, 201);
    assert.match(result.hash, /^0x[0-9a-f]{64}$/);
    const [valid] = await certificate.verifyCertificate(result.hash);
    assert.equal(valid, true);
    assert.equal(
      (await fakeRepository.findByRollNumber("ISSUER-HTTP-002")).hash,
      result.hash,
    );

    const lookupResponse = await fetch(
      `${baseUrl}/certificates/roll/ISSUER-HTTP-002`,
    );
    const lookupResult = await lookupResponse.json();
    assert.equal(lookupResponse.status, 200);
    assert.equal(lookupResult.hash, result.hash);
    assert.equal("pdf_path" in lookupResult, false);
  });

  it("returns 404 when a roll number is not in the repository", async () => {
    const response = await fetch(
      `${baseUrl}/certificates/roll/UNKNOWN-ROLL-NUMBER`,
    );

    assert.equal(response.status, 404);
  });

  it("revokes certificates through the HTTP endpoint", async () => {
    const details = { ...certificateDetails, rollNumber: "ISSUER-HTTP-003" };
    const issued = await issueCertificateFromDetails(
      certificate,
      details,
      fakeRepository,
    );
    generatedPdfPaths.push(issued.pdfPath);

    const response = await fetch(`${baseUrl}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: issued.hash }),
    });
    const result = await response.json();
    const [, revoked] = await certificate.verifyCertificate(issued.hash);

    assert.equal(response.status, 200);
    assert.equal(result.hash, issued.hash);
    assert.equal(revoked, true);
    assert.equal((await fakeRepository.findByHash(issued.hash)).revoked, true);
  });
});
