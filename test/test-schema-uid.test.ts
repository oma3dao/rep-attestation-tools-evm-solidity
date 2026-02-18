/**
 * Tests for the test-schema-uid Hardhat task.
 * Runs the task via CLI; no application code is modified.
 */
import { expect } from "chai";
import * as path from "path";
import { runHardhatTask } from "./helpers/runHardhatTask";

const TASK_NAME = "test-schema-uid";

describe("test-schema-uid task", function () {
  it("should run with no file and output BAS example UID and Match: true", function () {
    const output = runHardhatTask(TASK_NAME, "");
    const expectedUID = "0xe97c0fcc6c37e9f782fd9917e3fa6d22ca1b52d8d936002be4babb55e82dadab";
    expect(output).to.include("Using BAS example schema");
    expect(output).to.include("Calculated UID:");
    expect(output).to.include(expectedUID);
    expect(output).to.match(/Match:\s*true/);
  });

  it("should run with --file (non-deployed schema) and output calculated UID", function () {
    const schemaPath = path.join(__dirname, "fixtures", "sample-uid.bas.json");
    const output = runHardhatTask(TASK_NAME, `--file ${schemaPath}`);
    expect(output).to.include("Calculated UID:");
    expect(output).to.include("0x");
    expect(output).to.include("Schema:");
  });

  it("should exit with error when --file path does not exist", function () {
    const error = runHardhatTask(TASK_NAME, "--file nonexistent/file.bas.json", { expectError: true });
    expect(error).to.include("File not found");
  });

  it("should run with --file (deployed schema) and resolve original schema file", function () {
    const deployedPath = path.join("test", "fixtures", "Ref.deployed.bastest.json");
    const output = runHardhatTask(TASK_NAME, `--file ${deployedPath}`);
    expect(output).to.include("Found deployed schema file with UID");
    expect(output).to.include("Found original schema file");
    expect(output).to.include("Calculated UID:");
    expect(output).to.match(/Match:\s*true/);
  });

  it("should exit with error when deployed file has no matching base schema file", function () {
    const deployedPath = path.join("test", "fixtures", "Orphan.deployed.bastest.json");
    const error = runHardhatTask(TASK_NAME, `--file ${deployedPath}`, { expectError: true });
    expect(error).to.include("Could not find the original schema file");
  });
});
