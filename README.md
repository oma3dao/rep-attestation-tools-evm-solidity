# rep-attestation-tools-evm-solidity

EVM/Solidity tools for deploying and managing reputation schemas on attestation services.

## License and Participation

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

## Purpose

**Solidity smart contracts and utilities for building the reputation layer of the open metaverse.**

This repository contains EVM-compatible smart contracts and developer tools for verifying, validating, and interacting with **structured attestations** used in the OMA3 reputation system. These attestations power use cases like:

- ✅ **Approval** – granting permissions or eligibility
- ✅ **Endorsement** – signaling reputational support
- ✅ **Certification** – verifying conformance via test labs or assessors
- ✅ **UserReview** – user-generated reviews with ratings

All attestations are based on canonical JSON schema definitions (to be split into a separate repo later), and are compatible with onchain attestation services such as [BAS](https://bas.bnbchain.org/) and [EAS](https://eas.ethers.org/).

## Getting BNB Testnet Tokens

To deploy or test on BNB Smart Chain Testnet, you will need testnet BNB for gas fees. You can get free BNB testnet tokens from the official BNB Chain faucet:

- Go to [https://www.bnbchain.org/en/testnet-faucet](https://www.bnbchain.org/en/testnet-faucet)
- Enter your wallet address and request tokens (rate limits apply)
- Your wallet needs at least 0.002 BNB on BSC Mainnet to get test BNB

You can use these tokens to pay for transactions on the BSC Testnet.

## Working with BAS Schemas

This repository provides tools for generating and deploying schema definitions for the BNB Attestation Service (BAS).

### Schema File Naming Conventions

We use specific file extensions to distinguish between testnet and mainnet files:

- Testnet schema files: `[name].bastest.json`
- Mainnet schema files: `[name].bas.json`
- Testnet deployment info: `[name].deployed.bastest.json`
- Mainnet deployment info: `[name].deployed.bas.json`

This naming convention helps prevent accidental deployments to the wrong network.

### Generating BAS Schema Objects

To generate a BAS-compatible schema object from a JSON Schema file, use the `generate-bas-object` task:

```bash
# For testnet (default)
npx hardhat generate-bas-object --schema schemas-json/endorsement.schema.json --name Endorsement

# For mainnet
npx hardhat generate-bas-object --schema schemas-json/endorsement.schema.json --name Endorsement --network bsc
```

**Available Options:**
- `--schema` (required): Path to the input JSON Schema file
- `--name` (optional): Override the schema name (defaults to the schema's title)
- `--revocable` (optional): Set schema revocability (true/false, default: false)
- `--resolver` (optional): Resolver address for the BAS schema (default: zero address)
- `--network` (optional): Target network (defaults to testnet if not specified)

**Output:**
- Testnet: `generated/[name].bastest.json`
- Mainnet: `generated/[name].bas.json`

### Deploying BAS Schemas

To deploy a schema to the BAS registry on testnet or mainnet, use the `deploy-bas-schema` task:

```bash
# Deploy to testnet
npx hardhat deploy-bas-schema --file generated/Endorsement.bastest.json --network bscTestnet

# Deploy to mainnet
npx hardhat deploy-bas-schema --file generated/Endorsement.bas.json --network bsc
```

**Available Options:**
- `--file` (required): Path to the .bas.json or .bastest.json file
- `--wait` (optional): Time to wait in seconds before verifying schema (default: 5)
- `--network` (required): Network to deploy to (bsc or bscTestnet)

**Output:**
- Testnet: `generated/[name].deployed.bastest.json`
- Mainnet: `generated/[name].deployed.bas.json`

The output file contains the schema UID, block number, and network information, which can be used for creating and searching for attestations with this schema.

### Deployment Results

The deployment process produces a JSON file containing important information:

```json
{
  "uid": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "blockNumber": "12345678",
  "network": "bscTestnet"
}
```

This information is essential for:
- Creating attestations using the schema's UID
- Querying for attestations with this schema (block number is useful for filtering)
- Verifying which network the schema was deployed to

## Running Tests

To run the test suite:

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/specific-test-file.ts

# Run tests with gas reporting
npx hardhat test --report-gas
```

Tests are located in the `test` directory and use the Hardhat testing framework.
