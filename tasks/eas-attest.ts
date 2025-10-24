import { task } from "hardhat/config";
import { getDeployerSigner } from "./shared/signer-utils";
import { NETWORK_CONTRACTS } from "../hardhat.config";
import * as fs from "fs";
import * as path from "path";

task("eas-attest", "Create an attestation")
  .addParam("schema", "Schema UID (bytes32)")
  .addParam("recipient", "Recipient address")
  .addOptionalParam("data", "ABI-encoded attestation data (use with --types and --values for auto-encoding)")
  .addOptionalParam("types", "Comma-separated types for encoding (e.g., 'string,uint8')")
  .addOptionalParam("values", "Comma-separated values for encoding (e.g., 'Alice,95')")
  .addOptionalParam("expiration", "Expiration timestamp (default: 0 = no expiration)")
  .addOptionalParam("refuid", "Referenced attestation UID (default: zero)")
  .addOptionalParam("revocable", "Whether this attestation can be revoked (default: true)")
  .addOptionalParam("value", "ETH value to send (default: 0)")
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name as keyof typeof NETWORK_CONTRACTS;
    const easAddress = NETWORK_CONTRACTS[networkName]?.easContract;

    if (!easAddress || easAddress === "0x") {
      throw new Error(`EAS contract not configured for network ${networkName}`);
    }

    const { signer, address: signerAddress } = await getDeployerSigner(hre);
    console.log(`Creating attestation with signer: ${signerAddress}`);
    console.log(`EAS: ${easAddress}`);

    // Load EAS ABI
    const abiPath = path.join(__dirname, "../abis/EAS.json");
    const easAbi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const eas = await hre.ethers.getContractAt(easAbi, easAddress, signer);

    // Encode data if types and values are provided
    let encodedData: string;
    if (taskArgs.types && taskArgs.values) {
      const types = taskArgs.types.split(",").map((t: string) => t.trim());
      const rawValues = taskArgs.values.split(",").map((v: string) => v.trim());
      
      if (types.length !== rawValues.length) {
        throw new Error(`Type count (${types.length}) doesn't match value count (${rawValues.length})`);
      }

      // Convert values to appropriate types
      const values = rawValues.map((value: string, index: number) => {
        const type = types[index];
        
        if (type.startsWith("uint") || type.startsWith("int")) {
          return BigInt(value);
        }
        if (type === "bool") {
          return value.toLowerCase() === "true";
        }
        if (type === "bytes32" || type === "address") {
          return value.startsWith("0x") ? value : `0x${value}`;
        }
        return value;
      });

      encodedData = hre.ethers.AbiCoder.defaultAbiCoder().encode(types, values);
      console.log(`Encoded data from types and values: ${encodedData}`);
    } else if (taskArgs.data) {
      encodedData = taskArgs.data;
    } else {
      throw new Error("Must provide either --data OR both --types and --values");
    }

    const attestationData = {
      recipient: taskArgs.recipient,
      expirationTime: taskArgs.expiration || 0,
      revocable: taskArgs.revocable !== "false",
      refUID: taskArgs.refuid || hre.ethers.ZeroHash,
      data: encodedData,
      value: taskArgs.value || 0
    };

    console.log(`\nAttestation Details:`);
    console.log(`Schema: ${taskArgs.schema}`);
    console.log(`Recipient: ${attestationData.recipient}`);
    console.log(`Data: ${attestationData.data}`);
    console.log(`Expiration: ${attestationData.expirationTime}`);
    console.log(`Revocable: ${attestationData.revocable}`);

    const tx = await eas.attest({
      schema: taskArgs.schema,
      data: attestationData
    });

    console.log(`\nTransaction hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt?.blockNumber}`);

    // Get attestation UID from event
    const event = receipt?.logs.find((log: any) => {
      try {
        return eas.interface.parseLog(log)?.name === "Attested";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsedEvent = eas.interface.parseLog(event);
      const attestationUID = parsedEvent?.args.uid;
      console.log(`\n✅ Attestation UID: ${attestationUID}`);
      console.log(`\nUse this UID to query or revoke the attestation.`);
    }
  });
