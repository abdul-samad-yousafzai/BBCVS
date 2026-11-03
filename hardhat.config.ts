import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";

const sepoliaUrl =
  process.env.SEPOLIA_RPC_URL?.trim() || "https://sepolia.infura.io/v3/placeholder";

// Use the key only when it has the exact format (0x + 64 hex characters).
// An invalid or empty key is ignored here, so compile and tests still run.
const rawKey = process.env.SEPOLIA_PRIVATE_KEY?.trim() ?? "";
const sepoliaKey = /^0x[0-9a-fA-F]{64}$/.test(rawKey) ? rawKey : undefined;

export default defineConfig({
  plugins: [hardhatEthers, hardhatNodeTestRunner],
  solidity: {
    version: "0.8.34",
  },
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainType: "l1",
    },
    sepolia: {
      type: "http",
      url: sepoliaUrl,
      accounts: sepoliaKey ? [sepoliaKey] : [],
      chainType: "l1",
    },
  },
});