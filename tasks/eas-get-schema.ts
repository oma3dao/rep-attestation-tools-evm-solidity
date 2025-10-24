import { task } from "hardhat/config";
import { NETWORK_CONTRACTS } from "../hardhat.config";
import * as fs from "fs";
import * as path from "path";

task("eas-get-schema", "Get schema details by UID")
  .addParam("uid", "Schema UID (bytes32)")
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name as keyof typeof NETWORK_CONTRACTS;
    const schemaRegistryAddress = NETWORK_CONTRACTS[networkName]?.easSchemaRegistry;

    if (!schemaRegistryAddress || schemaRegistryAddress === "0x") {
      throw new Error(`SchemaRegistry not configured for network ${networkName}`);
    }

    console.log(`SchemaRegistry: ${schemaRegistryAddress}`);

    // Load SchemaRegistry ABI
    const abiPath = path.join(__dirname, "../abis/SchemaRegistry.json");
    const schemaRegistryAbi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const schemaRegistry = await hre.ethers.getContractAt(schemaRegistryAbi, schemaRegistryAddress);

    const schema = await schemaRegistry.getSchema(taskArgs.uid);

    console.log(`\n📋 Schema Details:`);
    console.log(`UID: ${taskArgs.uid}`);
    console.log(`Schema: ${schema.schema}`);
    console.log(`Resolver: ${schema.resolver}`);
    console.log(`Revocable: ${schema.revocable}`);
    console.log(`Index: ${schema.index}`);
  });
