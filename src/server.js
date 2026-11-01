import "dotenv/config";
import express from "express";
import multer from "multer";
import { network } from "hardhat";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCertificateRepository } from "./certificate-repository.js";
import { hashBuffer } from "./hash.js";
import {
  issueCertificateFromDetails,
  revokeCertificateByHash,
} from "./issuer.js";
import { createSupabaseClient } from "./supabase.js";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter(request, file, callback) {
    if (file.mimetype !== "application/pdf") {
      callback(new Error("Only PDF files are allowed."));
      return;
    }

    callback(null, true);
  },
});

export const app = express();
export default app;
app.use(express.static(publicDirectory));

function validateIssueDetails(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return "A JSON object with certificate details is required.";
  }

  const fields = [
    ["studentName", "Student name"],
    ["rollNumber", "Roll number"],
    ["program", "Program"],
    ["issueDate", "Issue date"],
    ["verificationUrl", "Verification URL"],
  ];

  for (const [field, label] of fields) {
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      return `${label} is required.`;
    }
  }

  return undefined;
}

async function getVerificationResult(certificate, certificateHash) {
  const [valid, revoked, issuer, issuedAt] =
    await certificate.verifyCertificate(certificateHash);

  return {
    status: revoked ? "REVOKED" : valid ? "VALID" : "NOT FOUND",
    issuer,
    issuedAt: issuedAt.toString(),
  };
}

app.get("/health", (request, response) => {
  response.json({ ok: true });
});

app.get("/issuer", (request, response, next) => {
  response.sendFile(resolve(publicDirectory, "issuer.html"), next);
});

app.post("/issue", express.json(), async (request, response) => {
  const certificate = app.locals.certificate;
  const repository = app.locals.repository;
  if (!certificate || !repository) {
    response.status(503).json({ error: "Certificate service is not initialized." });
    return;
  }

  const validationError = validateIssueDetails(request.body);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const result = await issueCertificateFromDetails(
    certificate,
    request.body,
    repository,
  );
  response.status(201).json(result);
});

app.post("/revoke", express.json(), async (request, response) => {
  const certificate = app.locals.certificate;
  const repository = app.locals.repository;
  if (!certificate || !repository) {
    response.status(503).json({ error: "Certificate service is not initialized." });
    return;
  }

  const hash = request.body?.hash;
  if (typeof hash !== "string" || !HASH_PATTERN.test(hash)) {
    response.status(400).json({
      error: "Hash must be a 0x-prefixed 32-byte hexadecimal string.",
    });
    return;
  }

  const result = await revokeCertificateByHash(certificate, hash, repository);
  response.json(result);
});

app.get("/certificates/roll/:rollNumber", async (request, response) => {
  const repository = app.locals.repository;
  if (!repository) {
    response.status(503).json({ error: "Certificate repository is not initialized." });
    return;
  }

  const record = await repository.findByRollNumber(request.params.rollNumber);
  if (!record) {
    response.status(404).json({ error: "Certificate not found." });
    return;
  }

  const { pdf_path, ...publicRecord } = record;
  response.json(publicRecord);
});

app.get("/verify/:hash", async (request, response) => {
  const { hash } = request.params;
  if (!HASH_PATTERN.test(hash)) {
    response.status(400).json({ error: "Hash must be a 0x-prefixed 32-byte hex string." });
    return;
  }

  const certificate = app.locals.certificate;
  if (!certificate) {
    response.status(503).json({ error: "Certificate service is not initialized." });
    return;
  }

  response.json(await getVerificationResult(certificate, hash));
});

app.post("/verify-file", upload.single("file"), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "Upload a PDF in the 'file' field." });
    return;
  }

  if (request.file.buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    response.status(400).json({ error: "Uploaded file is not a valid PDF." });
    return;
  }

  const certificate = app.locals.certificate;
  if (!certificate) {
    response.status(503).json({ error: "Certificate service is not initialized." });
    return;
  }

  const certificateHash = hashBuffer(request.file.buffer);
  response.json(await getVerificationResult(certificate, certificateHash));
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json({ error: "PDF upload must not exceed 10 MB." });
    return;
  }

  if (error instanceof multer.MulterError || error.message === "Only PDF files are allowed.") {
    response.status(400).json({ error: error.message });
    return;
  }

  if (error.type === "entity.parse.failed") {
    response.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }

  if (error.message === "A certificate already exists for this roll number.") {
    response.status(409).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error." });
});

export async function startServer() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Set CONTRACT_ADDRESS to the deployed Certificate address.");
  }

  const connection = await network.create(
    process.env.HARDHAT_NETWORK ?? "localhost",
  );
  try {
    const certificate = await connection.ethers.getContractAt(
      "Certificate",
      contractAddress,
    );
    const supabase = createSupabaseClient();
    app.locals.certificate = certificate;
    app.locals.repository = createCertificateRepository(supabase);
  } catch (error) {
    await connection.close();
    throw error;
  }

  const port = Number(process.env.PORT ?? 3000);
  const server = app.listen(port, () => {
    console.log(`Certificate verification server listening on port ${port}`);
  });
  server.once("close", () => {
    void connection.close();
  });
  return server;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await startServer();
}
