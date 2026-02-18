/**
 * Unit tests for utils/easTools.ts.
 * Shared UID formula tests are in test/helpers/uid-formula-shared.ts.
 * verifySchemaExists and getSchemaDetails use a mock registry (no network).
 */
import { expect } from "chai";
import { ethers } from "ethers";
import {
  calculateSchemaUID,
  formatSchemaUID,
  verifySchemaExists,
  getSchemaDetails,
} from "../utils/easTools";
import { runSharedUidFormulaTests } from "./helpers/uid-formula-shared";

describe("utils/easTools", function () {
  runSharedUidFormulaTests(calculateSchemaUID, formatSchemaUID);

  describe("verifySchemaExists (mock registry)", function () {
    it("should return true when getSchema returns a schema with non-zero uid", async function () {
      const uid = "0x" + "a".repeat(64);
      const mockRegistry = {
        getSchema: async () => ({ uid, schema: "string x", revocable: true }),
      };
      const result = await verifySchemaExists(mockRegistry as any, uid);
      expect(result).to.equal(true);
    });

    it("should return false when getSchema returns schema with ZeroHash uid", async function () {
      const mockRegistry = {
        getSchema: async () => ({ uid: ethers.ZeroHash, schema: "", revocable: false }),
      };
      const result = await verifySchemaExists(mockRegistry as any, ethers.ZeroHash);
      expect(result).to.equal(false);
    });

    it("should return false when getSchema throws", async function () {
      const mockRegistry = { getSchema: async () => { throw new Error("not found"); } };
      const result = await verifySchemaExists(mockRegistry as any, "0xabc");
      expect(result).to.equal(false);
    });
  });

  describe("getSchemaDetails (mock registry)", function () {
    it("should return schema when getSchema succeeds", async function () {
      const details = { uid: "0xabc", schema: "string x", revocable: true };
      const mockRegistry = { getSchema: async () => details };
      const result = await getSchemaDetails(mockRegistry as any, "0xabc");
      expect(result).to.deep.equal(details);
    });

    it("should return null when getSchema throws", async function () {
      const mockRegistry = { getSchema: async () => { throw new Error("not found"); } };
      const result = await getSchemaDetails(mockRegistry as any, "0xabc");
      expect(result).to.equal(null);
    });
  });
});
