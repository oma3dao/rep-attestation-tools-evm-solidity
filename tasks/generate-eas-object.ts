import { task } from "hardhat/config";
import * as fs from 'fs';
import * as path from 'path';

import { ZERO_ADDRESS } from "../utils/constants";
import { ethers } from 'ethers';

// --- JSON Schema Interfaces (Simplified for our use) ---
interface JsonSchemaProperty {
  type?: string | string[]; // e.g., "string", "integer", ["string", "null"]
  description?: string;
  format?: string; // e.g., "uri"
  pattern?: string; // e.g., "^0x[a-fA-F0-9]{64}$" for validation
  items?: JsonSchemaProperty; // For type: "array", defines the type of array items
  "x-oma3-skip-reason"?: string; // Custom extension to indicate fields that should be skipped (e.g., "eas", "metadata", "computed")
  oneOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  allOf?: JsonSchemaProperty[];
  if?: JsonSchemaProperty;
  then?: JsonSchemaProperty;
  else?: JsonSchemaProperty;
  properties?: { [key: string]: JsonSchemaProperty };
  // ... other JSON schema keywords for properties if needed
}

interface InputJsonSchema {
  title?: string;
  description?: string;
  properties?: {
    [key: string]: JsonSchemaProperty;
  };
  required?: string[];
  // ... other top-level JSON schema keywords if needed
}

// --- EAS Output Interface ---
interface EasSchemaObject {
  name: string;
  schema: string; // The ABI-like schema string for EAS
  revocable: boolean;
  resolver: string;
}

// --- Helper Functions ---

/**
 * Pick the priority type from a list of types
 * Priority: object > array > string > integer/number > boolean
 */
function pickPriorityType(types: string[] | undefined): string | undefined {
  if (!types || types.length === 0) return undefined;
  const order = ["object", "array", "string", "integer", "number", "boolean"];
  for (const t of order) {
    if (types.includes(t)) return t;
  }
  return types[0];
}

/**
 * Collect types from oneOf/anyOf/allOf branches
 */
function collectTypesFromBranches(s: JsonSchemaProperty): string[] {
  const out: string[] = [];
  const branches = [
    ...(Array.isArray(s.oneOf) ? s.oneOf : []),
    ...(Array.isArray(s.anyOf) ? s.anyOf : []),
    ...(Array.isArray(s.allOf) ? s.allOf : []),
  ];
  for (const b of branches) {
    if (typeof b?.type === "string") out.push(b.type);
    if (Array.isArray(b?.type)) out.push(...b.type);
    // Also check if/then/else within branches
    if (b?.then?.properties) {
      for (const prop of Object.values(b.then.properties)) {
        if (typeof prop?.type === "string") out.push(prop.type);
        if (Array.isArray(prop?.type)) out.push(...prop.type);
      }
    }
    if (b?.else?.properties) {
      for (const prop of Object.values(b.else.properties)) {
        if (typeof prop?.type === "string") out.push(prop.type);
        if (Array.isArray(prop?.type)) out.push(...prop.type);
      }
    }
  }
  return out;
}

/**
 * Resolve the effective JSON type for a property, handling conditionals
 */
function resolveJsonType(propSchema: JsonSchemaProperty): string | undefined {
  if (!propSchema) return undefined;

  // Direct type
  if (typeof propSchema.type === "string") return propSchema.type.toLowerCase();
  if (Array.isArray(propSchema.type)) {
    return pickPriorityType(propSchema.type.map(String).map(s => s.toLowerCase()));
  }

  // Check branches (oneOf/anyOf/allOf)
  const branchTypes = collectTypesFromBranches(propSchema).map(s => s.toLowerCase());
  if (branchTypes.length) return pickPriorityType(branchTypes);

  // Default to undefined (will be treated as string in fallback)
  return undefined;
}

/**
 * Map JSON type to EAS ABI type
 */
function jsonTypeToAbi(effectiveType: string | undefined, ctx: { propName: string; pattern?: string; xAbi?: string }): string {
  // Explicit ABI hint takes precedence
  if (ctx.xAbi === "bytes32") return "bytes32";

  const t = effectiveType?.toLowerCase();

  switch (t) {
    case "object":
      return "string"; // NEW: serialize objects as strings for EAS ABI
    case "string":
      // Map hex hash pattern to bytes32 for EVM efficiency (permissive regex)
      if (ctx.pattern && /0x[a-fA-F0-9]{64}/.test(ctx.pattern)) {
        return 'bytes32';
      }
      return "string";
    case "integer":
    case "number":
      return "uint256";
    case "boolean":
      return "bool";
    default:
      // Fallback: treat as string (especially for conditional fields like `purpose`)
      return "string";
  }
}

/**
 * Maps a JSON Schema property definition (including its type and items for arrays)
 * to an EAS ABI type string.
 * @param jsonProperty The JSON Schema property definition.
 * @param propName The property name (for context)
 * @returns EAS ABI type string or null if not mappable.
 */
function mapJsonSchemaPropertyToAbiType(jsonProperty: JsonSchemaProperty, propName: string): string | null {
  // Special case: purpose is always string for EAS stability (handles root-level conditionals)
  if (propName === "purpose") return "string";

  // Resolve the effective type (handles conditionals, unions, etc.)
  const effectiveType = resolveJsonType(jsonProperty);

  // Handle arrays specially
  if (effectiveType === 'array') {
    let itemType: string | undefined;

    if (jsonProperty.items) {
      // Try to resolve item type (handles nested schemas)
      itemType = resolveJsonType(jsonProperty.items);

      // Fallback to direct type if available
      if (!itemType && jsonProperty.items.type) {
        if (Array.isArray(jsonProperty.items.type)) {
          itemType = jsonProperty.items.type.find(t => t !== "null") || jsonProperty.items.type[0];
        } else {
          itemType = jsonProperty.items.type;
        }
      }
    }

    if (itemType) {
      let baseAbiType: string | null = null;
      switch (itemType.toLowerCase()) {
        case 'string': baseAbiType = 'string'; break;
        case 'integer': case 'number': baseAbiType = 'uint256'; break;
        case 'boolean': baseAbiType = 'bool'; break;
        case 'object': baseAbiType = 'string'; break; // Objects in arrays become strings
        // Note: EAS/ABI doesn't typically support arrays of complex objects directly in this flat schema string.
        // Arrays of arrays are also not standard in this simple mapping.
        default:
          console.warn(`Unsupported 'items' type "${itemType}" in array property. Skipping array property.`);
          return null;
      }
      return `${baseAbiType}[]`; // e.g., string[]
    } else {
      console.warn("Array property encountered without valid 'items.type' definition. Skipping property.");
      return null;
    }
  }

  // Handling for scalar (non-array) types
  const xAbi = (jsonProperty as any)["x-oma3-abi"];
  return jsonTypeToAbi(effectiveType, { propName, pattern: jsonProperty.pattern, xAbi });
}

/**
 * Builds the EAS schema string from JSON Schema properties.
 * @param properties The 'properties' object from a JSON Schema.
 * @returns EAS ABI-like schema string.
 */
function buildSchemaString(properties?: { [key: string]: JsonSchemaProperty }): string {
  if (!properties) {
    return "";
  }
  const abiFields: string[] = [];
  for (const key in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      const property = properties[key];

      // Skip fields that have x-oma3-skip-reason (metadata, eas, computed, etc.)
      if (property["x-oma3-skip-reason"]) {
        console.log(`Skipping field '${key}' due to x-oma3-skip-reason: ${property["x-oma3-skip-reason"]}`);
        continue;
      }

      // Pass the whole property object to the mapping function
      const abiType = mapJsonSchemaPropertyToAbiType(property, key);
      if (abiType) {
        abiFields.push(`${abiType} ${key}`);
      }
    }
  }
  return abiFields.join(', ');
}

// --- Hardhat Task ---

task("generate-eas-object", "Generate an EAS-compatible object from a JSON Schema file.")
  .addParam("schema", "Path to the input JSON Schema file")
  .addOptionalParam("name", "Override EAS object name/output file name. By default, derived from schema's 'title'.")
  .addOptionalParam("revocable", "Set schema revocability (true/false). Default: false.", "false")
  .addOptionalParam("resolver", "Resolver address for the EAS schema. Default: zero address.", ZERO_ADDRESS)
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

    // Determine EAS object name
    const schemaTitle = inputSchema.title || ""; // This should never be empty due to check above
    const autoName = schemaTitle.replace(/\s+/g, '-'); // Replace spaces in title for filename
    const easName = nameOverride || autoName;

    // Build EAS schema string
    const schemaString = buildSchemaString(inputSchema.properties);

    // Determine revocable flag
    const revocable = revocableArg.toLowerCase() === 'true';

    // Determine resolver address
    const resolver = resolverArg ? ethers.getAddress(resolverArg) : ZERO_ADDRESS;

    const easSchemaObject: EasSchemaObject = {
      name: easName,
      schema: schemaString,
      revocable,
      resolver,
    };

    // Determine output filename suffix based on network
    const networkSuffix = hre.network.name === 'omachainTestnet' ? 'eastest' : 'eas';

    const outputFilePath = path.join(outputDir, `${easName}.${networkSuffix}.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(easSchemaObject, null, 2));
    console.log(`Successfully generated EAS object at: ${outputFilePath}`);
    console.log("Generated EAS Object:", JSON.stringify(easSchemaObject, null, 2));
  });
