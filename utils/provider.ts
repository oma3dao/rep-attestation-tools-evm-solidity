import { ethers as ethersLib, Provider as EthersProvider } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Returns a provider and signer for the current Hardhat environment.
 * - For local/hardhat/localhost, uses hre.ethers.provider and hre.ethers.getSigners()[0].
 * - For other networks, uses ethers.js JsonRpcProvider and Wallet with PRIVATE_KEY from env.
 *
 * @param hre HardhatRuntimeEnvironment
 */
export async function getProviderAndSigner(hre: HardhatRuntimeEnvironment) {
  let provider: EthersProvider;
  let signer: ethersLib.Signer;

  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    provider = hre.ethers.provider;
    // HardhatEthersSigner is compatible for most uses; cast as ethers.Signer for type compatibility
    signer = (await hre.ethers.getSigners())[0] as unknown as ethersLib.Signer;
  } else {
    const rpcUrl = (hre.network.config as any).url;
    provider = new ethersLib.JsonRpcProvider(rpcUrl);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("No PRIVATE_KEY found in environment. Make sure it is loaded from your .ssh/test-evm-deployment-key or .env file.");
    }
    signer = new ethersLib.Wallet(privateKey, provider);
  }

  return { provider, signer };
} 