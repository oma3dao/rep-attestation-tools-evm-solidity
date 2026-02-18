/**
 * Tests for utils/constants.ts.
 * No application code is modified.
 */
import { expect } from "chai";
import { ZERO_ADDRESS } from "../utils/constants";

describe("utils/constants", function () {
  describe("ZERO_ADDRESS", function () {
    it("should be 42 characters (0x + 40 hex)", function () {
      expect(ZERO_ADDRESS).to.have.lengthOf(42);
      expect(ZERO_ADDRESS).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should be the zero address", function () {
      expect(ZERO_ADDRESS).to.equal("0x0000000000000000000000000000000000000000");
    });
  });
});
