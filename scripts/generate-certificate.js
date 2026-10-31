import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashFile } from "../src/hash.js";
import { generateCertificatePdf } from "../src/certificate-pdf.js";

function safeFilePart(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/[. ]+$/g, "");
}

async function main() {
  const [studentName, rollNumber, program, issueDate, verificationUrl] =
    process.argv.slice(2);

  if (
    process.argv.length !== 7 ||
    !studentName ||
    !rollNumber ||
    !program ||
    !issueDate ||
    !verificationUrl
  ) {
    throw new Error(
      'Usage: node scripts/generate-certificate.js "<studentName>" "<rollNumber>" "<program>" "<issueDate>" "<verificationUrl>"',
    );
  }

  const outputDirectory = resolve("certificates");
  await mkdir(outputDirectory, { recursive: true });

  const filePart = safeFilePart(rollNumber) || safeFilePart(studentName) || "certificate";
  const outputPath = join(
    outputDirectory,
    `certificate-${filePart}-${Date.now()}.pdf`,
  );
  const details = {
    studentName,
    rollNumber,
    program,
    issueDate,
    verificationUrl,
  };

  await generateCertificatePdf(outputPath, details);

  console.log(`Certificate PDF: ${basename(outputPath)}`);
  console.log(`File path: ${outputPath}`);
  console.log(`SHA-256: ${await hashFile(outputPath)}`);
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
