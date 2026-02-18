/**
 * Unit tests for tasks/shared/signer-utils.ts (getDeployerSigner).
 * Uses mock HRE and process.env only; no network or app code changes.
 */
import { expect } from "chai";
import { getDeployerSigner } from "../tasks/shared/signer-utils";

describe("tasks/shared/signer-utils", function () {
  describe("getDeployerSigner (mock HRE + env)", function () {
    it("should return signer, address, and method when PRIVATE_KEY is set", async function () {
      const origPriv = process.env.PRIVATE_KEY;
      process.env.PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
      const mockSigner = {
        getAddress: async () => "0x1234567890123456789012345678901234567890",
      };
      const mockHre = {
        ethers: { getSigners: async () => [mockSigner] },
      };
      try {
        const result = await getDeployerSigner(mockHre as any);
        expect(result.signer).to.equal(mockSigner);
        expect(result.address).to.equal("0x1234567890123456789012345678901234567890");
        expect(result.method).to.equal("SSH Key");
      } finally {
        if (origPriv !== undefined) process.env.PRIVATE_KEY = origPriv;
        else delete process.env.PRIVATE_KEY;
      }
    });

    it("should throw when PRIVATE_KEY is not set", async function () {
      const origPriv = process.env.PRIVATE_KEY;
      delete process.env.PRIVATE_KEY;
      const mockHre = { ethers: { getSigners: async () => [] } };
      try {
        await getDeployerSigner(mockHre as any);
        expect.fail("Expected getDeployerSigner to throw");
      } catch (err: any) {
        expect(err.message).to.include("Private key not found");
      } finally {
        if (origPriv !== undefined) process.env.PRIVATE_KEY = origPriv;
      }
    });
  });
});
