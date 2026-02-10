import { task } from "hardhat/config";
import * as fs from 'fs';
import * as path from 'path';

// --- JSON Schema Interfaces (Simplified for our use) ---
interface JsonSchemaProperty {
  type?: string | string[]; // e.g., "string", "integer", ["string", "null"]
  description?: string;
  format?: string; // e.g., "uri"
  pattern?: string; // e.g., "^0x[a-fA-F0-9]{64}$" for validation
  items?: JsonSchemaProperty; // For type: "array", defines the type of array items
  "x-oma3-skip-reason"?: string; // Custom extension to indicate fields that should be skipped (e.g., "eas", "metadata", "computed")
  $ref?: string; // JSON Schema $ref for referencing other schemas
  // ... other JSON schema keywords for properties if needed
}

interface InputJsonSchema {
  title?: string;
  description?: string;
  properties?: {
    [key: string]: JsonSchemaProperty;
  };
  required?: string[];
  $defs?: { [key: string]: JsonSchemaProperty }; // Local definitions
  // ... other top-level JSON schema keywords if needed
}

// Cache for loaded external schemas
const schemaCache: Map<string, any> = new Map();

/**
 * Load an external schema file and cache it
 */
function loadExternalSchema(schemaPath: string, baseDir: string): any {
  if (schemaCache.has(schemaPath)) {
    return schemaCache.get(schemaPath);
  }

  const fullPath = path.resolve(baseDir, schemaPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Warning: Referenced schema not found: ${fullPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const schema = JSON.parse(content);
    schemaCache.set(schemaPath, schema);
    return schema;
  } catch (e: any) {
    console.warn(`Warning: Failed to load schema ${fullPath}: ${e.message}`);
    return null;
  }
}

/**
 * Resolve a $ref pointer to its actual schema definition
 */
function resolveRef(ref: string, currentSchema: InputJsonSchema, baseDir: string): JsonSchemaProperty | null {
  if (!ref) return null;

  let targetSchema: any = currentSchema;
  let pointer: string = ref;

  // Check if it's an external reference
  if (ref.includes('#') && !ref.startsWith('#')) {
    const [filePath, fragment] = ref.split('#');
    targetSchema = loadExternalSchema(filePath, baseDir);
    if (!targetSchema) {
      console.warn(`Warning: Could not load external schema for ref: ${ref}`);
      return null;
    }
    pointer = '#' + fragment;
  }

  // Resolve the JSON pointer
  if (!pointer.startsWith('#/')) {
    console.warn(`Warning: Unsupported $ref format: ${ref}`);
    return null;
  }

  const pathParts = pointer.substring(2).split('/');
  let current: any = targetSchema;

  for (const part of pathParts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      console.warn(`Warning: Could not resolve path "${pointer}" in schema.`);
      return null;
    }
  }

  return current as JsonSchemaProperty;
}

/**
 * Resolve a property, following $ref if present
 */
function resolveProperty(prop: JsonSchemaProperty, currentSchema: InputJsonSchema, baseDir: string): JsonSchemaProperty {
  if (!prop) return prop;

  if (prop.$ref) {
    const resolved = resolveRef(prop.$ref, currentSchema, baseDir);
    if (resolved) {
      const { $ref, ...localProps } = prop;
      return { ...resolved, ...localProps };
    }
    console.warn(`Warning: Failed to resolve $ref: ${prop.$ref}`);
  }

  return prop;
}

// --- BAS Output Interface ---
interface BasSchemaObject {
  name: string;
  schema: string; // The ABI-like schema string for BAS
  revocable: boolean;
}

// --- Helper Functions ---

/**
 * Maps a JSON Schema property definition (including its type and items for arrays)
 * to a BAS ABI type string.
 * @param jsonProperty The JSON Schema property definition.
 * @param propName The property name (for logging)
 * @param currentSchema The current schema (for resolving $refs)
 * @param baseDir Base directory for external schema files
 * @returns BAS ABI type string or null if not mappable.
 */
function mapJsonSchemaPropertyToAbiType(
  jsonProperty: JsonSchemaProperty,
  propName: string,
  currentSchema?: InputJsonSchema,
  baseDir?: string
): string | null {
  let typeToProcess: string;

  // Determine the primary type if jsonProperty.type is an array (e.g., ["string", "null"])
  if (Array.isArray(jsonProperty.type)) {
    typeToProcess = jsonProperty.type.find(t => t !== "null") || jsonProperty.type[0];
  } else if (jsonProperty.type) {
    typeToProcess = jsonProperty.type;
  } else {
    // No type defined, default to string
    typeToProcess = 'string';
  }

  const typeLower = typeToProcess.toLowerCase();

  if (typeLower === 'array') {
    let resolvedItems = jsonProperty.items;

    if (jsonProperty.items) {
      // If items has a $ref, resolve it first
      if (jsonProperty.items.$ref && currentSchema && baseDir) {
        resolvedItems = resolveProperty(jsonProperty.items, currentSchema, baseDir);
      }

      if (resolvedItems && resolvedItems.type) {
        // Get the type of the items within the array
        let itemSchemaType: string;
        if (Array.isArray(resolvedItems.type)) {
          itemSchemaType = resolvedItems.type.find(t => t !== "null") || resolvedItems.type[0];
        } else {
          itemSchemaType = resolvedItems.type;
        }

        let baseAbiType: string | null = null;
        switch (itemSchemaType.toLowerCase()) {
          case 'string': baseAbiType = 'string'; break;
          case 'integer': case 'number': baseAbiType = 'uint256'; break;
          case 'boolean': baseAbiType = 'bool'; break;
          case 'object': baseAbiType = 'string'; break; // Objects in arrays become JSON strings
          default:
            console.warn(`Unsupported 'items' type "${itemSchemaType}" in array property '${propName}'. Skipping.`);
            return null;
        }
        return `${baseAbiType}[]`; // e.g., string[]
      }
    }
    console.warn(`Array property '${propName}' encountered without valid 'items.type' definition. Skipping.`);
    return null;
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
    case 'object': return 'string'; // Objects become JSON strings
    default:
      console.warn(`Unsupported JSON Schema type "${typeLower}" in property '${propName}'. Skipping.`);
      return null;
  }
}

/**
 * Builds the BAS schema string from JSON Schema properties.
 * @param properties The 'properties' object from a JSON Schema.
 * @param currentSchema The current schema (for resolving $refs).
 * @param baseDir Base directory for external schema files.
 * @returns BAS ABI-like schema string.
 */
function buildSchemaString(
  properties: { [key: string]: JsonSchemaProperty } | undefined,
  currentSchema: InputJsonSchema,
  baseDir: string
): string {
  if (!properties) {
    return "";
  }
  const abiFields: string[] = [];
  for (const key in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      // Resolve $ref if present
      const rawProperty = properties[key];
      const property = resolveProperty(rawProperty, currentSchema, baseDir);

      // Skip fields based on x-oma3-skip-reason:
      // - "metadata": JSON-LD fields not stored on-chain (@context, @type)
      // - "eas": Fields provided by EAS/BAS itself (attester, revoked)
      // - "unused": Reserved fields - INCLUDE in schema per spec ("MUST preserve if present")
      const skipReason = property["x-oma3-skip-reason"];
      if (skipReason === "metadata" || skipReason === "eas") {
        console.log(`Skipping field '${key}' due to x-oma3-skip-reason: ${skipReason}`);
        continue;
      }
      if (skipReason === "unused") {
        console.log(`Including reserved field '${key}' in schema (x-oma3-skip-reason: unused)`);
      }

      // Pass the whole property object to the mapping function (with context for $ref resolution)
      const abiType = mapJsonSchemaPropertyToAbiType(property, key, currentSchema, baseDir);
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
  .setAction(async (taskArgs, hre) => {
    const { schema: schemaFilePathArg, name: nameOverride, revocable: revocableArg } = taskArgs;
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

    // Check for top-level properties (shared definition files like common.schema.json won't have any)
    if (!inputSchema.properties || Object.keys(inputSchema.properties).length === 0) {
      console.error(`Error: Schema at ${schemaFilePath} has no top-level properties. It may be a shared definitions file rather than an attestation schema.`);
      process.exit(1);
    }

    // Check for title and fail if none exists
    if (!inputSchema.title && !nameOverride) {
      console.error(`Error: Schema at ${schemaFilePath} does not have a title property, and no --name was provided.`);
      process.exit(1);
    }

    // Determine BAS object name
    const schemaTitle = inputSchema.title || ""; // This should never be empty due to check above
    const autoName = schemaTitle.replace(/\s+/g, '-'); // Replace spaces in title for filename
    const basName = nameOverride || autoName;

    // Get the base directory for resolving $ref references (same directory as the schema file)
    const schemaBaseDir = path.dirname(schemaFilePath);

    // Build BAS schema string (with $ref resolution support)
    const schemaString = buildSchemaString(inputSchema.properties, inputSchema, schemaBaseDir);

    // Determine revocable flag
    const revocable = revocableArg.toLowerCase() === 'true';

    const basSchemaObject: BasSchemaObject = {
      name: basName,
      schema: schemaString,
      revocable,
    };

    const outputFilePath = path.join(outputDir, `${basName}.bas.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(basSchemaObject, null, 2));
    console.log(`Successfully generated BAS object at: ${outputFilePath}`);
    console.log("Generated BAS Object:", JSON.stringify(basSchemaObject, null, 2));
  }); 