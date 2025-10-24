import { task } from "hardhat/config";

task("eas-encode-data", "Encode attestation data for a schema")
  .addParam("types", "Comma-separated types (e.g., 'string,uint8,address')")
  .addParam("values", "Comma-separated values (e.g., 'Alice,95,0x123...')")
  .setAction(async (taskArgs, hre) => {
    // Parse types
    const types = taskArgs.types.split(",").map((t: string) => t.trim());
    
    // Parse values
    const rawValues = taskArgs.values.split(",").map((v: string) => v.trim());
    
    if (types.length !== rawValues.length) {
      throw new Error(`Type count (${types.length}) doesn't match value count (${rawValues.length})`);
    }

    // Convert values to appropriate types
    const values = rawValues.map((value: string, index: number) => {
      const type = types[index];
      
      // Handle numeric types
      if (type.startsWith("uint") || type.startsWith("int")) {
        return BigInt(value);
      }
      
      // Handle boolean
      if (type === "bool") {
        return value.toLowerCase() === "true";
      }
      
      // Handle bytes32
      if (type === "bytes32") {
        return value.startsWith("0x") ? value : `0x${value}`;
      }
      
      // Handle address
      if (type === "address") {
        return value;
      }
      
      // Handle string and other types
      return value;
    });

    console.log(`\nEncoding data:`);
    console.log(`Types: [${types.join(", ")}]`);
    console.log(`Values: [${values.join(", ")}]`);

    const encoded = hre.ethers.AbiCoder.defaultAbiCoder().encode(types, values);
    
    console.log(`\n✅ Encoded data:`);
    console.log(encoded);
    console.log(`\nUse this value with --data parameter in eas-attest`);
  });
