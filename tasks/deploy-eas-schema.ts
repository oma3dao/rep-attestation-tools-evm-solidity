import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { EAS_SCHEMA_REGISTRY_ADDRESSES } from "../hardhat.config";
import { getProviderAndSigner } from "../utils/provider";
import { ZERO_ADDRESS } from "../utils/constants";
import { calculateSchemaUID, verifySchemaExists, formatSchemaUID } from "../utils/easTools";

interface EasSchemaObject {
  name: string;
  schema: string;
  revocable: boolean;
  resolver?: string; // Optional; resolver is typically passed via CLI at deploy time
}

task("deploy-eas-schema", "Deploy an EAS schema from a .eas.json file")
  .addParam("file", "Path to the .eas.json file (e.g. generated/Endorsement.eas.json or generated/Endorsement.eastest.json)")
  .addOptionalParam("resolver", "Resolver contract address (overrides JSON file)")
  .addOptionalParam("wait", "Time to wait in seconds before verifying schema (default: 5)", "5")
  .setAction(async (taskArgs, hre) => {
    const { file, resolver: resolverOverride, wait: waitTimeArg } = taskArgs;
    const waitTime = parseInt(waitTimeArg, 10) || 5; // Default to 5 seconds if parsing fails
    
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found at ${filePath}`);
      process.exit(1);
    }
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const easSchema: EasSchemaObject = JSON.parse(fileContent);

    // Determine network and contract address
    let schemaRegistryAddress: string | undefined;
    let networkSuffix: string;
    
    if (hre.network.name === "omachainTestnet") {
      schemaRegistryAddress = EAS_SCHEMA_REGISTRY_ADDRESSES.omachainTestnet;
      networkSuffix = "eastest";
    } else if (hre.network.name === "omachainMainnet") {
      schemaRegistryAddress = EAS_SCHEMA_REGISTRY_ADDRESSES.omachainMainnet;
      networkSuffix = "eas";
    } else {
      console.error(`Unsupported network: ${hre.network.name}. Use 'omachainTestnet' or 'omachainMainnet'.`);
      process.exit(1);
    }

    // Use the utility to get provider and signer
    const { signer } = await getProviderAndSigner(hre);

    // Connect to SchemaRegistry
    const schemaRegistry = new SchemaRegistry(schemaRegistryAddress);
    schemaRegistry.connect(signer);

    // Calculate the expected schema UID
    // CLI flag takes precedence over JSON file for resolver address
    const resolverAddress = resolverOverride || (easSchema.resolver && easSchema.resolver !== "" ? easSchema.resolver : ZERO_ADDRESS);
    if (resolverOverride) {
      console.log(`Using resolver from CLI flag: ${resolverOverride}`);
    }
    let expectedSchemaUID = calculateSchemaUID(
      easSchema.schema, 
      resolverAddress,
      easSchema.revocable
    );
    console.log(`Estimated Schema UID: ${formatSchemaUID(expectedSchemaUID)}`);
    
    try {
      // Check if schema already exists before attempting deployment
      const schemaExists = await verifySchemaExists(schemaRegistry, expectedSchemaUID);
      if (schemaExists) {
        console.log(`\nSchema already exists on ${hre.network.name}!`);
        console.log(`Schema UID: ${formatSchemaUID(expectedSchemaUID)}`);
        console.log(`No changes made to deployment file.`);
        return formatSchemaUID(expectedSchemaUID);
      }
      
      // If schema doesn't exist, deploy it
      console.log(`Deploying schema "${easSchema.name}" to ${hre.network.name} (${schemaRegistryAddress})...`);
      const tx = await schemaRegistry.register({
        schema: easSchema.schema,
        resolverAddress: resolverAddress,
        revocable: easSchema.revocable,
      });
      
      console.log("Transaction sent. Waiting for confirmation...");
      
      let txHash: string = '';
      let receipt: any;
      let confirmedSchemaUID: string | null = null;
      
      try {
        // EAS SDK v2.x: register() returns a Transaction<T> that hasn't been sent yet.
        // wait() sends the tx, waits for confirmation, and returns the schema UID.
        const waitResult = await (tx as any).wait();
        receipt = (tx as any).receipt;
        
        // v2.x wait() returns the schema UID string
        if (typeof waitResult === 'string') {
          confirmedSchemaUID = waitResult;
        }
        
        // Extract tx hash from the receipt (available after wait())
        if (receipt?.hash) {
          txHash = receipt.hash;
        } else if (receipt?.transactionHash) {
          txHash = receipt.transactionHash;
        }
        
        console.log(`Transaction hash: ${txHash || 'unknown'}`);
        console.log(`Transaction confirmed in block ${receipt?.blockNumber || 'unknown'}`);
      } catch (error) {
        console.log("Error during transaction:", error);
      }
      
      // Verify the schema was indexed
      const verificationUID = confirmedSchemaUID || expectedSchemaUID;
      console.log(`Waiting ${waitTime} seconds for schema to be indexed...`);
      
      // Wait for the indexing time
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      
      // Verify if the schema exists
      let schemaVerified = await verifySchemaExists(schemaRegistry, verificationUID);
      
      // If not found, try a couple more times
      if (!schemaVerified) {
        console.log("Schema not found on first check, retrying...");
        
        // Try twice more with a short delay
        for (let i = 0; i < 2; i++) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          schemaVerified = await verifySchemaExists(schemaRegistry, verificationUID);
          if (schemaVerified) break;
        }
      }
      
      if (schemaVerified) {
        // Use the verification UID - preferring the one returned by the contract
        const finalUID = verificationUID;
        
        // Create a visually distinct output for the UID
        console.log("\n==================================================");
        console.log(`SCHEMA UID: ${formatSchemaUID(finalUID)}`);
        console.log(`BLOCK NUMBER: ${receipt?.blockNumber || 'unknown'}`);
        console.log("==================================================\n");
        
        // Write schema details to a JSON file for easy reference
        const detailsFilePath = path.join(path.dirname(filePath), `${easSchema.name}.deployed.${networkSuffix}.json`);
        const outputData = {
          uid: formatSchemaUID(finalUID),
          blockNumber: receipt?.blockNumber || 'unknown',
          network: hre.network.name
        };
        fs.writeFileSync(detailsFilePath, JSON.stringify(outputData, null, 2));
        
        // Show relative path instead of full path
        const relativePath = path.relative(process.cwd(), detailsFilePath);
        console.log(`Schema details have been saved to: ${relativePath}`);
        
        return formatSchemaUID(finalUID);
      } else {
        console.error("Schema deployment may have failed. The schema UID couldn't be found in the registry.");
        console.error("Please check the transaction manually or try again.");
        console.error(`Transaction hash: ${txHash || "unknown"}`);
        console.error(`Calculated Schema UID to verify: ${formatSchemaUID(verificationUID)}`);
        
        if (receipt && receipt.status === 0) {
          console.error("Transaction failed with status 0. This indicates the transaction was reverted.");
        } else if (receipt && receipt.status === 1) {
          console.error("Transaction succeeded with status 1, but schema not found. This might be a delay in indexing.");
          console.error("Try running the same command with a longer wait time: --wait 60");
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error("Error deploying schema:", error);
      process.exit(1);
    }
  });
