import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { network } from "hardhat";
import { hashBuffer } from "../src/hash.js";
import { app } from "../src/server.js";

const connection = await network.create();
const { ethers } = connection;
const server = createServer(app);
let baseUrl;
let certificate;
let issuedHash;
let revokedHash;
const uploadedPdf = Buffer.from("%PDF-1.4\nserver certificate");

describe("Verification HTTP server", () => {
  before(async () => {
    certificate = await ethers.deployContract("Certificate");
    issuedHash = `0x${"a".repeat(64)}`;
    revokedHash = `0x${"c".repeat(64)}`;
    await certificate.issueCertificate(issuedHash);
    await certificate.issueCertificate(revokedHash);
    await certificate.revokeCertificate(revokedHash);
    await certificate.issueCertificate(hashBuffer(uploadedPdf));
    app.locals.certificate = certificate;

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    server.close();
    await once(server, "close");
    await connection.close();
    delete app.locals.certificate;
  });

  it("returns a healthy status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("serves the verification page at the root path", async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(html, /Certificate Verification/);
  });

  it("rejects hashes that are not 32-byte hex strings", async () => {
    const response = await fetch(`${baseUrl}/verify/0x1234`);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /32-byte hex string/);
  });

  it("returns the on-chain status for a valid hash", async () => {
    const response = await fetch(`${baseUrl}/verify/${issuedHash}`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "VALID");
    assert.equal(body.issuer, (await ethers.getSigners())[0].address);
    assert.match(body.issuedAt, /^\d+$/);
  });

  it("returns NOT FOUND for an unknown valid hash", async () => {
    const unknownHash = `0x${"b".repeat(64)}`;
    const response = await fetch(`${baseUrl}/verify/${unknownHash}`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "NOT FOUND");
  });

  it("returns REVOKED for a revoked hash", async () => {
    const response = await fetch(`${baseUrl}/verify/${revokedHash}`);

    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "REVOKED");
  });

  it("verifies the hash of an uploaded PDF", async () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([uploadedPdf], { type: "application/pdf" }),
      "certificate.pdf",
    );

    const response = await fetch(`${baseUrl}/verify-file`, {
      method: "POST",
      body: form,
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "VALID");
  });

  it("rejects uploads that are not PDFs", async () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob(["not a PDF"], { type: "text/plain" }),
      "document.txt",
    );

    const response = await fetch(`${baseUrl}/verify-file`, {
      method: "POST",
      body: form,
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Only PDF files/);
  });

  it("rejects files that claim to be PDFs but lack a PDF header", async () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob(["not a PDF"], { type: "application/pdf" }),
      "fake.pdf",
    );

    const response = await fetch(`${baseUrl}/verify-file`, {
      method: "POST",
      body: form,
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /not a valid PDF/);
  });

  it("rejects PDF uploads larger than 10 MB", async () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([Buffer.alloc(10 * 1024 * 1024 + 1, 0x20)], {
        type: "application/pdf",
      }),
      "large.pdf",
    );

    const response = await fetch(`${baseUrl}/verify-file`, {
      method: "POST",
      body: form,
    });

    assert.equal(response.status, 413);
    assert.match((await response.json()).error, /10 MB/);
  });
});
