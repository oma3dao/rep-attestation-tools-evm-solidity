import { task } from "hardhat/config";
import * as fs from 'fs';
import * as path from 'path';

import { ZERO_ADDRESS } from "../utils/constants"; // Assuming ZERO_ADDRESS is here
import { ethers } from 'ethers';

// --- JSON Schema Interfaces (Simplified for our use) ---
interface JsonSchemaProperty {
  type: string | string[]; // e.g., "string", "integer", ["string", "null"]
  description?: string;
  format?: string; // e.g., "uri"
  pattern?: string; // e.g., "^0x[a-fA-F0-9]{64}$" for validation
  items?: JsonSchemaProperty; // For type: "array", defines the type of array items
  "x-oma3-skip-reason"?: string; // Custom extension to indicate fields that should be skipped for BAS
  // ... other JSON schema keywords for properties if needed
}

interface InputJsonSchema { // No longer extends SchemaObject
  title?: string;
  description?: string;
  properties?: {
    [key: string]: JsonSchemaProperty;
  };
  required?: string[];
  // Custom extensions for BAS
  // ... other top-level JSON schema keywords if needed
}

// --- BAS Output Interface ---
interface BasSchemaObject {
  name: string;
  schema: string; // The ABI-like schema string for BAS
  revocable: boolean;
  resolver: string;
}

// --- Helper Functions ---

/**
 * Maps a JSON Schema property definition (including its type and items for arrays)
 * to a BAS ABI type string.
 * @param jsonProperty The JSON Schema property definition.
 * @returns BAS ABI type string or null if not mappable.
 */
function mapJsonSchemaPropertyToAbiType(jsonProperty: JsonSchemaProperty): string | null {
  let typeToProcess: string;

  // Determine the primary type if jsonProperty.type is an array (e.g., ["string", "null"])
  if (Array.isArray(jsonProperty.type)) {
    typeToProcess = jsonProperty.type.find(t => t !== "null") || jsonProperty.type[0];
  } else {
    typeToProcess = jsonProperty.type;
  }

  const typeLower = typeToProcess.toLowerCase();

  if (typeLower === 'array') {
    if (jsonProperty.items && jsonProperty.items.type) {
      // Get the type of the items within the array
      let itemSchemaType: string;
      if (Array.isArray(jsonProperty.items.type)) {
        itemSchemaType = jsonProperty.items.type.find(t => t !== "null") || jsonProperty.items.type[0];
      } else {
        itemSchemaType = jsonProperty.items.type;
      }

      let baseAbiType: string | null = null;
      switch (itemSchemaType.toLowerCase()) {
        case 'string': baseAbiType = 'string'; break;
        case 'integer': case 'number': baseAbiType = 'uint256'; break;
        case 'boolean': baseAbiType = 'bool'; break;
        // Note: BAS/ABI doesn't typically support arrays of complex objects directly in this flat schema string.
        // Arrays of arrays are also not standard in this simple mapping.
        default:
          console.warn(`Unsupported 'items' type "${itemSchemaType}" in array property. Skipping array property.`);
          return null;
      }
      return `${baseAbiType}[]`; // e.g., string[]
    } else {
      console.warn("Array property encountered without valid 'items.type' definition. Skipping property.");
      return null;
    }
  }

  // Handling for scalar (non-array) types
  switch (typeLower) {
    case 'string':
      // Map hex hash pattern to bytes32 for EVM efficiency
      if (jsonProperty.pattern && jsonProperty.pattern === '^0x[a-fA-F0-9]{64}$') {
        return 'bytes32';
      }
      return 'string';
    case 'integer': case 'number': return 'uint256';
    case 'boolean': return 'bool';
    default:
      console.warn(`Unsupported JSON Schema type "${typeLower}" encountered. Skipping.`);
      return null;
  }
}

/**
 * Builds the BAS schema string from JSON Schema properties.
 * @param properties The 'properties' object from a JSON Schema.
 * @returns BAS ABI-like schema string.
 */
function buildSchemaString(properties?: { [key: string]: JsonSchemaProperty }): string {
  if (!properties) {
    return "";
  }
  const abiFields: string[] = [];
  for (const key in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      const property = properties[key];

      // Skip fields that have x-oma3-skip-reason (metadata, bas, etc.)
      if (property["x-oma3-skip-reason"]) {
        console.log(`Skipping field '${key}' due to x-oma3-skip-reason: ${property["x-oma3-skip-reason"]}`);
        continue;
      }

      // Pass the whole property object to the mapping function
      const abiType = mapJsonSchemaPropertyToAbiType(property);
      if (abiType) {
        abiFields.push(`${abiType} ${key}`);
      }
    }
  }
  return abiFields.join(', ');
}

// --- Hardhat Task ---

task("generate-bas-object", "Generate a BAS-compatible object from a JSON Schema file.")
  .addParam("schema", "Path to the input JSON Schema file")
  .addOptionalParam("name", "Override BAS object name/output file name. By default, derived from schema's 'title'.")
  .addOptionalParam("revocable", "Set schema revocability (true/false). Default: false.", "false")
  .addOptionalParam("resolver", "Resolver address for the BAS schema. Default: zero address.", ZERO_ADDRESS)
  .setAction(async (taskArgs, hre) => {
    const { schema: schemaFilePathArg, name: nameOverride, revocable: revocableArg, resolver: resolverArg } = taskArgs;
    const schemaFilePath = path.resolve(process.cwd(), schemaFilePathArg);
    const outputDir = path.resolve(process.cwd(), 'generated');

    if (!fs.existsSync(schemaFilePath)) {
      console.error(`Error: Input schema file not found: ${schemaFilePath}`);
      process.exit(1);
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const schemaFileContent = fs.readFileSync(schemaFilePath, 'utf-8');
    let parsedSchemaContent: any;
    try {
      parsedSchemaContent = JSON.parse(schemaFileContent);
    } catch (e: any) {
      console.error(`Error parsing JSON schema file at ${schemaFilePath}: ${e.message}`);
      process.exit(1);
    }

    const inputSchema: InputJsonSchema = parsedSchemaContent as InputJsonSchema;

    // Check for title and fail if none exists
    if (!inputSchema.title && !nameOverride) {
      console.error(`Error: Schema at ${schemaFilePath} does not have a title property, and no --name was provided.`);
      process.exit(1);
    }

    // Determine BAS object name
    const schemaTitle = inputSchema.title || ""; // This should never be empty due to check above
    const autoName = schemaTitle.replace(/\s+/g, '-'); // Replace spaces in title for filename
    const basName = nameOverride || autoName;

    // Build BAS schema string
    const schemaString = buildSchemaString(inputSchema.properties);

    // Determine revocable flag
    const revocable = revocableArg.toLowerCase() === 'true';

    // Determine resolver address
    const resolver = resolverArg ? ethers.getAddress(resolverArg) : ZERO_ADDRESS;

    const basSchemaObject: BasSchemaObject = {
      name: basName,
      schema: schemaString,
      revocable,
      resolver,
    };

    // Determine output filename suffix based on network
    const networkSuffix = hre.network.name === 'bsc' ? 'bas' : 'bastest';

    const outputFilePath = path.join(outputDir, `${basName}.${networkSuffix}.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(basSchemaObject, null, 2));
    console.log(`Successfully generated BAS object at: ${outputFilePath}`);
    console.log("Generated BAS Object:", JSON.stringify(basSchemaObject, null, 2));
  }); 