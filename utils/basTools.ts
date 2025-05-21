import { ethers } from 'ethers';
import { SchemaRegistry } from "@bnb-attestation-service/bas-sdk";

/**
 * Calculates a schema UID deterministically based on the schema content
 * 
 * @param schema The schema string in BAS ABI format
 * @param resolverAddress The resolver address associated with the schema
 * @param revocable Whether the schema attestations are revocable
 * @returns The calculated schema UID
 */
export function calculateSchemaUID(
  schema: string,
  resolverAddress: string,
  revocable: boolean
): string {
  // Calculate UID using only the schema string
  return ethers.keccak256(
    ethers.toUtf8Bytes(schema)
  );
  
  // Original approach - kept for reference
  // return ethers.keccak256(
  //   ethers.AbiCoder.defaultAbiCoder().encode(
  //     ['string', 'address', 'bool'],
  //     [schema, resolverAddress, revocable]
  //   )
  // );
}

/**
 * Verifies that a schema with the specified UID exists
 * 
 * @param schemaRegistry The BAS SchemaRegistry instance
 * @param schemaUID The schema UID to verify
 * @returns Promise<boolean> Whether the schema exists
 */
export async function verifySchemaExists(
  schemaRegistry: SchemaRegistry,
  schemaUID: string
): Promise<boolean> {
  try {
    const schema = await schemaRegistry.getSchema({ uid: schemaUID });
    return !!schema;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the schema details from the registry
 * 
 * @param schemaRegistry The BAS SchemaRegistry instance
 * @param schemaUID The schema UID to retrieve
 * @returns Promise with the schema details or null if not found
 */
export async function getSchemaDetails(
  schemaRegistry: SchemaRegistry,
  schemaUID: string
): Promise<any> {
  try {
    return await schemaRegistry.getSchema({ uid: schemaUID });
  } catch (error) {
    return null;
  }
}

/**
 * Formats a schema UID for display (adds 0x prefix if missing)
 * 
 * @param schemaUID The schema UID to format
 * @returns Formatted schema UID
 */
export function formatSchemaUID(schemaUID: string): string {
  if (!schemaUID) return '';
  return schemaUID.startsWith('0x') ? schemaUID : `0x${schemaUID}`;
} 