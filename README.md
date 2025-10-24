# rep-attestation-tools-evm-solidity

EVM/Solidity tools for deploying and managing reputation schemas on attestation services.

## License and Participation

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

**Licensing Notice**  
This initial version (v1) is released under MIT to maximize transparency and adoption.  

OMA3 may license future versions of this reference implementation under different terms (for example, the Business Source License, BSL) if forks or incompatible implementations threaten to fragment the ecosystem or undermine the sustainability of OMA3.  

OMA3 standards (such as specifications and schemas) will always remain open and are governed by [OMA3’s IPR Policy](https://www.oma3.org/intellectual-property-rights-policy).

## Purpose

**Solidity smart contracts and utilities for building the reputation layer of the open metaverse.**

This repository contains EVM-compatible smart contracts and developer tools for verifying, validating, and interacting with **structured attestations** used in the OMA3 reputation system. These attestations power use cases like:

- ✅ **Approval** – granting permissions or eligibility
- ✅ **Endorsement** – signaling reputational support
- ✅ **Certification** – verifying conformance via test labs or assessors
- ✅ **UserReview** – user-generated reviews with ratings

All attestations are based on canonical JSON schema definitions (to be split into a separate repo later), and are compatible with onchain attestation services such as [BAS](https://bas.bnbchain.org/) and [EAS](https://eas.ethers.org/).

## Working with EAS Schemas on OMAchain

This repository provides tools for generating and deploying schema definitions for the Ethereum Attestation Service (EAS) on OMAchain Testnet.

### Getting OMAchain Testnet Tokens

To deploy or test on OMAchain Testnet, you will need testnet tokens for gas fees. You can get free OMAchain testnet tokens from the official faucet:

- Go to [https://faucet.testnet.chain.oma3.org/](https://faucet.testnet.chain.oma3.org/)
- Enter your wallet address and request tokens
- Use these tokens to pay for transactions on OMAchain Testnet

### Schema File Naming Conventions

We use specific file extensions to distinguish between testnet and mainnet files:

- Testnet schema files: `[name].eastest.json`
- Mainnet schema files: `[name].eas.json`
- Testnet deployment info: `[name].deployed.eastest.json`
- Mainnet deployment info: `[name].deployed.eas.json`

This naming convention helps prevent accidental deployments to the wrong network.

### Generating EAS Schema Objects

To generate an EAS-compatible schema object from a JSON Schema file, use the `generate-eas-object` task:

```bash
# For testnet (default)
npx hardhat generate-eas-object --schema schemas-json/endorsement.schema.json --network omachainTestnet

# For mainnet (when available)
npx hardhat generate-eas-object --schema schemas-json/endorsement.schema.json --network omachainMainnet
```

**Available Options:**
- `--schema` (required): Path to the input JSON Schema file
- `--revocable` (optional): Set schema revocability (true/false, default: false)
- `--resolver` (optional): Resolver address for the EAS schema (default: zero address)
- `--network` (required): Target network (omachainTestnet or omachainMainnet)

**Output:**
- Testnet: `generated/[name].eastest.json`
- Mainnet: `generated/[name].eas.json`

### Deploying EAS Schemas

To deploy a schema to the EAS registry on OMAchain testnet or mainnet, use the `deploy-eas-schema` task:

```bash
# Deploy to testnet
npx hardhat deploy-eas-schema --file generated/Endorsement.eastest.json --network omachainTestnet

# Deploy to mainnet (when available)
npx hardhat deploy-eas-schema --file generated/Endorsement.eas.json --network omachainMainnet
```

**Available Options:**
- `--file` (required): Path to the .eas.json or .eastest.json file
- `--wait` (optional): Time to wait in seconds before verifying schema (default: 5)
- `--network` (required): Network to deploy to (omachainMainnet or omachainTestnet)

**Output:**
- Testnet: `generated/[name].deployed.eastest.json`
- Mainnet: `generated/[name].deployed.eas.json`

The output file contains the schema UID, block number, and network information, which can be used for creating and searching for attestations with this schema.

### Deployment Results

The deployment process produces a JSON file containing important information:

```json
{
  "uid": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "blockNumber": "12345678",
  "network": "omachainTestnet"
}
```

This information is essential for:
- Creating attestations using the schema's UID
- Querying for attestations with this schema (block number is useful for filtering)
- Verifying which network the schema was deployed to

### Verifying EAS Schema Deployments

After deploying a schema, you can verify it exists on-chain and matches your local definition using the `verify-eas-schema` task:

```bash
# Verify using deployed schema file
npx hardhat verify-eas-schema --network omachainTestnet --file generated/Endorsement.deployed.eastest.json

# Verify using schema object file
npx hardhat verify-eas-schema --network omachainTestnet --file generated/Endorsement.eastest.json

# Verify using UID directly
npx hardhat verify-eas-schema --network omachainTestnet --uid 0xda787e2c5b89cd1b2c77d7a9565573cc89bac752e9b587f3348e85c62d606a68
```

**Available Options:**
- `--file` (optional): Path to the .eastest.json or .deployed.eastest.json file
- `--uid` (optional): Schema UID to verify directly
- `--network` (required): Network to verify on (omachainTestnet or omachainMainnet)

**What it checks:**
- ✅ Schema exists on-chain
- ✅ Schema string matches local file
- ✅ Resolver address matches
- ✅ Revocable flag matches

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
