import { task } from "hardhat/config";
import { ethers } from 'ethers';
import { calculateSchemaUID, formatSchemaUID } from '../utils/basTools';
import * as fs from 'fs';
import * as path from 'path';

task("test-schema-uid", "Test the schema UID calculation against BAS reference implementation")
  .addOptionalParam("file", "Path to the BAS schema JSON file (e.g., generated/Endorsement.bastest.json)")
  .setAction(async (taskArgs, hre) => {
    let schemaObject;
    let expectedUID;
    
    if (taskArgs.file) {
      const filePath = path.resolve(process.cwd(), taskArgs.file);
      if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
      }
      
      // Read schema from file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      schemaObject = JSON.parse(fileContent);
      
      // Check if this is a deployed schema file (contains UID)
      if (schemaObject.uid) {
        console.log("Found deployed schema file with UID:", schemaObject.uid);
        expectedUID = schemaObject.uid.toLowerCase();
        
        // Try to find the original schema file
        const baseFilename = path.basename(filePath).replace('.deployed.', '.');
        const baseFilePath = path.join(path.dirname(filePath), baseFilename);
        
        if (fs.existsSync(baseFilePath)) {
          console.log(`Found original schema file: ${baseFilePath}`);
          const baseFileContent = fs.readFileSync(baseFilePath, 'utf-8');
          schemaObject = JSON.parse(baseFileContent);
        } else {
          console.error("Could not find the original schema file. Please provide the schema file directly.");
          process.exit(1);
        }
      }
    } else {
      // Use BAS example if no file provided
      schemaObject = {
        schema: "uint256 schemaId, string msg5, bool isActive, string[] tags, uint256[] scores, string optionalDescription, bool[] statusFlags",
        resolver: "0x0000000000000000000000000000000000000000", // zero address
        revocable: true
      };
      
      expectedUID = "0xe97c0fcc6c37e9f782fd9917e3fa6d22ca1b52d8d936002be4babb55e82dadab";
      console.log("Using BAS example schema:");
    }
    
    console.log("Schema:", schemaObject);
    
    // Calculate UID using our function
    const calculatedUID = calculateSchemaUID(
      schemaObject.schema,
      schemaObject.resolver,
      schemaObject.revocable
    );
    
    const formattedUID = formatSchemaUID(calculatedUID).toLowerCase();
    console.log("Calculated UID:", formattedUID);
    
    if (expectedUID) {
      console.log("Expected UID:  ", expectedUID);
      console.log("Match:", formattedUID === expectedUID);
    }
    
    // Always show the direct calculation
    const packed = ethers.solidityPacked(
      ['string', 'address', 'bool'],
      [schemaObject.schema, schemaObject.resolver, schemaObject.revocable]
    );
    const manualUID = ethers.keccak256(packed).toLowerCase();
    
    console.log("\nDirect calculation:");
    console.log("Manual UID:    ", manualUID);
    
    if (expectedUID) {
      console.log("Match with expected:", manualUID === expectedUID);
    }
    
    return formattedUID;
  }); 