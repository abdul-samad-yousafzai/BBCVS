import "dotenv/config";
import { isAddress } from "ethers";
import { network } from "hardhat";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashFile } from "../src/hash.js";

async function main() {
  const filePath = process.argv[2];
  if (!filePath || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/issue.js <pdf-path>");
  }

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress || !isAddress(contractAddress)) {
    throw new Error("Set CONTRACT_ADDRESS to a valid deployed Certificate address.");
  }

  const certificateHash = await hashFile(filePath);
  const connection = await network.create(process.env.HARDHAT_NETWORK ?? "localhost");

  try {
    const certificate = await connection.ethers.getContractAt(
      "Certificate",
      contractAddress,
    );
    const transaction = await certificate.issueCertificate(certificateHash);
    await transaction.wait();

    console.log(`Transaction hash: ${transaction.hash}`);
    console.log(`Certificate hash: ${certificateHash}`);
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
