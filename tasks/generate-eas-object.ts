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
  oneOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  allOf?: JsonSchemaProperty[];
  if?: JsonSchemaProperty;
  then?: JsonSchemaProperty;
  else?: JsonSchemaProperty;
  properties?: { [key: string]: JsonSchemaProperty };
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
 * @param schemaPath Relative path to the schema file (e.g., "common.schema.json")
 * @param baseDir Base directory where schemas are located
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
 * Supports:
 * - Local refs: "#/$defs/SomeDef"
 * - External refs: "common.schema.json#/$defs/SomeDef"
 * 
 * @param ref The $ref string
 * @param currentSchema The current schema (for local refs)
 * @param baseDir Base directory for external schema files
 */
function resolveRef(ref: string, currentSchema: InputJsonSchema, baseDir: string): JsonSchemaProperty | null {
  if (!ref) return null;

  let targetSchema: any = currentSchema;
  let pointer: string = ref;

  // Check if it's an external reference (contains a file path before #)
  if (ref.includes('#') && !ref.startsWith('#')) {
    const [filePath, fragment] = ref.split('#');
    targetSchema = loadExternalSchema(filePath, baseDir);
    if (!targetSchema) {
      console.warn(`Warning: Could not load external schema for ref: ${ref}`);
      return null;
    }
    pointer = '#' + fragment;
  }

  // Now resolve the JSON pointer within the target schema
  // Expected format: "#/$defs/DefinitionName" or "#/properties/propName"
  if (!pointer.startsWith('#/')) {
    console.warn(`Warning: Unsupported $ref format: ${ref}`);
    return null;
  }

  const pathParts = pointer.substring(2).split('/'); // Remove "#/" and split
  let current: any = targetSchema;

  for (const part of pathParts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      console.warn(`Warning: Could not resolve path "${pointer}" in schema. Part "${part}" not found.`);
      return null;
    }
  }

  return current as JsonSchemaProperty;
}

/**
 * Resolve a property, following $ref if present
 * @param prop The property that may contain a $ref
 * @param currentSchema The current schema (for local refs)
 * @param baseDir Base directory for external schema files
 */
function resolveProperty(prop: JsonSchemaProperty, currentSchema: InputJsonSchema, baseDir: string): JsonSchemaProperty {
  if (!prop) return prop;

  // If property has a $ref, resolve it and merge with any local overrides
  if (prop.$ref) {
    const resolved = resolveRef(prop.$ref, currentSchema, baseDir);
    if (resolved) {
      // Merge: local properties override resolved ones (except $ref itself)
      const { $ref, ...localProps } = prop;
      return { ...resolved, ...localProps };
    }
    // If resolution failed, return original (will likely fail type mapping)
    console.warn(`Warning: Failed to resolve $ref: ${prop.$ref}`);
  }

  return prop;
}

// --- EAS Output Interface ---
interface EasSchemaObject {
  name: string;
  schema: string; // The ABI-like schema string for EAS
  revocable: boolean;
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
 * @param currentSchema The current schema (for resolving $refs)
 * @param baseDir Base directory for external schema files
 * @returns EAS ABI type string or null if not mappable.
 */
function mapJsonSchemaPropertyToAbiType(
  jsonProperty: JsonSchemaProperty,
  propName: string,
  currentSchema?: InputJsonSchema,
  baseDir?: string
): string | null {
  // Special case: purpose is always string for EAS stability (handles root-level conditionals)
  if (propName === "purpose") return "string";

  // Resolve the effective type (handles conditionals, unions, etc.)
  const effectiveType = resolveJsonType(jsonProperty);

  // Handle arrays specially
  if (effectiveType === 'array') {
    let itemType: string | undefined;
    let resolvedItems = jsonProperty.items;

    if (jsonProperty.items) {
      // If items has a $ref, resolve it first
      if (jsonProperty.items.$ref && currentSchema && baseDir) {
        resolvedItems = resolveProperty(jsonProperty.items, currentSchema, baseDir);
      }

      // Try to resolve item type (handles nested schemas)
      if (resolvedItems) {
        itemType = resolveJsonType(resolvedItems);

        // Fallback to direct type if available
        if (!itemType && resolvedItems.type) {
          if (Array.isArray(resolvedItems.type)) {
            itemType = resolvedItems.type.find(t => t !== "null") || resolvedItems.type[0];
          } else {
            itemType = resolvedItems.type;
          }
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
          console.warn(`Unsupported 'items' type "${itemType}" in array property '${propName}'. Skipping array property.`);
          return null;
      }
      return `${baseAbiType}[]`; // e.g., string[]
    } else {
      console.warn(`Array property '${propName}' encountered without valid 'items.type' definition. Skipping property.`);
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
 * @param currentSchema The current schema (for resolving local $refs).
 * @param baseDir Base directory for external schema files.
 * @returns EAS ABI-like schema string.
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
      // - "eas": Fields provided by EAS itself (attester, revoked)
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

/**
 * Auto-detect if schema should be revocable based on presence of 'revoked' field
 * with x-oma3-skip-reason: "eas" (meaning EAS handles revocation natively)
 */
function detectRevocable(properties: { [key: string]: JsonSchemaProperty } | undefined): boolean {
  if (!properties) return false;
  
  const revokedField = properties['revoked'];
  if (revokedField && revokedField['x-oma3-skip-reason'] === 'eas') {
    return true;
  }
  return false;
}

// --- Hardhat Task ---

task("generate-eas-object", "Generate an EAS-compatible object from a JSON Schema file.")
  .addParam("schema", "Path to the input JSON Schema file")
  .addOptionalParam("name", "Override EAS object name/output file name. By default, derived from schema's 'title'.")
  .addOptionalParam("revocable", "Override schema revocability (true/false). By default, auto-detected from schema's 'revoked' field.")
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

    // Determine EAS object name
    const schemaTitle = inputSchema.title || ""; // This should never be empty due to check above
    const autoName = schemaTitle.replace(/\s+/g, '-'); // Replace spaces in title for filename
    const easName = nameOverride || autoName;

    // Get the base directory for resolving $ref references (same directory as the schema file)
    const schemaBaseDir = path.dirname(schemaFilePath);

    // Build EAS schema string (with $ref resolution support)
    const schemaString = buildSchemaString(inputSchema.properties, inputSchema, schemaBaseDir);

    // Determine revocable flag:
    // 1. CLI override takes precedence
    // 2. Otherwise auto-detect from schema's 'revoked' field with x-oma3-skip-reason: "eas"
    // 3. Default to false if not specified and not detected
    let revocable: boolean;
    if (revocableArg !== undefined) {
      revocable = revocableArg.toLowerCase() === 'true';
      console.log(`Revocable: ${revocable} (from CLI override)`);
    } else {
      revocable = detectRevocable(inputSchema.properties);
      console.log(`Revocable: ${revocable} (auto-detected from schema)`);
    }

    const easSchemaObject: EasSchemaObject = {
      name: easName,
      schema: schemaString,
      revocable,
    };

    const outputFilePath = path.join(outputDir, `${easName}.eas.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(easSchemaObject, null, 2));
    console.log(`Successfully generated EAS object at: ${outputFilePath}`);
    console.log("Generated EAS Object:", JSON.stringify(easSchemaObject, null, 2));
  });
