import "dotenv/config";
import { isAddress } from "ethers";
import { network } from "hardhat";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashFile } from "../src/hash.js";

export async function verifyCertificateFile(filePath, certificate) {
  const certificateHash = await hashFile(filePath);
  const [valid, revoked, issuer, issuedAt] =
    await certificate.verifyCertificate(certificateHash);

  return {
    status: revoked ? "REVOKED" : valid ? "VALID" : "NOT FOUND",
    issuer,
    issuedAt,
  };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/verify.js <pdf-path>");
  }

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress || !isAddress(contractAddress)) {
    throw new Error("Set CONTRACT_ADDRESS to a valid deployed Certificate address.");
  }

  const connection = await network.create(process.env.HARDHAT_NETWORK ?? "localhost");

  try {
    const certificate = await connection.ethers.getContractAt(
      "Certificate",
      contractAddress,
    );
    const result = await verifyCertificateFile(filePath, certificate);
    const issueDate =
      result.status === "NOT FOUND"
        ? "N/A"
        : new Date(Number(result.issuedAt) * 1000).toISOString();

    console.log(result.status);
    console.log(`Issuer: ${result.issuer}`);
    console.log(`Issue date: ${issueDate}`);
  } finally {
    await connection.close();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
