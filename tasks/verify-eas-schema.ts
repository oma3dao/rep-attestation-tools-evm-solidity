import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { EAS_SCHEMA_REGISTRY_ADDRESSES } from "../hardhat.config";
import { getProviderAndSigner } from "../utils/provider";
import { calculateSchemaUID, verifySchemaExists, formatSchemaUID, getSchemaDetails } from "../utils/easTools";
import { ZERO_ADDRESS } from "../utils/constants";

interface EasSchemaObject {
    name: string;
    schema: string;
    revocable: boolean;
    resolver: string;
}

interface DeployedSchemaInfo {
    uid: string;
    blockNumber: string | number;
    network: string;
}

task("verify-eas-schema", "Verify an EAS schema deployment on-chain")
    .addOptionalParam("file", "Path to the .eastest.json or .deployed.eastest.json file")
    .addOptionalParam("uid", "Schema UID to verify directly")
    .setAction(async (taskArgs, hre) => {
        const { file, uid: directUID } = taskArgs;

        // Determine network and contract address
        let schemaRegistryAddress: string | undefined;

        if (hre.network.name === "omachainTestnet") {
            schemaRegistryAddress = EAS_SCHEMA_REGISTRY_ADDRESSES.omachainTestnet;
        } else if (hre.network.name === "omachainMainnet") {
            schemaRegistryAddress = EAS_SCHEMA_REGISTRY_ADDRESSES.omachainMainnet;
        } else {
            console.error(`Unsupported network: ${hre.network.name}. Use 'omachainTestnet' or 'omachainMainnet'.`);
            process.exit(1);
        }

        // Get provider and signer
        const { provider } = await getProviderAndSigner(hre);

        // Connect to SchemaRegistry
        const schemaRegistry = new SchemaRegistry(schemaRegistryAddress);
        schemaRegistry.connect(provider);

        let schemaUID: string;
        let schemaObject: EasSchemaObject | null = null;
        let deploymentInfo: DeployedSchemaInfo | null = null;

        if (directUID) {
            // Direct UID verification
            schemaUID = directUID;
            console.log(`Verifying schema UID: ${formatSchemaUID(schemaUID)}`);
        } else if (file) {
            // File-based verification
            const filePath = path.resolve(process.cwd(), file);
            if (!fs.existsSync(filePath)) {
                console.error(`Error: File not found at ${filePath}`);
                process.exit(1);
            }

            const fileContent = fs.readFileSync(filePath, "utf-8");
            const parsedContent = JSON.parse(fileContent);

            // Check if this is a deployed schema file
            if (parsedContent.uid) {
                deploymentInfo = parsedContent as DeployedSchemaInfo;
                schemaUID = deploymentInfo.uid;
                console.log(`Found deployed schema file:`);
                console.log(`  UID: ${formatSchemaUID(schemaUID)}`);
                console.log(`  Block: ${deploymentInfo.blockNumber}`);
                console.log(`  Network: ${deploymentInfo.network}`);

                // Try to find the original schema file
                const baseFilename = path.basename(filePath).replace(".deployed.", ".");
                const baseFilePath = path.join(path.dirname(filePath), baseFilename);

                if (fs.existsSync(baseFilePath)) {
                    const baseFileContent = fs.readFileSync(baseFilePath, "utf-8");
                    schemaObject = JSON.parse(baseFileContent) as EasSchemaObject;
                }
            } else {
                // This is a schema object file
                schemaObject = parsedContent as EasSchemaObject;
                const resolverAddress = schemaObject.resolver && schemaObject.resolver !== "" ? schemaObject.resolver : ZERO_ADDRESS;
                schemaUID = calculateSchemaUID(schemaObject.schema, resolverAddress, schemaObject.revocable);
                console.log(`Calculated schema UID from file: ${formatSchemaUID(schemaUID)}`);
            }
        } else {
            console.error("Error: Must provide either --file or --uid parameter");
            process.exit(1);
        }

        console.log(`\nVerifying on ${hre.network.name}...`);

        // Verify schema exists
        const exists = await verifySchemaExists(schemaRegistry, schemaUID);

        if (exists) {
            console.log("✅ Schema exists on-chain!");

            // Get schema details
            const details = await getSchemaDetails(schemaRegistry, schemaUID);

            if (details) {
                console.log("\nOn-chain Schema Details:");
                console.log(`  UID: ${formatSchemaUID(details.uid)}`);
                console.log(`  Schema: ${details.schema}`);
                console.log(`  Resolver: ${details.resolver}`);
                console.log(`  Revocable: ${details.revocable}`);

                // If we have the original schema object, verify it matches
                if (schemaObject) {
                    console.log("\nVerifying schema matches local file...");
                    const schemaMatches = details.schema === schemaObject.schema;
                    const resolverMatches = details.resolver.toLowerCase() === (schemaObject.resolver || ZERO_ADDRESS).toLowerCase();
                    const revocableMatches = details.revocable === schemaObject.revocable;

                    console.log(`  Schema string: ${schemaMatches ? "✅ Match" : "❌ Mismatch"}`);
                    console.log(`  Resolver: ${resolverMatches ? "✅ Match" : "❌ Mismatch"}`);
                    console.log(`  Revocable: ${revocableMatches ? "✅ Match" : "❌ Mismatch"}`);

                    if (schemaMatches && resolverMatches && revocableMatches) {
                        console.log("\n✅ All fields match! Schema is correctly deployed.");
                    } else {
                        console.log("\n⚠️  Warning: Some fields don't match the local file.");
                        if (!schemaMatches) {
                            console.log("\nExpected schema:");
                            console.log(schemaObject.schema);
                            console.log("\nOn-chain schema:");
                            console.log(details.schema);
                        }
                    }
                }
            }
        } else {
            console.log("❌ Schema does not exist on-chain");
            console.log("\nPossible reasons:");
            console.log("  - Schema has not been deployed yet");
            console.log("  - Wrong network selected");
            console.log("  - Incorrect schema UID");
            process.exit(1);
        }

        return exists;
    });
