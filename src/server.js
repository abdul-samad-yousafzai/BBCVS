import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { pdfToPng } from "pdf-to-png-converter";
import { network } from "hardhat";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCertificateRepository } from "./certificate-repository.js";
import { askAssistant } from "./assistant.js";
import { checkIssuanceBurst } from "./anomaly.js";
import { parseCsv } from "./csv-parser.js";
import { validateStudentRows } from "./csv-validator.js";
import { hashBuffer } from "./hash.js";
import {
  issueCertificateFromDetails,
  revokeCertificateByHash,
} from "./issuer.js";
import { createSupabaseClient } from "./supabase.js";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ASSISTANT_STATUSES = new Set(["VALID", "REVOKED", "NOT FOUND"]);
const ASSISTANT_RATE_LIMIT = 20;
const ASSISTANT_RATE_WINDOW_MS = 15 * 60 * 1000;
const ISSUANCE_BURST_WINDOW_MS = 60 * 1000;
const ISSUANCE_BURST_LIMIT = 20;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_CSV_UPLOAD_SIZE = 1024 * 1024;
const assistantRequestsByIp = new Map();
const issuanceTimestamps = [];
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

function recordSuccessfulIssuance() {
  const now = Date.now();
  while (issuanceTimestamps.length > 0
    && now - issuanceTimestamps[0] >= ISSUANCE_BURST_WINDOW_MS) {
    issuanceTimestamps.shift();
  }
  issuanceTimestamps.push(now);
}

async function getValidationSuggestion(errors) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return undefined;
  }

  try {
    return await askAssistant({
      mode: "faq",
      message: `Briefly explain how to fix these CSV validation errors. Only provide a suggestion; do not change the errors.\n${JSON.stringify(errors)}`,
    }, app.locals.assistantFetchFn ?? fetch);
  } catch {
    return undefined;
  }
}

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_UPLOAD_SIZE },
  fileFilter(request, file, callback) {
    if (file.mimetype !== "text/csv") {
      callback(new Error("Only CSV files are allowed."));
      return;
    }

    callback(null, true);
  },
});

export const app = express();
export default app;
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["http://localhost:5173"];

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
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

function validateAssistantRequest(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return "A JSON object is required.";
  }

  if (body.mode !== "explain" && body.mode !== "faq") {
    return "Mode must be explain or faq.";
  }

  if (
    typeof body.message !== "string" ||
    body.message.trim() === "" ||
    body.message.length > 1000
  ) {
    return "Message must be a non-empty string of at most 1000 characters.";
  }

  if (body.mode === "explain") {
    const context = body.context;
    if (
      context === null ||
      typeof context !== "object" ||
      Array.isArray(context) ||
      !ASSISTANT_STATUSES.has(context.status) ||
      (context.issuer !== undefined && typeof context.issuer !== "string") ||
      (context.issuedAt !== undefined && typeof context.issuedAt !== "string")
    ) {
      return "Explain mode requires a valid status and optional string issuer and issuedAt values.";
    }
  }

  return undefined;
}

function isPdfUpload(request) {
  if (!request.file) {
    return false;
  }
  return request.file.buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

function parseExtractedSuggestion(reply) {
  function invalidSuggestion(message) {
    const error = new Error(message);
    error.code = "INVALID_EXTRACTED_SUGGESTION";
    return error;
  }

  let suggestion;
  try {
    suggestion = JSON.parse(reply);
  } catch {
    throw invalidSuggestion("The AI returned invalid JSON for the certificate details.");
  }

  const keys = ["studentName", "rollNumber", "program", "issueDate"];
  if (
    suggestion === null ||
    typeof suggestion !== "object" ||
    Array.isArray(suggestion) ||
    keys.some((key) => !Object.hasOwn(suggestion, key))
  ) {
    throw invalidSuggestion("The AI response must include all four certificate detail keys.");
  }

  if (keys.some((key) => suggestion[key] !== null && typeof suggestion[key] !== "string")) {
    throw invalidSuggestion("Each suggested certificate detail must be a string or null.");
  }

  return Object.fromEntries(keys.map((key) => [key, suggestion[key]]));
}

function isAssistantRateLimited(ipAddress) {
  const now = Date.now();
  for (const [ip, timestamps] of assistantRequestsByIp) {
    const recentTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < ASSISTANT_RATE_WINDOW_MS,
    );
    if (recentTimestamps.length === 0) {
      assistantRequestsByIp.delete(ip);
    } else {
      assistantRequestsByIp.set(ip, recentTimestamps);
    }
  }

  const timestamps = assistantRequestsByIp.get(ipAddress) ?? [];
  if (timestamps.length >= ASSISTANT_RATE_LIMIT) {
    return true;
  }

  timestamps.push(now);
  assistantRequestsByIp.set(ipAddress, timestamps);
  return false;
}

app.get("/health", (request, response) => {
  response.json({ ok: true });
});

app.get("/admin/alerts", (request, response) => {
  const alert = checkIssuanceBurst(issuanceTimestamps, {
    windowMs: ISSUANCE_BURST_WINDOW_MS,
    limit: ISSUANCE_BURST_LIMIT,
  });
  response.json({ alerts: alert ? [alert] : [] });
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
  recordSuccessfulIssuance();
  response.status(201).json(result);
});

app.post("/issue-batch", csvUpload.single("file"), async (request, response) => {
  const certificate = app.locals.certificate;
  const repository = app.locals.repository;
  if (!certificate || !repository) {
    response.status(503).json({ error: "Certificate service is not initialized." });
    return;
  }

  if (!request.file) {
    response.status(400).json({ error: "Upload a CSV file in the 'file' field." });
    return;
  }

  let rows;
  try {
    rows = parseCsv(request.file.buffer.toString("utf8"));
  } catch (error) {
    const errors = [{ line: 1, field: "", message: error.message }];
    response.status(400).json({ errors });
    return;
  }

  const validation = validateStudentRows(rows);
  if (validation.errors.length > 0) {
    const suggestion = await getValidationSuggestion(validation.errors);
    response.status(400).json({
      errors: validation.errors,
      ...(suggestion ? { suggestion } : {}),
    });
    return;
  }

  const issued = [];
  const failed = [];
  for (const details of validation.valid) {
    try {
      const result = await issueCertificateFromDetails(certificate, details, repository);
      recordSuccessfulIssuance();
      issued.push({
        rollNumber: details.rollNumber,
        hash: result.hash,
        transactionHash: result.transactionHash,
      });
    } catch (error) {
      failed.push({ rollNumber: details.rollNumber, error: error.message });
      if (error.message !== "A certificate already exists for this roll number.") {
        break;
      }
    }
  }

  response.json({ issued, failed });
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

app.post("/assistant", express.json(), async (request, response) => {
  const ipAddress = request.ip || request.socket.remoteAddress || "unknown";
  if (isAssistantRateLimited(ipAddress)) {
    response.status(429).json({ error: "Too many assistant requests. Try again later." });
    return;
  }

  const validationError = validateAssistantRequest(request.body);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const { message, mode } = request.body;
  const context = mode === "explain"
    ? {
      status: request.body.context.status,
      ...(request.body.context.issuer === undefined
        ? {}
        : { issuer: request.body.context.issuer }),
      ...(request.body.context.issuedAt === undefined
        ? {}
        : { issuedAt: request.body.context.issuedAt }),
    }
    : undefined;

  try {
    const reply = await askAssistant(
      { message: message.trim(), context, mode },
      app.locals.assistantFetchFn ?? fetch,
    );
    response.json({ reply });
  } catch (error) {
    if (error.code === "MISSING_ANTHROPIC_API_KEY") {
      response.status(503).json({ error: error.message });
      return;
    }

    response.status(502).json({ error: "The AI assistant is temporarily unavailable." });
  }
});

app.post("/extract-details", upload.single("file"), async (request, response) => {
  if (!isPdfUpload(request)) {
    response.status(400).json({
      error: request.file
        ? "Uploaded file is not a valid PDF."
        : "Upload a PDF in the 'file' field.",
    });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    response.status(503).json({ error: "ANTHROPIC_API_KEY is not set." });
    return;
  }

  let extractedText;
  const parser = new PDFParse({ data: request.file.buffer });
  try {
    const parsedPdf = await parser.getText();
    extractedText = parsedPdf.text;
  } catch {
    response.status(422).json({ error: "Unable to extract text from this PDF." });
    return;
  } finally {
    await parser.destroy();
  }

  if (typeof extractedText !== "string" || extractedText.trim() === "") {
    response.status(422).json({ error: "This PDF contains no extractable text." });
    return;
  }

  try {
    const reply = await askAssistant(
      { mode: "extract", message: extractedText },
      app.locals.assistantFetchFn ?? fetch,
    );
    response.json({
      suggestion: parseExtractedSuggestion(reply),
      confidence: "suggested",
    });
  } catch (error) {
    if (error.code === "MISSING_ANTHROPIC_API_KEY") {
      response.status(503).json({ error: error.message });
      return;
    }

    if (error.code === "INVALID_EXTRACTED_SUGGESTION") {
      response.status(422).json({ error: error.message });
      return;
    }

    response.status(502).json({ error: "Unable to get suggested details from the AI service." });
  }
});

app.post("/check-design", upload.single("file"), async (request, response) => {
  if (!isPdfUpload(request)) {
    response.status(400).json({
      error: request.file
        ? "Uploaded file is not a valid PDF."
        : "Upload a PDF in the 'file' field.",
    });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    response.status(503).json({ error: "ANTHROPIC_API_KEY is not set." });
    return;
  }

  try {
    const pages = await pdfToPng(request.file.buffer, {
      pagesToProcess: [1],
      viewportScale: 1,
      returnPageContent: true,
    });
    const firstPage = pages[0]?.content;
    if (!firstPage) {
      response.status(422).json({ error: "Unable to render the first PDF page." });
      return;
    }

    const advice = await askAssistant({
      mode: "design",
      message: "Review this first-page image of a certificate and give a brief visual opinion.",
      image: { data: firstPage.toString("base64"), mediaType: "image/png" },
    }, app.locals.assistantFetchFn ?? fetch);
    response.json({
      advice,
      disclaimer: "This is a visual opinion only. It is not a validity check. Use the verification result for validity.",
    });
  } catch (error) {
    if (error.code === "MISSING_ANTHROPIC_API_KEY") {
      response.status(503).json({ error: error.message });
      return;
    }

    response.status(502).json({ error: "Unable to review this PDF design." });
  }
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
    response.status(413).json({
      error: request.path === "/issue-batch"
        ? "CSV upload must not exceed 1 MB."
        : "PDF upload must not exceed 10 MB.",
    });
    return;
  }

  if (
    error instanceof multer.MulterError ||
    error.message === "Only PDF files are allowed." ||
    error.message === "Only CSV files are allowed."
  ) {
    response.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof Error && error.message === "The AI assistant request failed.") {
    response.status(502).json({ error: "The AI assistant is temporarily unavailable." });
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
