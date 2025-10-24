import { ethers } from 'ethers';
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";

/**
 * Calculates a schema UID deterministically based on the schema content
 * 
 * @param schema The schema string in EAS ABI format
 * @param resolverAddress The resolver address associated with the schema
 * @param revocable Whether the schema attestations are revocable
 * @returns The calculated schema UID
 */
export function calculateSchemaUID(
  schema: string,
  resolverAddress: string,
  revocable: boolean
): string {
  // Use solidityPacked as recommended by EAS
  const packed = ethers.solidityPacked(
    ['string', 'address', 'bool'],
    [schema, resolverAddress, revocable]
  );

  return ethers.keccak256(packed);
}

/**
 * Verifies that a schema with the specified UID exists
 * 
 * @param schemaRegistry The EAS SchemaRegistry instance
 * @param schemaUID The schema UID to verify
 * @returns Promise<boolean> Whether the schema exists
 */
export async function verifySchemaExists(
  schemaRegistry: SchemaRegistry,
  schemaUID: string
): Promise<boolean> {
  try {
    const schema = await schemaRegistry.getSchema({ uid: schemaUID });
    return !!schema && schema.uid !== ethers.ZeroHash;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the schema details from the registry
 * 
 * @param schemaRegistry The EAS SchemaRegistry instance
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
