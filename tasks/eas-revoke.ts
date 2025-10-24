import { task } from "hardhat/config";
import { getDeployerSigner } from "./shared/signer-utils";
import { NETWORK_CONTRACTS } from "../hardhat.config";
import * as fs from "fs";
import * as path from "path";

task("eas-revoke", "Revoke an attestation")
  .addParam("schema", "Schema UID (bytes32)")
  .addParam("uid", "Attestation UID to revoke (bytes32)")
  .addOptionalParam("value", "ETH value to send (default: 0)")
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name as keyof typeof NETWORK_CONTRACTS;
    const easAddress = NETWORK_CONTRACTS[networkName]?.easContract;

    if (!easAddress || easAddress === "0x") {
      throw new Error(`EAS contract not configured for network ${networkName}`);
    }

    const { signer, address: signerAddress } = await getDeployerSigner(hre);
    console.log(`Revoking attestation with signer: ${signerAddress}`);
    console.log(`EAS: ${easAddress}`);

    // Load EAS ABI
    const abiPath = path.join(__dirname, "../abis/EAS.json");
    const easAbi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const eas = await hre.ethers.getContractAt(easAbi, easAddress, signer);

    // Check if attestation exists and is revocable
    const attestation = await eas.getAttestation(taskArgs.uid);
    
    if (attestation.uid === hre.ethers.ZeroHash) {
      throw new Error(`Attestation ${taskArgs.uid} does not exist`);
    }

    if (!attestation.revocable) {
      throw new Error(`Attestation ${taskArgs.uid} is not revocable`);
    }

    if (attestation.revocationTime !== 0n) {
      console.log(`⚠️  Attestation was already revoked at ${new Date(Number(attestation.revocationTime) * 1000).toISOString()}`);
      return;
    }

    console.log(`\nRevoking attestation:`);
    console.log(`Schema: ${taskArgs.schema}`);
    console.log(`UID: ${taskArgs.uid}`);

    const tx = await eas.revoke({
      schema: taskArgs.schema,
      data: {
        uid: taskArgs.uid,
        value: taskArgs.value || 0
      }
    });

    console.log(`\nTransaction hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt?.blockNumber}`);
    console.log(`\n✅ Attestation revoked successfully`);
  });
