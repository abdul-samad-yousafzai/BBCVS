import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";

const sepoliaUrl =
  process.env.SEPOLIA_RPC_URL ?? "https://sepolia.infura.io/v3/placeholder";
const sepoliaKey = process.env.SEPOLIA_PRIVATE_KEY;

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