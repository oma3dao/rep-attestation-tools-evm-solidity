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

// EAS Schema Registry contract addresses
export const EAS_SCHEMA_REGISTRY_ADDRESSES = {
  omachainTestnet: "0x7946127D2f517c8584FdBF801b82F54436EC6FC7",
  omachainMainnet: "0x0000000000000000000000000000000000000000" // TODO: Update when mainnet is available
};

// EAS Core contract addresses (for creating attestations)
export const EAS_CONTRACT_ADDRESSES = {
  omachainTestnet: "0x8835AF90f1537777F52E482C8630cE4e947eCa32",
  omachainMainnet: "0x0000000000000000000000000000000000000000" // TODO: Update when mainnet is available
};

// Network contracts configuration (for EAS tasks)
export const NETWORK_CONTRACTS = {
  omachainTestnet: {
    easContract: EAS_CONTRACT_ADDRESSES.omachainTestnet,
    easSchemaRegistry: EAS_SCHEMA_REGISTRY_ADDRESSES.omachainTestnet
  },
  omachainMainnet: {
    easContract: EAS_CONTRACT_ADDRESSES.omachainMainnet,
    easSchemaRegistry: EAS_SCHEMA_REGISTRY_ADDRESSES.omachainMainnet
  }
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
    omachainTestnet: {
      url: process.env.OMACHAIN_TESTNET_RPC_URL || "https://rpc.testnet.chain.oma3.org/",
      chainId: 66238,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    omachainMainnet: {
      url: process.env.OMACHAIN_MAINNET_RPC_URL || "https://rpc.chain.oma3.org/", // TODO: Update when mainnet is available
      chainId: 6623,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
