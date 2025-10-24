import { task } from "hardhat/config";
import { NETWORK_CONTRACTS } from "../hardhat.config";
import { didToIndexAddress } from "../utils/did-utils";
import * as fs from "fs";
import * as path from "path";

// Helper to decode attestation data based on schema
async function decodeAttestationData(hre: any, schemaRegistry: any, schemaUID: string, data: string): Promise<any> {
  try {
    // Get schema definition
    const schema = await schemaRegistry.getSchema(schemaUID);
    const schemaString = schema.schema;
    
    if (!schemaString || schemaString === "") {
      return { error: "Empty schema" };
    }

    // Parse schema string (e.g., "string subject,string purpose,uint256 timestamp")
    const fields = schemaString.split(',').map((f: string) => f.trim());
    const types: string[] = [];
    const names: string[] = [];
    
    for (const field of fields) {
      const parts = field.trim().split(/\s+/);
      if (parts.length >= 2) {
        types.push(parts[0]);
        names.push(parts.slice(1).join(' '));
      }
    }

    // Decode the data
    const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(types, data);
    
    // Create object with field names
    const result: any = {};
    for (let i = 0; i < names.length; i++) {
      result[names[i]] = decoded[i];
    }
    
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

task("eas-get-attestation", "Get attestation details by UID or query by DID")
  .addOptionalParam("uid", "Attestation UID (bytes32)")
  .addOptionalParam("did", "DID to query attestations for (will convert to index address)")
  .addOptionalParam("schema", "Schema UID to filter by (when using --did)")
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name as keyof typeof NETWORK_CONTRACTS;
    const easAddress = NETWORK_CONTRACTS[networkName]?.easContract;

    if (!easAddress || easAddress === "0x") {
      throw new Error(`EAS contract not configured for network ${networkName}`);
    }

    console.log(`EAS: ${easAddress}`);

    // Load EAS ABI
    const abiPath = path.join(__dirname, "../abis/EAS.json");
    const easAbi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const eas = await hre.ethers.getContractAt(easAbi, easAddress);

    // Mode 1: Get specific attestation by UID
    if (taskArgs.uid) {
      const attestation = await eas.getAttestation(taskArgs.uid);

      // Load SchemaRegistry for decoding
      const schemaRegistryAddress = NETWORK_CONTRACTS[networkName]?.easSchemaRegistry;
      const schemaRegistryAbiPath = path.join(__dirname, "../abis/SchemaRegistry.json");
      const schemaRegistryAbi = JSON.parse(fs.readFileSync(schemaRegistryAbiPath, "utf-8"));
      const schemaRegistry = await hre.ethers.getContractAt(schemaRegistryAbi, schemaRegistryAddress);

      // Decode attestation data
      const decodedData = await decodeAttestationData(hre, schemaRegistry, attestation.schema, attestation.data);

      console.log(`\n✅ Attestation Details:`);
      console.log(`UID: ${attestation.uid}`);
      console.log(`Schema: ${attestation.schema}`);
      console.log(`Attester: ${attestation.attester}`);
      console.log(`Recipient: ${attestation.recipient}`);
      console.log(`Time: ${new Date(Number(attestation.time) * 1000).toISOString()}`);
      console.log(`Expiration: ${attestation.expirationTime === 0n ? "Never" : new Date(Number(attestation.expirationTime) * 1000).toISOString()}`);
      console.log(`Revocable: ${attestation.revocable}`);
      console.log(`Revocation Time: ${attestation.revocationTime === 0n ? "Not revoked" : new Date(Number(attestation.revocationTime) * 1000).toISOString()}`);
      console.log(`Ref UID: ${attestation.refUID}`);
      console.log(`\nDecoded Data:`);
      if (decodedData.error) {
        console.log(`  Error: ${decodedData.error}`);
        console.log(`  Raw: ${attestation.data}`);
      } else {
        for (const [key, value] of Object.entries(decodedData)) {
          console.log(`  ${key}: ${value}`);
        }
      }
      return;
    }

    // Mode 2: Query attestations by DID
    if (taskArgs.did) {
      const indexAddress = didToIndexAddress(taskArgs.did);
      console.log(`\nDID: ${taskArgs.did}`);
      console.log(`Index Address: ${indexAddress}`);

      // Load SchemaRegistry for decoding
      const schemaRegistryAddress = NETWORK_CONTRACTS[networkName]?.easSchemaRegistry;
      const schemaRegistryAbiPath = path.join(__dirname, "../abis/SchemaRegistry.json");
      const schemaRegistryAbi = JSON.parse(fs.readFileSync(schemaRegistryAbiPath, "utf-8"));
      const schemaRegistry = await hre.ethers.getContractAt(schemaRegistryAbi, schemaRegistryAddress);

      // Query Attested events for this recipient
      const filter = eas.filters.Attested(
        undefined, // recipient (we'll filter manually)
        undefined, // attester
        taskArgs.schema || undefined, // schema UID (optional filter)
        undefined  // uid
      );

      const currentBlock = await hre.ethers.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks

      console.log(`\nQuerying attestations from block ${fromBlock} to ${currentBlock}...`);

      const events = await eas.queryFilter(filter, fromBlock, currentBlock);

      // Filter by recipient address
      const matchingEvents = events.filter((event: any) => {
        return event.args.recipient.toLowerCase() === indexAddress.toLowerCase();
      });

      if (matchingEvents.length === 0) {
        console.log(`\n❌ No attestations found for DID: ${taskArgs.did}`);
        return;
      }

      console.log(`\n✅ Found ${matchingEvents.length} attestation(s):\n`);

      for (const event of matchingEvents) {
        // Type guard to ensure we have an EventLog with args
        if (!('args' in event)) continue;
        const attestation = await eas.getAttestation(event.args.uid);
        
        // Decode attestation data
        const decodedData = await decodeAttestationData(hre, schemaRegistry, attestation.schema, attestation.data);
        
        console.log(`─────────────────────────────────────────`);
        console.log(`UID: ${attestation.uid}`);
        console.log(`Schema: ${attestation.schema}`);
        console.log(`Attester: ${attestation.attester}`);
        console.log(`Time: ${new Date(Number(attestation.time) * 1000).toISOString()}`);
        console.log(`Revoked: ${attestation.revocationTime !== 0n ? "Yes" : "No"}`);
        console.log(`\nDecoded Data:`);
        if (decodedData.error) {
          console.log(`  Error: ${decodedData.error}`);
          console.log(`  Raw: ${attestation.data.slice(0, 66)}...`);
        } else {
          for (const [key, value] of Object.entries(decodedData)) {
            console.log(`  ${key}: ${value}`);
          }
        }
      }
      console.log(`─────────────────────────────────────────\n`);
      return;
    }

    throw new Error("Must provide either --uid or --did parameter");
  });
