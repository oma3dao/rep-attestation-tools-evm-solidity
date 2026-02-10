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

- ✅ **Security Assessment** – putting security audits onchain
- ✅ **Linked Identifier** – attesting to shared control of two IDs
- ✅ **Endorsement** – signaling reputational support
- ✅ **Certification** – verifying conformance via test labs or assessors
- ✅ **Key Binding** – binding a cryptographic key to a DID
- ✅ **Controller Witness** – immutable record that a controller assertion was observed at a point in time
- ✅ **User Review** – user-generated reviews with ratings
- ✅ **User Review Response** – subject response to user-generated reviews

All attestations are based on canonical JSON schema definitions (to be split into a separate repo later), and are compatible with onchain attestation services such as [EAS](https://eas.ethers.org/).

## Quick Start: Web Interface

**For most users**, the easiest way to create and read attestations is through the web interface:

👉 **[reputation.omatrust.org](https://reputation.omatrust.org)**

The web interface provides:
- ✅ User-friendly forms for creating attestations
- ✅ Browse and search existing attestations
- ✅ No command-line knowledge required
- ✅ Wallet integration for signing attestations

**The command-line tools in this repository are for:**
- Developers who need to automate attestation workflows
- Schema creators deploying new attestation types
- Advanced users who prefer CLI tools
- Integration with CI/CD pipelines

## Reading Attestations

Before creating schemas, you'll likely want to read and query existing attestations. This repository provides tools for retrieving attestation data from EAS.

### Getting a Schema Definition

To view the structure of a deployed schema, use the `eas-get-schema` task:

```bash
# Get schema details by UID
npx hardhat eas-get-schema \
  --uid 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2 \
  --network omachainTestnet
```

This outputs the schema's UID, field names/types, resolver address, and revocability — useful for creating attestations or understanding existing ones.

### Getting a Specific Attestation

To retrieve details of a specific attestation by its UID, use the `eas-get-attestation` task:

```bash
# Get attestation by UID
npx hardhat eas-get-attestation \
  --uid 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef \
  --network omachainTestnet
```

The task automatically decodes the attestation data based on the schema definition, showing UID, attester, recipient, timestamps, and decoded field values.

### Querying Attestations by DID

To find all attestations for a specific DID (subject), use the `--did` parameter:

```bash
# Query all attestations for a DID
npx hardhat eas-get-attestation \
  --did did:web:example.com \
  --network omachainTestnet

# Filter by schema UID
npx hardhat eas-get-attestation \
  --did did:web:example.com \
  --schema 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2 \
  --network omachainTestnet
```

Returns matching attestations with their UIDs, schema, attester, timestamp, and decoded data.

**Note:** The query searches the last 10,000 blocks by default. For older attestations, you may need to use a blockchain explorer or indexing service.

### Creating Attestations

To create a new attestation, use the `eas-attest` task:

```bash
# Create attestation with auto-encoding
npx hardhat eas-attest \
  --schema 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2 \
  --recipient 0x209693Bc6afc0C5328bA36FaF03C514EF312287C \
  --types "string,string,uint256" \
  --values "did:web:example.com,1.0.0,1736936400" \
  --network omachainTestnet

# Create attestation with pre-encoded data
npx hardhat eas-attest \
  --schema 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2 \
  --recipient 0x209693Bc6afc0C5328bA36FaF03C514EF312287C \
  --data 0x0000000000000000000000000000000000000000000000000000000000000060... \
  --network omachainTestnet
```

**Available Options:**
- `--schema` (required): Schema UID (bytes32)
- `--recipient` (required): Recipient address
- `--types` (optional): Comma-separated types for encoding (e.g., 'string,uint8')
- `--values` (optional): Comma-separated values for encoding (e.g., 'Alice,95')
- `--data` (optional): Pre-encoded attestation data (use instead of types/values)
- `--expiration` (optional): Expiration timestamp (default: 0 = no expiration)
- `--refuid` (optional): Referenced attestation UID (default: zero)
- `--revocable` (optional): Whether this attestation can be revoked (default: true)
- `--value` (optional): ETH value to send (default: 0)

On success, outputs the transaction hash, block confirmation, and the new attestation UID. Save the UID for future reference.

**Tips:**
- Use `--types` and `--values` for easy encoding (the task handles type conversion)
- The types must match the schema definition exactly
- For complex data structures, you may need to pre-encode using `ethers.AbiCoder`
- Save the attestation UID for future reference

## Creating Schemas

Schema definitions live in `schemas-json/`. For the full authoring guide — OMA3 extensions (`x-oma3-*`), best practices, and example structures — see [schemas-json/README.md](schemas-json/README.md).

## Working with EAS Schemas on OMAchain

This repository provides tools for generating and deploying schema definitions for the Ethereum Attestation Service (EAS) on OMAchain Testnet.

### Getting OMAchain Testnet Tokens

To deploy or test on OMAchain Testnet, you will need testnet tokens for gas fees. You can get free OMAchain testnet tokens from the official faucet:

- Go to [https://faucet.testnet.chain.oma3.org/](https://faucet.testnet.chain.oma3.org/)
- Enter your wallet address and request tokens
- Use these tokens to pay for transactions on OMAchain Testnet

### Generated Schema File Naming Conventions

Generated schema files use the attestation framework name as their suffix, not the target chain. This is because the schema string and revocable flag are derived from the JSON Schema definition and are the same regardless of which chain the schema is deployed to.

- **EAS schemas**: `[name].eas.json` — for the Ethereum Attestation Service (used on OMAchain, Base, Ethereum, Arbitrum, etc.)

Future attestation frameworks (e.g., Solana) would follow the same pattern: `[name].solana.json`.

Chain-specific data (UID, block number, network) is stored in deployment files:

- `[name].deployed.eastest.json` — EAS testnet deployment info
- `[name].deployed.eas.json` — EAS mainnet deployment info

### Generating EAS Schema Objects

To generate an EAS-compatible schema object from a JSON Schema file, use the `generate-eas-object` task:

```bash
npx hardhat generate-eas-object --schema schemas-json/endorsement.schema.json --network omachainTestnet
```

The `--network` flag is required by Hardhat but does not affect the generated output. The same `[name].eas.json` file is produced regardless of network.

**Available Options:**
- `--schema` (required): Path to the input JSON Schema file
- `--revocable` (optional): Override schema revocability (true/false). By default, auto-detected from schema.
- `--network` (required): Any configured Hardhat network (required by Hardhat, does not affect output)

**Revocability Auto-Detection:**
The `revocable` flag is automatically detected from the JSON schema. If the schema has a `revoked` field with `x-oma3-skip-reason: "eas"`, the generated EAS object will have `revocable: true`. This indicates that EAS should handle revocation natively for this schema type (e.g., Key Binding attestations that need to be revocable for key rotation).

**Output:**
- `generated/[name].eas.json` — chain-independent schema definition

### Deploying EAS Schemas

To deploy a schema to the EAS registry, use the `deploy-eas-schema` task:

```bash
# Deploy to OMAchain testnet (no resolver - server-side validation)
npx hardhat deploy-eas-schema --file generated/Endorsement.eas.json --network omachainTestnet

# Deploy to OMAchain mainnet (no resolver)
npx hardhat deploy-eas-schema --file generated/Endorsement.eas.json --network omachainMainnet

# Deploy to external chains WITH fee resolver (Base, Ethereum, Arbitrum, etc.)
npx hardhat deploy-eas-schema --file generated/Endorsement.eas.json --resolver 0xYourFeeResolverAddress --network base
```

See `app-registry-evm-solidity/contracts/eas/OMATrustFeeResolver.sol` for the resolver implementation and `app-registry-evm-solidity/tasks/deploy/fee-resolver.ts` for this resolver's deployment script.

**Available Options:**
- `--file` (required): Path to the .eas.json file
- `--resolver` (optional): Resolver contract address. Use for fee collection on external chains. Default: zero address.
- `--wait` (optional): Time to wait in seconds before verifying schema (default: 5)
- `--network` (required): Network to deploy to

**Resolver Usage:**
- **OMAChain**: Omit `--resolver` (uses zero address). Server-side validation handles spam prevention.
- **External chains**: Pass `--resolver` with the deployed `OMATrustFeeResolver` address to collect fees per attestation.

To deploy the fee resolver, see `app-registry-evm-solidity/contracts/eas/README.md`.

**Output:**
- `generated/[name].deployed.eastest.json` (testnet)
- `generated/[name].deployed.eas.json` (mainnet)

The output file contains the schema UID, block number, and network information, which can be used for creating and searching for attestations with this schema.

### After Deploying Schemas

Once you've deployed a schema, you **MUST** update the frontend with the new schema UID and block number:

#### Step 1: Verify Deployment Files Were Modified

Check that deployment files were updated in the `generated/` directory:
```bash
git status generated/
git diff generated/Endorsement.deployed.eastest.json
```

You should see the new UID and block number in the diff.

#### Step 2: Update Rep-Attestation Frontend Schemas

Run the schema update script in the rep-attestation-frontend repository to automatically sync the UIDs and block numbers to the frontend:

```bash
cd ../rep-attestation-frontend
npm run update-schemas ../rep-attestation-tools-evm-solidity
```

This script will:
1. Read all JSON schemas from `schemas-json/`
2. Read deployment info from `generated/*.deployed.eastest.json` files
3. Update `src/config/schemas.ts` with the correct UIDs and block numbers

#### Step 3: Verify Frontend Update

Verify the update with `git diff src/config/schemas.ts` — look for changes to the chain-specific UID and block number entries.

**Important:** The schema UIDs and block numbers are stored per chain ID:
- `66238` = OMAchain Testnet
- `6623` = OMAchain Mainnet

#### Step 4: Update App-Registry Frontend Schemas (if applicable)

If you're also using the app-registry-frontend to display attestations, you need to copy the updated schemas file:

```bash
cp ../rep-attestation-frontend/src/config/schemas.ts ../app-registry-frontend/src/config/schemas.ts
```

This ensures the app-registry-frontend can query and display attestations using the correct schema UIDs.

#### Complete Deployment Workflow Example

```bash
# 1. Generate EAS object from JSON schema
npx hardhat generate-eas-object \
  --schema schemas-json/endorsement.schema.json \
  --network omachainTestnet

# 2. Deploy the schema
npx hardhat deploy-eas-schema \
  --file generated/Endorsement.eas.json \
  --network omachainTestnet

# 3. Verify deployment (optional)
npx hardhat verify-eas-schema \
  --uid <SCHEMA_UID_FROM_STEP_2> \
  --network omachainTestnet

# 4. Update rep-attestation-frontend schemas (REQUIRED)
cd ../rep-attestation-frontend
npm run update-schemas ../rep-attestation-tools-evm-solidity

# 5. Update app-registry-frontend schemas (if applicable)
cd ../app-registry-frontend
npm run update-schemas ../rep-attestation-tools-evm-solidity

# 6. Verify the updates with git diff
cd ../rep-attestation-frontend
git diff src/config/schemas.ts
```

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
npx hardhat verify-eas-schema --network omachainTestnet --file generated/Endorsement.eas.json

# Verify using UID directly
npx hardhat verify-eas-schema --network omachainTestnet --uid 0xda787e2c5b89cd1b2c77d7a9565573cc89bac752e9b587f3348e85c62d606a68
```

**Available Options:**
- `--file` (optional): Path to the .eas.json or .deployed.eastest.json file
- `--uid` (optional): Schema UID to verify directly
- `--network` (required): Network to verify on (omachainTestnet or omachainMainnet)

**What it checks:**
- ✅ Schema exists on-chain
- ✅ Schema string matches local file
- ✅ Resolver address matches
- ✅ Revocable flag matches

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
