import express from "express";
import multer from "multer";
import { network } from "hardhat";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashBuffer } from "./hash.js";

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
  const certificate = await connection.ethers.getContractAt(
    "Certificate",
    contractAddress,
  );
  app.locals.certificate = certificate;

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
