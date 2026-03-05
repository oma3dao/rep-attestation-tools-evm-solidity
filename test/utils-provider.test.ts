/**
 * Unit tests for utils/provider.ts (getProviderAndSigner).
 * Uses a mock HardhatRuntimeEnvironment only; no network or app code changes.
 */
import { expect } from "chai";
import { getProviderAndSigner } from "../utils/provider";

describe("utils/provider", function () {
  describe("getProviderAndSigner (mock HRE)", function () {
    it("should return provider and signer for hardhat or localhost network", async function () {
      const mockSigner = {
        getAddress: async () => "0x1234567890123456789012345678901234567890",
      };
      const mockProvider = {};
      const mockHre = {
        network: { name: "hardhat" },
        ethers: {
          provider: mockProvider,
          getSigners: async () => [mockSigner],
        },
      };
      const result = await getProviderAndSigner(mockHre as any);
      expect(result.provider).to.equal(mockProvider);
      expect(result.signer).to.equal(mockSigner);
    });

    it("should throw when network is not hardhat/localhost and PRIVATE_KEY is missing", async function () {
      const origPriv = process.env.PRIVATE_KEY;
      delete process.env.PRIVATE_KEY;
      const mockHre = {
        network: { name: "omachainTestnet", config: { url: "https://rpc.example.com" } },
      };
      try {
        await getProviderAndSigner(mockHre as any);
        expect.fail("Expected getProviderAndSigner to throw");
      } catch (err: any) {
        expect(err.message).to.include("PRIVATE_KEY");
      } finally {
        if (origPriv !== undefined) process.env.PRIVATE_KEY = origPriv;
      }
    });

    it("should return JsonRpcProvider and Wallet when network is not hardhat/localhost and PRIVATE_KEY is set", async function () {
      const origPriv = process.env.PRIVATE_KEY;
      const testKey = "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.PRIVATE_KEY = testKey;
      const mockHre = {
        network: { name: "omachainTestnet", config: { url: "https://rpc.example.com" } },
      };
      try {
        const result = await getProviderAndSigner(mockHre as any);
        expect(result.provider).to.exist;
        expect(result.signer).to.exist;
        const { Wallet } = await import("ethers");
        expect(result.signer).to.be.instanceOf(Wallet);
      } finally {
        if (origPriv !== undefined) process.env.PRIVATE_KEY = origPriv;
        else delete process.env.PRIVATE_KEY;
      }
    });
  });
});
