import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { verifyCertificateFile } from "../scripts/verify.js";
import { generateCertificatePdf } from "../src/certificate-pdf.js";
import { hashFile } from "../src/hash.js";

const { ethers } = await network.create();
let tempDirectory;

const details = {
  studentName: "Alex Student",
  rollNumber: "CS-2026-001",
  program: "Computer Science",
  issueDate: "2026-10-31",
  verificationUrl: "https://example.com/verify/CS-2026-001",
};

async function assertValidPdf(filePath) {
  const pdf = await readFile(filePath);
  assert.ok(pdf.length > 0);
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
}

describe("Certificate PDF generator", () => {
  let certificate;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), "certificate-pdf-"));
    certificate = await ethers.deployContract("Certificate");
  });

  afterEach(async () => {
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
      tempDirectory = undefined;
    }
  });

  it("generates a non-empty PDF file", async () => {
    const outputPath = join(tempDirectory, "certificate.pdf");

    await generateCertificatePdf(outputPath, details);

    await assertValidPdf(outputPath);
  });

  it("generates a valid PDF for the same details more than once", async () => {
    const firstPath = join(tempDirectory, "certificate-first.pdf");
    const secondPath = join(tempDirectory, "certificate-second.pdf");

    await generateCertificatePdf(firstPath, details);
    await generateCertificatePdf(secondPath, details);

    await assertValidPdf(firstPath);
    await assertValidPdf(secondPath);
  });

  it("issues and verifies the generated PDF hash on-chain", async () => {
    const outputPath = join(tempDirectory, "certificate-issued.pdf");
    await generateCertificatePdf(outputPath, details);
    const certificateHash = await hashFile(outputPath);

    await certificate.issueCertificate(certificateHash);

    const result = await verifyCertificateFile(outputPath, certificate);
    assert.equal(result.status, "VALID");
    assert.equal(result.issuer, (await ethers.getSigners())[0].address);
  });
});
