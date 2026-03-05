/**
 * Tests for the eas-encode-data Hardhat task.
 * Encoding is done locally (no network). Runs task via CLI and asserts output.
 */
import { expect } from "chai";
import { AbiCoder } from "ethers";
import { runHardhatTask } from "./helpers/runHardhatTask";

const TASK_NAME = "eas-encode-data";

describe("eas-encode-data task", function () {
  it("should encode string and uint256", function () {
    const output = runHardhatTask(TASK_NAME, '--types "string,uint256" --values "hello,42"');
    expect(output).to.include("Encoded data:");
    expect(output).to.include("0x");
    const hexMatch = output.match(/0x[a-fA-F0-9]+/);
    expect(hexMatch).to.not.be.null;
    expect(hexMatch![0].length).to.be.greaterThan(10, "encoded data should be non-trivial");
  });

  it("should produce known-good ABI encoding for string,uint256 with hello,42", function () {
    const expectedHex = AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256"],
      ["hello", 42]
    );
    const output = runHardhatTask(TASK_NAME, '--types "string,uint256" --values "hello,42"');
    const hexMatch = output.match(/0x[a-fA-F0-9]+/);
    expect(hexMatch).to.not.be.null;
    expect(hexMatch![0]).to.equal(expectedHex, "task output should match ethers ABI encoding");
  });

  it("should encode bool", function () {
    const output = runHardhatTask(TASK_NAME, '--types "bool" --values "true"');
    expect(output).to.include("0x");
  });

  it("should encode address", function () {
    const output = runHardhatTask(
      TASK_NAME,
      '--types "address" --values "0x0000000000000000000000000000000000000000"'
    );
    expect(output).to.include("0x");
  });

  it("should fail when type and value count mismatch", function () {
    const error = runHardhatTask(
      TASK_NAME,
      '--types "string,uint256" --values "onlyOne"',
      { expectError: true }
    );
    expect(error).to.include("doesn't match value count");
  });

  it("should encode bytes32 (with 0x prefix)", function () {
    const output = runHardhatTask(
      TASK_NAME,
      '--types "bytes32" --values "0x0000000000000000000000000000000000000000000000000000000000000001"'
    );
    expect(output).to.include("0x");
    expect(output).to.include("Encoding data:");
  });

  it("should encode bytes32 (without 0x prefix adds it)", function () {
    const output = runHardhatTask(
      TASK_NAME,
      '--types "bytes32" --values "0000000000000000000000000000000000000000000000000000000000000001"'
    );
    expect(output).to.include("0x");
  });

  it("should encode int type", function () {
    const output = runHardhatTask(TASK_NAME, '--types "int256" --values "-42"');
    expect(output).to.include("0x");
  });
});
