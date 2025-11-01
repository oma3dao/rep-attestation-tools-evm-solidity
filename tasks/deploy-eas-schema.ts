import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { EAS_SCHEMA_REGISTRY_ADDRESSES } from "../hardhat.config";
import { getProviderAndSigner } from "../utils/provider";
import { ZERO_ADDRESS } from "../utils/constants";
import { calculateSchemaUID, verifySchemaExists, formatSchemaUID, getSchemaDetails } from "../utils/easTools";

interface EasSchemaObject {
  name: string;
  schema: string;
  revocable: boolean;
  resolver: string;
}

function getTxHash(tx: any): string {
  if (typeof tx === "string") return tx;
  if (tx && typeof tx.hash === "string") return tx.hash;
  if (tx && typeof tx.transactionHash === "string") return tx.transactionHash;
  
  // Additional checks for common transaction patterns
  if (tx && tx.tx && typeof tx.tx === "string") return tx.tx;
  if (tx && tx.id && typeof tx.id === "string") return tx.id;
  
  throw new Error("Could not extract transaction hash from tx object");
}

task("deploy-eas-schema", "Deploy an EAS schema from a .eas.json file")
  .addParam("file", "Path to the .eas.json file (e.g. generated/Endorsement.eas.json or generated/Endorsement.eastest.json)")
  .addOptionalParam("wait", "Time to wait in seconds before verifying schema (default: 5)", "5")
  .setAction(async (taskArgs, hre) => {
    const { file, wait: waitTimeArg } = taskArgs;
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
    const { signer, provider } = await getProviderAndSigner(hre);

    // Connect to SchemaRegistry
    const schemaRegistry = new SchemaRegistry(schemaRegistryAddress);
    schemaRegistry.connect(signer);

    // Calculate the expected schema UID
    const resolverAddress = easSchema.resolver && easSchema.resolver !== "" ? easSchema.resolver : ZERO_ADDRESS;
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
      
      // Handle transaction differently based on its type
      let txHash: string = '';
      let receipt: any;
      let confirmedSchemaUID: string | null = null;
      
      try {
        // Extract transaction hash from EAS transaction response
        if (typeof tx === 'object' && tx !== null && (tx as any).tx && (tx as any).tx.hash) {
          txHash = (tx as any).tx.hash;
        } else {
          txHash = getTxHash(tx);
        }
        console.log(`Transaction hash: ${txHash}`);
        
        // Wait for transaction confirmation
        try {
          receipt = await (tx as any).tx.wait();
          console.log(`Transaction confirmed in block ${receipt?.blockNumber || 'unknown'}`);
        } catch (error) {
          receipt = await provider.getTransactionReceipt(txHash);
          if (receipt) {
            console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
          }
        }
        
        // Extract schema UID from receipt logs
        if (receipt && receipt.logs && receipt.logs.length > 0 && receipt.logs[0].topics && receipt.logs[0].topics.length > 1) {
          // The schema UID is in the second topic (index 1)
          const schemaUID = receipt.logs[0].topics[1];
          
          // Use this UID directly from the contract
          expectedSchemaUID = schemaUID;
          confirmedSchemaUID = schemaUID;
        } else {
          console.log("\nCould not find Schema UID in transaction logs");
        }
      } catch (error) {
        console.log("Error handling transaction:", error);
      }
      
      // Wait for the blockchain to index the new schema and verify
      const verificationUID = confirmedSchemaUID || expectedSchemaUID;
      
      // Note if we're using the actual UID from transaction logs or our estimate
      if (confirmedSchemaUID) {
        console.log(`\nUsing schema UID extracted from transaction: ${formatSchemaUID(verificationUID)}`);
      } else {
        console.log(`\nUsing estimated schema UID: ${formatSchemaUID(verificationUID)}`);
      }
      
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
