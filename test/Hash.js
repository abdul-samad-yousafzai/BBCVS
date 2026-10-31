import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { hashFile } from "../src/hash.js";
import { verifyCertificateFile } from "../scripts/verify.js";

const { ethers } = await network.create();
let tempDirectory;

async function createTempPdf(content) {
  tempDirectory = await mkdtemp(join(tmpdir(), "certificate-hash-"));
  const filePath = join(tempDirectory, "certificate.pdf");
  await writeFile(filePath, content);
  return filePath;
}

describe("Certificate PDF hash", () => {
  let certificate;

  beforeEach(async () => {
    certificate = await ethers.deployContract("Certificate");
  });

  afterEach(async () => {
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
      tempDirectory = undefined;
    }
  });

  it("returns the same hash for unchanged content and a different hash after a byte changes", async () => {
    const filePath = await createTempPdf(Buffer.from("%PDF-1.4\ncertificate"));
    const firstHash = await hashFile(filePath);

    assert.equal(await hashFile(filePath), firstHash);
    assert.match(firstHash, /^0x[0-9a-f]{64}$/);

    await writeFile(filePath, Buffer.from("%PDF-1.4\ncertificatf"));
    assert.notEqual(await hashFile(filePath), firstHash);
  });

  it("matches the file hash stored on-chain after issuing the certificate", async () => {
    const filePath = await createTempPdf(Buffer.from("%PDF-1.4\nissued"));
    const certificateHash = await hashFile(filePath);

    await certificate.issueCertificate(certificateHash);

    const result = await verifyCertificateFile(filePath, certificate);
    assert.equal(result.status, "VALID");
    assert.equal(result.issuer, (await ethers.getSigners())[0].address);
  });

  it("reports NOT FOUND when the file is changed after its original hash was issued", async () => {
    const filePath = await createTempPdf(Buffer.from("%PDF-1.4\noriginal"));
    const issuedHash = await hashFile(filePath);
    await certificate.issueCertificate(issuedHash);

    await writeFile(filePath, Buffer.from("%PDF-1.4\ntampered"));

    const result = await verifyCertificateFile(filePath, certificate);
    assert.equal(result.status, "NOT FOUND");
  });
});
