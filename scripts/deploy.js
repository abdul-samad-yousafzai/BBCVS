import "dotenv/config";
import { network } from "hardhat";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export async function deployCertificate() {
  const connection = await network.create(process.env.HARDHAT_NETWORK ?? "localhost");
  try {
    const certificate = await connection.ethers.deployContract("Certificate");
    await certificate.waitForDeployment();
    return certificate.getAddress();
  } finally {
    await connection.close();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  console.log(`Certificate deployed at: ${await deployCertificate()}`);
}