/**
 * Shared tests for the EAS/BAS schema UID formula (calculateSchemaUID + formatSchemaUID).
 * Both utils/easTools and utils/basTools use the same formula; this helper runs the common cases
 * so we don't duplicate them in two files.
 */
import { expect } from "chai";

const ZERO = "0x0000000000000000000000000000000000000000";

export type CalculateSchemaUID = (
  schema: string,
  resolverAddress: string,
  revocable: boolean
) => string;
export type FormatSchemaUID = (schemaUID: string) => string;

/**
 * Registers the shared UID formula tests inside the current describe block.
 * Call from utils-easTools.test.ts and utils-basTools.test.ts.
 */
export function runSharedUidFormulaTests(
  calculateSchemaUID: CalculateSchemaUID,
  formatSchemaUID: FormatSchemaUID
): void {
  describe("calculateSchemaUID (shared formula)", function () {
    it("should return a 66-character hex string (0x + 64 hex)", function () {
      const uid = calculateSchemaUID("string subject, string controller", ZERO, false);
      expect(uid).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(uid).to.have.lengthOf(66);
    });

    it("should be deterministic for same inputs", function () {
      const a = calculateSchemaUID("string x", ZERO, true);
      const b = calculateSchemaUID("string x", ZERO, true);
      expect(a).to.equal(b);
    });

    it("should differ when schema string differs", function () {
      const a = calculateSchemaUID("string a", ZERO, false);
      const b = calculateSchemaUID("string b", ZERO, false);
      expect(a).to.not.equal(b);
    });

    it("should differ when revocable differs", function () {
      const a = calculateSchemaUID("string x", ZERO, false);
      const b = calculateSchemaUID("string x", ZERO, true);
      expect(a).to.not.equal(b);
    });

    it("should differ when resolver address differs", function () {
      const other = "0x0000000000000000000000000000000000000001";
      const a = calculateSchemaUID("string x", ZERO, false);
      const b = calculateSchemaUID("string x", other, false);
      expect(a).to.not.equal(b);
    });
  });

  describe("formatSchemaUID (shared)", function () {
    it("should add 0x prefix when missing", function () {
      const raw = "a".repeat(64);
      expect(formatSchemaUID(raw)).to.equal("0x" + raw);
    });

    it("should leave 0x prefix when present", function () {
      const withPrefix = "0x" + "b".repeat(64);
      expect(formatSchemaUID(withPrefix)).to.equal(withPrefix);
    });

    it("should return empty string for empty input", function () {
      expect(formatSchemaUID("")).to.equal("");
    });
  });
}
