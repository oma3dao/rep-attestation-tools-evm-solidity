import { task } from "hardhat/config";
import { getDeployerSigner } from "./shared/signer-utils";
import { NETWORK_CONTRACTS } from "../hardhat.config";
import * as fs from "fs";
import * as path from "path";

task("eas-register-schema", "Register a new attestation schema")
  .addParam("schema", "Schema definition (e.g., 'string name,uint8 score')")
  .addOptionalParam("resolver", "Resolver address (default: zero address)")
  .addOptionalParam("revocable", "Whether attestations can be revoked (default: true)")
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name as keyof typeof NETWORK_CONTRACTS;
    const schemaRegistryAddress = NETWORK_CONTRACTS[networkName]?.easSchemaRegistry;

    if (!schemaRegistryAddress || schemaRegistryAddress === "0x") {
      throw new Error(`SchemaRegistry not configured for network ${networkName}`);
    }

    const { signer, address: signerAddress } = await getDeployerSigner(hre);
    console.log(`Registering schema with signer: ${signerAddress}`);
    console.log(`SchemaRegistry: ${schemaRegistryAddress}`);

    // Load SchemaRegistry ABI
    const abiPath = path.join(__dirname, "../abis/SchemaRegistry.json");
    const schemaRegistryAbi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const schemaRegistry = await hre.ethers.getContractAt(schemaRegistryAbi, schemaRegistryAddress, signer);

    const resolverAddress = taskArgs.resolver || hre.ethers.ZeroAddress;
    const revocable = taskArgs.revocable !== "false";

    console.log(`\nSchema: ${taskArgs.schema}`);
    console.log(`Resolver: ${resolverAddress}`);
    console.log(`Revocable: ${revocable}`);

    const tx = await schemaRegistry.register(
      taskArgs.schema,
      resolverAddress,
      revocable
    );

    console.log(`\nTransaction hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt?.blockNumber}`);

    // Get schema UID from event
    const event = receipt?.logs.find((log: any) => {
      try {
        return schemaRegistry.interface.parseLog(log)?.name === "Registered";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsedEvent = schemaRegistry.interface.parseLog(event);
      const schemaUID = parsedEvent?.args.uid;
      console.log(`\n📋 Schema UID: ${schemaUID}`);
      console.log(`\nUse this UID when creating attestations with this schema.`);
    }
  });
