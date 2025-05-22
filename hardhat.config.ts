import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "./tasks"; // Import all tasks from the index file
import * as fs from "fs";
import * as path from "path";
import { config as dotenvConfig } from "dotenv";

// BAS Schema Registry contract addresses (from official docs)
export const BAS_SCHEMA_REGISTRY_ADDRESSES = {
  bscMainnet: "0x5e905F77f59491F03eBB78c204986aaDEB0C6bDa",
  bscTestnet: "0x08C8b8417313fF130526862f90cd822B55002D72" // SchemaRegistry on BSC Testnet
};

// Load deployment key from SSH directory
const deploymentKeyPath = path.join(process.env.HOME || '', '.ssh', 'test-evm-deployment-key');
if (fs.existsSync(deploymentKeyPath)) {
  dotenvConfig({ path: deploymentKeyPath });
}

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
