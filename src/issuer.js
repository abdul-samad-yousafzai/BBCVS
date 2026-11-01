import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { generateCertificatePdf } from "./certificate-pdf.js";
import { hashFile } from "./hash.js";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function requireText(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

export async function issueCertificateFromDetails(certificate, details, repository) {
  const studentName = requireText(details?.studentName, "Student name");
  const rollNumber = requireText(details?.rollNumber, "Roll number");
  const program = requireText(details?.program, "Program");
  const issueDate = requireText(details?.issueDate, "Issue date");
  const verificationUrl = requireText(details?.verificationUrl, "Verification URL");

  const existingCertificate = await repository.findByRollNumber(rollNumber);
  if (existingCertificate) {
    throw new Error("A certificate already exists for this roll number.");
  }

  const certificatesDirectory = resolve("certificates");
  await mkdir(certificatesDirectory, { recursive: true });
  const safeRollNumber = rollNumber.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
  const pdfPath = resolve(
    certificatesDirectory,
    `certificate-${safeRollNumber}-${randomUUID()}.pdf`,
  );

  await generateCertificatePdf(pdfPath, {
    studentName,
    rollNumber,
    program,
    issueDate,
    verificationUrl,
  });
  const hash = await hashFile(pdfPath);
  const transaction = await certificate.issueCertificate(hash);
  const receipt = await transaction.wait();
  const transactionHash = receipt?.hash ?? transaction.hash;

  await repository.insertCertificate({
    rollNumber,
    studentName,
    program,
    issueDate,
    hash,
    transactionHash,
    pdfPath,
  });

  return {
    hash,
    transactionHash,
    pdfPath,
  };
}

export async function revokeCertificateByHash(certificate, hash, repository) {
  if (typeof hash !== "string" || !HASH_PATTERN.test(hash)) {
    throw new Error("Hash must be a 0x-prefixed 32-byte hexadecimal string.");
  }

  const transaction = await certificate.revokeCertificate(hash);
  const receipt = await transaction.wait();
  const transactionHash = receipt?.hash ?? transaction.hash;
  await repository.markRevoked(hash);

  return {
    hash,
    transactionHash,
  };
}
