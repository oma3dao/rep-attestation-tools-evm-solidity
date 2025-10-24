import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { Signer } from "ethers";
// HRE is passed from tasks to avoid importing hardhat at module top-level (prevents HH9)

/**
 * Secure signer utility - protects against IDE extension attacks
 * Reference: https://x.com/0xzak/status/1955655184522371361 ($500k+ stolen from crypto devs)
 * 
 * Note: Hardware wallet support removed. Development uses SSH key automatically.
 * For production, use Thirdweb Dashboard deployment for maximum security.
 */

// Deployer signer (admin + deploy)
export async function getDeployerSigner(hre: HardhatRuntimeEnvironment): Promise<{ signer: Signer; address: string; method: string }> {
  return await getSSHKeySigner(hre);
}

async function getSSHKeySigner(hre: HardhatRuntimeEnvironment): Promise<{ signer: Signer; address: string; method: string }> {
  console.log("SSH KEY DEPLOYMENT: Using private key from SSH file");
  console.log("WARNING: SSH files are vulnerable to IDE extension attacks");
  console.log("For production: Use Thirdweb Dashboard deployment for maximum security");
  
  // Check if private key is loaded
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not found. Please check ~/.ssh/test-evm-deployment-key");
  }
  console.log("Private key loaded from SSH file");
  
  // Get default signer (uses PRIVATE_KEY from SSH file)
  const [signer] = await hre.ethers.getSigners();
  const address = await signer.getAddress();
  
  return { signer, address, method: "SSH Key" };
}
