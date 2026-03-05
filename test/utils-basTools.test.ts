/**
 * Unit tests for utils/basTools.ts.
 * Shared UID formula tests are in test/helpers/uid-formula-shared.ts.
 * verifySchemaExists and getSchemaDetails use a mock registry (no network).
 */
import { expect } from "chai";
import {
  calculateSchemaUID,
  formatSchemaUID,
  verifySchemaExists,
  getSchemaDetails,
} from "../utils/basTools";
import { runSharedUidFormulaTests } from "./helpers/uid-formula-shared";

const ZERO = "0x0000000000000000000000000000000000000000";

describe("utils/basTools", function () {
  runSharedUidFormulaTests(calculateSchemaUID, formatSchemaUID);

  describe("verifySchemaExists (mock registry)", function () {
    it("should return true when getSchema returns a schema", async function () {
      const mockRegistry = {
        getSchema: async () => ({ uid: "0xabc", schema: "string x", revocable: true }),
      };
      const result = await verifySchemaExists(mockRegistry as any, "0xabc");
      expect(result).to.equal(true);
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

  describe("calculateSchemaUID (BAS-specific)", function () {
    it("should match documented BAS example from test-schema-uid task", function () {
      const schemaObject = {
        schema: "uint256 schemaId, string msg5, bool isActive, string[] tags, uint256[] scores, string optionalDescription, bool[] statusFlags",
        resolver: ZERO,
        revocable: true,
      };
      const calculated = calculateSchemaUID(
        schemaObject.schema,
        schemaObject.resolver,
        schemaObject.revocable
      );
      const formatted = formatSchemaUID(calculated).toLowerCase();
      const expected = "0xe97c0fcc6c37e9f782fd9917e3fa6d22ca1b52d8d936002be4babb55e82dadab";
      expect(formatted).to.equal(expected);
    });
  });
});
