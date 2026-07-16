import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "./tasks"; // Import all tasks from the index file
import * as fs from "fs";
import * as path from "path";

// EAS Schema Registry contract addresses
export const EAS_SCHEMA_REGISTRY_ADDRESSES = {
  omachainTestnet: "0x7946127D2f517c8584FdBF801b82F54436EC6FC7",
  omachainMainnet: "0x11A3aFa959475397F38b729dA543bdDca7bc7cE1"
};

// EAS Core contract addresses (for creating attestations)
export const EAS_CONTRACT_ADDRESSES = {
  omachainTestnet: "0x8835AF90f1537777F52E482C8630cE4e947eCa32",
  omachainMainnet: "0x00Bd6f0Ee99bD76273B57e6dDEc5B00850c6b76C"
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

// Load deployment key from SSH directory.
// Resolution: DEPLOYMENT_KEY_PATH env var > network-specific default.
//   --network omachainMainnet → ~/.ssh/mainnet-evm-deployment-key
//   all others               → ~/.ssh/test-evm-deployment-key
function loadDeploymentKey(): string | undefined {
  const networkIdx = process.argv.indexOf('--network');
  const networkName = networkIdx !== -1 ? process.argv[networkIdx + 1] : '';
  const isMainnet = networkName === 'omachainMainnet';

  const keyPath = process.env.DEPLOYMENT_KEY_PATH ||
    path.join(process.env.HOME || '', '.ssh', isMainnet ? 'mainnet-evm-deployment-key' : 'test-evm-deployment-key');

  if (!fs.existsSync(keyPath)) {
    return undefined;
  }

  const raw = fs.readFileSync(keyPath, 'utf8').trim();
  const match = raw.match(/^\s*PRIVATE_KEY\s*=\s*(.+)\s*$/);
  let key = match ? match[1].trim() : raw;
  key = key.replace(/^0x/i, '');

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    console.error(`\n❌ Invalid key format in ${keyPath}. Expected 64 hex chars.`);
    process.exit(1);
  }

  if (networkName) {
    console.log(`Deployment key: ${keyPath}`);
  }
  return `0x${key}`;
}

const privateKey = loadDeploymentKey();
if (privateKey) {
  process.env.PRIVATE_KEY = privateKey;
}

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    omachainTestnet: {
      url: process.env.OMACHAIN_TESTNET_RPC || "https://rpc.testnet.omachain.org/",
      chainId: 66238,
      accounts: privateKey ? [privateKey] : [],
    },
    omachainMainnet: {
      url: process.env.OMACHAIN_MAINNET_RPC || "https://rpc.omachain.org/",
      chainId: 6623,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
