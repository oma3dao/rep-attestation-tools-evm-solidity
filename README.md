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
- ✅ **User- eview** – user-generated reviews with ratings
- ✅ **User Review Response** – subject response to user-generated reviews

All attestations are based on canonical JSON schema definitions (to be split into a separate repo later), and are compatible with onchain attestation services such as [BAS](https://bas.bnbchain.org/) and [EAS](https://eas.ethers.org/).

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

**Output:**
```
📋 Schema Details:
UID: 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2
Schema: string subject,string subjectDidHash,string version,string policyURI,uint256 issuedAt,uint256 effectiveAt,uint256 expiresAt
Resolver: 0x0000000000000000000000000000000000000000
Revocable: true
Index: 42
```

This shows you the field names and types that the schema expects, which is useful for creating attestations or understanding existing ones.

### Getting a Specific Attestation

To retrieve details of a specific attestation by its UID, use the `eas-get-attestation` task:

```bash
# Get attestation by UID
npx hardhat eas-get-attestation \
  --uid 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef \
  --network omachainTestnet
```

**Output:**
```
✅ Attestation Details:
UID: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Schema: 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2
Attester: 0x857b06519E91e3A54538791bDbb0E22373e36b66
Recipient: 0x209693Bc6afc0C5328bA36FaF03C514EF312287C
Time: 2025-01-15T10:30:00.000Z
Expiration: Never
Revocable: true
Revocation Time: Not revoked
Ref UID: 0x0000000000000000000000000000000000000000000000000000000000000000

Decoded Data:
  subject: did:web:example.com
  version: 1.0.0
  issuedAt: 1736936400
```

The task automatically decodes the attestation data based on the schema definition, making it human-readable.

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

**Output:**
```
DID: did:web:example.com
Index Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

Querying attestations from block 100 to 10100...

✅ Found 3 attestation(s):

─────────────────────────────────────────
UID: 0xabc...123
Schema: 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2
Attester: 0x857b06519E91e3A54538791bDbb0E22373e36b66
Time: 2025-01-15T10:30:00.000Z
Revoked: No

Decoded Data:
  subject: did:web:example.com
  version: 1.0.0
  issuedAt: 1736936400
─────────────────────────────────────────
```

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

**Output:**
```
Creating attestation with signer: 0x857b06519E91e3A54538791bDbb0E22373e36b66
EAS: 0x4200000000000000000000000000000000000021

Attestation Details:
Schema: 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2
Recipient: 0x209693Bc6afc0C5328bA36FaF03C514EF312287C
Data: 0x0000000000000000000000000000000000000000000000000000000000000060...
Expiration: 0
Revocable: true

Transaction hash: 0xdef...789
✅ Confirmed in block 12345

✅ Attestation UID: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

Use this UID to query or revoke the attestation.
```

**Tips:**
- Use `--types` and `--values` for easy encoding (the task handles type conversion)
- The types must match the schema definition exactly
- For complex data structures, you may need to pre-encode using `ethers.AbiCoder`
- Save the attestation UID for future reference

## Creating Schemas

Schemas in this repository are defined using [JSON Schema](https://json-schema.org/) (Draft 2020-12), which provides a standard way to describe the structure and validation rules for attestation data. For the complete JSON Schema specification, see the [official documentation](https://json-schema.org/specification).

All schema definitions are located in the `schemas-json/` directory. Each schema file follows the naming convention `[schema-name].schema.json` (e.g., `endorsement.schema.json`, `security-assessment.schema.json`).

### OMA3 Schema Extensions

In addition to standard JSON Schema properties, OMA3 schemas support custom extension properties (prefixed with `x-oma3-`) that control how schemas are processed and rendered in UIs:

#### `x-oma3-skip-reason`

Excludes a field from form generation. Common values:

- `"metadata"` - JSON-LD context fields (`@context`, `@type`)
- `"eas"` - Fields handled by the attestation service (e.g., `attester`)
- `"computed"` - Fields calculated from other data (e.g., `subjectDidHash`)
- `"default"` - Fields with auto-generated defaults that don't need user input

**Example:**
```json
{
  "attester": {
    "type": "string",
    "x-oma3-skip-reason": "eas"
  }
}
```

#### `x-oma3-subtype`

Specifies the semantic meaning of a field to control UI rendering and validation. Supported values:

- `"timestamp"` - Unix timestamp in seconds (for `integer` fields). Renders as a datetime picker in UIs.

**Example:**
```json
{
  "issuedAt": {
    "type": "integer",
    "title": "Issued Date",
    "x-oma3-subtype": "timestamp",
    "x-oma3-default": "current-timestamp"
  }
}
```

#### `x-oma3-default`

Specifies auto-generation behavior for field defaults. Supported values:

- `"current-timestamp"` - Auto-generates Unix timestamp in seconds (for `integer` fields with `x-oma3-subtype: "timestamp"`)
- `"current-datetime"` - Auto-generates ISO 8601 datetime string (for `string` fields with `format: "date-time"`)
- `"current-date"` - Auto-generates ISO 8601 date string (for `string` fields with `format: "date"`)

**Example:**
```json
{
  "issuedAt": {
    "type": "integer",
    "title": "Issued Date",
    "x-oma3-subtype": "timestamp",
    "x-oma3-default": "current-timestamp"
  }
}
```

#### `x-oma3-nested`

Controls rendering style for object fields (boolean):

- `true` - Renders with a container, border, and heading (grouped/nested style)
- `false` or omitted - Renders sub-fields flat at the same level as other fields

**Example:**
```json
{
  "payload": {
    "type": "object",
    "title": "Assessment Payload",
    "x-oma3-nested": true,
    "properties": {
      "assessmentKind": { "type": "string" }
    }
  }
}
```

#### `x-oma3-enum`

Provides suggested values for string fields without enforcing strict validation. This allows fields to accept any string value while giving UI tooling hints about recommended/registered values.

Use this instead of standard JSON Schema `enum` when you want:
- Flexibility to accept custom values without schema updates
- UI dropdowns showing suggested values
- Forward compatibility as new values emerge

**Example:**
```json
{
  "proofType": {
    "type": "string",
    "title": "Proof Type",
    "description": "A registered proof type defined in the OMA3 Proof Type Registry.",
    "maxLength": 64,
    "x-oma3-enum": [
      "x402-user",
      "x402-server",
      "onchain-tx"
    ]
  }
}
```

**When to use `x-oma3-enum` vs standard `enum`:**
- Use `x-oma3-enum` for extensible registries (proof types, verification methods, assessment kinds)
- Use standard `enum` for fixed, immutable values (hash algorithms like "keccak256" or "sha256")

### Schema Design Best Practices

1. **Use descriptive titles** - Field titles appear as labels in UIs, so make them clear and self-explanatory
2. **Provide descriptions** - Help users understand what data to enter
3. **Use consistent timestamp formats** - Prefer `integer` with Unix timestamps for consistency and EAS compatibility
4. **Mark required fields** - Include fields in the `required` array at the appropriate level
5. **Choose the right enum strategy**:
   - Use `x-oma3-enum` for extensible registries (allows custom values)
   - Use standard `enum` for fixed, immutable choices (enforces validation)
6. **Add maxLength constraints** - Protect against DDoS attacks with reasonable string length limits
7. **Leverage x-oma3 extensions** - Skip unnecessary fields, auto-generate defaults, and control UI layout

### Example Schema Structure

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://oma3.org/schemas/example-v1.0.0.schema.json",
  "title": "Example Schema",
  "description": "An example attestation schema",
  "type": "object",
  "required": ["subject", "issuedAt"],
  "properties": {
    "attester": {
      "type": "string",
      "x-oma3-skip-reason": "eas"
    },
    "subject": {
      "type": "string",
      "title": "Subject ID"
    },
    "issuedAt": {
      "type": "integer",
      "title": "Issued Date",
      "x-oma3-subtype": "timestamp",
      "x-oma3-default": "current-timestamp"
    },
    "expiresAt": {
      "type": "integer",
      "title": "Expiration Date",
      "x-oma3-subtype": "timestamp"
    },
    "payload": {
      "type": "object",
      "x-oma3-nested": true,
      "properties": {
        "rating": {
          "type": "integer",
          "title": "Rating",
          "minimum": 1,
          "maximum": 5
        }
      }
    }
  }
}
```

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
- **BAS schemas**: `[name].bastest.json` / `[name].bas.json` — for the BNB Attestation Service (used on BSC)

Future attestation frameworks (e.g., Solana) would follow the same pattern: `[name].solana.json`.

Chain-specific data (UID, block number, network) is stored in deployment files:

- `[name].deployed.eastest.json` — EAS testnet deployment info
- `[name].deployed.eas.json` — EAS mainnet deployment info
- `[name].deployed.bastest.json` — BAS testnet deployment info
- `[name].deployed.bas.json` — BAS mainnet deployment info

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
# Should show modified files like:
#   modified:   generated/Endorsement.deployed.eastest.json
#   modified:   generated/Certification.deployed.eastest.json
```

View the changes to see the new UID and block number:
```bash
git diff generated/Endorsement.deployed.eastest.json
# Should show changes like:
# -  "uid": "0xOLD_UID...",
# +  "uid": "0xNEW_UID...",
# -  "blockNumber": 123,
# +  "blockNumber": 153,
```

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

Check that the frontend schemas file was modified:

```bash
git status src/config/schemas.ts
# Should show:
#   modified:   src/config/schemas.ts
```

View the changes to confirm the new UIDs and block numbers:
```bash
git diff src/config/schemas.ts
# Should show changes like:
# -    66238: '0xOLD_UID...'  // OmaChain Testnet
# +    66238: '0xNEW_UID...'  // OmaChain Testnet
# -    66238: 123  // OmaChain Testnet
# +    66238: 153  // OmaChain Testnet
```

The modified entries should look like this:
```typescript
deployedUIDs: {
  97: '0xda787e2c5b89cd1b2c77d7a9565573cc89bac752e9b587f3348e85c62d606a68', // BSC Testnet
  56: '0x0000000000000000000000000000000000000000000000000000000000000000', // BSC Mainnet
  66238: '0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2'  // OmaChain Testnet
},
deployedBlocks: {
  97: 52288891, // BSC Testnet
  56: 0, // BSC Mainnet
  66238: 153  // OmaChain Testnet
}
```

**Important:** The schema UIDs and block numbers are stored per chain ID:
- `66238` = OMAchain Testnet
- `6623` = OMAchain Mainnet
- `97` = BSC Testnet
- `56` = BSC Mainnet

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

# Output shows:
# SCHEMA UID: 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2
# BLOCK NUMBER: 153

# 3. Verify deployment (optional)
npx hardhat verify-eas-schema \
  --uid 0xaa85b8d1e4d75ade301ba75d599a63612c9aa8374f94b5c09d434ddb654638b2 \
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
# Look for changes to the 66238 (OMAchain Testnet) entries
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

## Getting BNB Testnet Tokens

To deploy or test on BNB Smart Chain Testnet, you will need testnet BNB for gas fees. You can get free BNB testnet tokens from the official BNB Chain faucet:

- Go to [https://www.bnbchain.org/en/testnet-faucet](https://www.bnbchain.org/en/testnet-faucet)
- Enter your wallet address and request tokens (rate limits apply)
- Your wallet needs at least 0.002 BNB on BSC Mainnet to get test BNB

You can use these tokens to pay for transactions on the BSC Testnet.

## Working with BAS Schemas

This repository provides tools for generating and deploying schema definitions for the BNB Attestation Service (BAS).

### Schema File Naming Conventions

See [Generated Schema File Naming Conventions](#generated-schema-file-naming-conventions) above. BAS schemas follow the same pattern:

- **BAS schemas**: `[name].bas.json` — chain-independent schema definition
- **Deployment info**: `[name].deployed.bastest.json` / `[name].deployed.bas.json`

### Generating BAS Schema Objects

To generate a BAS-compatible schema object from a JSON Schema file, use the `generate-bas-object` task:

```bash
npx hardhat generate-bas-object --schema schemas-json/endorsement.schema.json --name Endorsement --network bscTestnet
```

The `--network` flag is required by Hardhat but does not affect the generated output.

**Available Options:**
- `--schema` (required): Path to the input JSON Schema file
- `--name` (optional): Override the schema name (defaults to the schema's title)
- `--revocable` (optional): Set schema revocability (true/false, default: false)
- `--network` (required): Any configured Hardhat network (required by Hardhat, does not affect output)

**Output:**
- `generated/[name].bas.json` — chain-independent schema definition

### Deploying BAS Schemas

To deploy a schema to the BAS registry on testnet or mainnet, use the `deploy-bas-schema` task:

```bash
# Deploy to testnet
npx hardhat deploy-bas-schema --file generated/Endorsement.bas.json --network bscTestnet

# Deploy to mainnet
npx hardhat deploy-bas-schema --file generated/Endorsement.bas.json --network bsc
```

**Available Options:**
- `--file` (required): Path to the .bas.json or .bastest.json file
- `--wait` (optional): Time to wait in seconds before verifying schema (default: 5)
- `--network` (required): Network to deploy to (bsc or bscTestnet)

**Output:**
- `generated/[name].deployed.bastest.json` (testnet)
- `generated/[name].deployed.bas.json` (mainnet)

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
