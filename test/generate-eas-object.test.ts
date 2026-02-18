/**
 * Tests for the generate-eas-object Hardhat task.
 * Runs the task via CLI and asserts output; no application code is modified.
 */
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { run } from "hardhat";
import { runHardhatTask } from "./helpers/runHardhatTask";

const TASK_NAME = "generate-eas-object";

describe("generate-eas-object task", function () {
  const schemasDir = path.join(__dirname, "schemas");
  const generatedDir = path.join(__dirname, "..", "generated");
  let testOutputFile: string | null = null;

  before(() => {
    if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir);
  });

  afterEach(() => {
    if (testOutputFile && fs.existsSync(testOutputFile)) {
      fs.unlinkSync(testOutputFile);
      testOutputFile = null;
    }
  });

  it("should generate EAS object for test schema (all_types)", function () {
    const schemaPath = path.join(schemasDir, "all_types.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    testOutputFile = path.join(generatedDir, "AllTypes.eas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(eas).to.have.property("name", "AllTypes");
    expect(eas).to.have.property("schema").that.is.a("string");
    expect(eas).to.have.property("revocable").that.is.a("boolean");
    expect(eas.schema).to.include("stringField");
    expect(eas.schema).to.include("uint64Field");
    expect(eas.schema).to.include("boolField");
    expect(eas.schema).to.include("arrayField");
  });

  it("should fail when schema has no top-level properties", function () {
    const schemaPath = path.join(schemasDir, "no_value_type.schema.json");
    const error = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`, { expectError: true });
    expect(error).to.include("no top-level properties");
    testOutputFile = null;
  });

  it("should fail when schema has no title and no --name", function () {
    const schemaPath = path.join(schemasDir, "missing_name_version.schema.json");
    const error = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`, { expectError: true });
    expect(error).to.include("does not have a title property");
    testOutputFile = null;
  });

  it("should use --name when provided for schema without title", function () {
    const schemaPath = path.join(schemasDir, "missing_name_version.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath} --name CustomEas`);
    expect(output).to.include("Successfully generated EAS object");
    testOutputFile = path.join(generatedDir, "CustomEas.eas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(eas.name).to.equal("CustomEas");
  });

  it("should error if --schema is missing", function () {
    const error = runHardhatTask(TASK_NAME, "", { expectError: true });
    expect(error).to.satisfy(
      (msg: string) => msg.includes("expects a value") || msg.includes("schema"),
      "expected error message to mention missing schema or expects a value"
    );
    testOutputFile = null;
  });

  it("should fail with parse/JSON error when schema file is invalid JSON", function () {
    const invalidPath = path.join(__dirname, "fixtures", "invalid.json");
    const error = runHardhatTask(TASK_NAME, `--schema ${invalidPath}`, { expectError: true });
    expect(error).to.satisfy(
      (msg: string) =>
        /parse|JSON|Unexpected|invalid/i.test(msg),
      "expected error message to mention parse or JSON"
    );
    testOutputFile = null;
  });

  it("should fail when schema file path does not exist", function () {
    const error = runHardhatTask(TASK_NAME, "--schema nonexistent/schema.schema.json", { expectError: true });
    expect(error).to.include("not found");
    testOutputFile = null;
  });

  it("should auto-detect revocable true from schema revoked field with x-oma3-skip-reason eas", function () {
    const schemaPath = path.join(schemasDir, "revocable_detected.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    expect(output).to.include("auto-detected from schema");
    testOutputFile = path.join(generatedDir, "RevocableDetected.eas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(eas.revocable).to.equal(true);
  });

  it("should use --revocable CLI override when provided", function () {
    const schemaPath = path.join(schemasDir, "all_types.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath} --name RevocableOverride --revocable true`);
    expect(output).to.include("Successfully generated EAS object");
    expect(output).to.include("from CLI override");
    testOutputFile = path.join(generatedDir, "RevocableOverride.eas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(eas.revocable).to.equal(true);
  });

  it("should skip metadata/eas and include unused (x-oma3-skip-reason) in schema", function () {
    const schemaPath = path.join(schemasDir, "skip_reasons.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    expect(output).to.include("Skipping field");
    expect(output).to.include("Including reserved field");
    expect(output).to.include("x-oma3-skip-reason: unused");
    testOutputFile = path.join(generatedDir, "SkipReasons.eas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(eas.schema).to.include("value");
    expect(eas.schema).to.include("reservedField");
    expect(eas.schema).to.not.include("metadataField");
    expect(eas.schema).to.not.include("easField");
  });

  it("should use cached external schema when same $ref is resolved twice", function () {
    const schemaPath = path.join(schemasDir, "cache_hit_eas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    const outPath = path.join(generatedDir, "CacheHitEas.eas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(eas.schema).to.include("ref1");
    expect(eas.schema).to.include("ref2");
    testOutputFile = outPath;
  });

  it("should warn and skip ref when external file exists but has invalid JSON", function () {
    const schemaPath = path.join(schemasDir, "parse_error_ref_eas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    const outPath = path.join(generatedDir, "ParseErrorRefEas.eas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(eas.schema).to.include("validField");
    testOutputFile = outPath;
  });

  it("should resolve array items via $ref and include string[] in schema", function () {
    const schemaPath = path.join(schemasDir, "array_items_ref_eas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    const outPath = path.join(generatedDir, "ArrayItemsRefEas.eas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(eas.schema).to.include("string[] tags");
    testOutputFile = outPath;
  });

  it("should complete and include valid fields when some $refs fail (nonexistent file, bad path, unsupported format)", function () {
    const schemaPath = path.join(schemasDir, "ref_warnings_eas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    const outPath = path.join(generatedDir, "RefWarningsEas.eas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(eas.schema).to.include("validField");
    testOutputFile = outPath;
  });

  it("should cover oneOf with then/else in collectTypesFromBranches", function () {
    const schemaPath = path.join(schemasDir, "conditional_branches_eas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    const outPath = path.join(generatedDir, "ConditionalBranchesEas.eas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(eas.schema).to.include("conditionalField");
    testOutputFile = outPath;
  });

  it("should map string with bytes32 pattern to bytes32 (pattern branch)", function () {
    const schemaPath = path.join(schemasDir, "bytes32_only_eas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    const outPath = path.join(generatedDir, "Bytes32OnlyEas.eas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(eas.schema).to.include("bytes32 hash");
    testOutputFile = outPath;
  });

  it("should include reserved field and log unused when only unused (x-oma3-skip-reason)", function () {
    const schemaPath = path.join(schemasDir, "unused_only.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    expect(output).to.include("Including reserved field");
    expect(output).to.include("x-oma3-skip-reason: unused");
    const outPath = path.join(generatedDir, "UnusedOnly.eas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(eas.schema).to.include("reserved");
    testOutputFile = outPath;
  });

  it("should hit unused branch in-process (run()) for coverage", async function () {
    const schemaPath = path.join(schemasDir, "unused_only.schema.json");
    const outPath = path.join(generatedDir, "UnusedOnly.eas.json");
    const logCalls: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logCalls.push(args.map(String).join(" "));
      origLog.apply(console, args);
    };
    try {
      await run(TASK_NAME, { schema: schemaPath });
      expect(fs.existsSync(outPath)).to.be.true;
      expect(logCalls.some((m) => m.includes("Including reserved field") && m.includes("unused"))).to.be.true;
      testOutputFile = outPath;
    } finally {
      console.log = origLog;
    }
  });

  it("should hit skip metadata/eas and unused branches in-process (skip_reasons)", async function () {
    const schemaPath = path.join(schemasDir, "skip_reasons.schema.json");
    const outPath = path.join(generatedDir, "SkipReasons.eas.json");
    const logCalls: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
    try {
      await run(TASK_NAME, { schema: schemaPath });
      expect(fs.existsSync(outPath)).to.be.true;
      expect(logCalls.some((m) => m.includes("Skipping field") && m.includes("x-oma3-skip-reason"))).to.be.true;
      expect(logCalls.some((m) => m.includes("Including reserved field") && m.includes("unused"))).to.be.true;
      testOutputFile = outPath;
    } finally {
      console.log = origLog;
    }
  });

  it("should map hashField and objectField from bytes32_and_object schema", function () {
    const schemaPath = path.join(schemasDir, "bytes32_and_object.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    testOutputFile = path.join(generatedDir, "Bytes32AndObject.eas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(eas.schema).to.include("hashField");
    expect(eas.schema).to.include("objectField");
  });

  it("should cover array items type [null] and array without valid items type (skipped)", function () {
    const schemaPath = path.join(schemasDir, "coverage_branches_eas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated EAS object");
    testOutputFile = path.join(generatedDir, "CoverageBranchesEas.eas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const eas = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(eas.schema).to.not.include("arrayItemsNull");
    expect(eas.schema).to.not.include("arrayItemsEmptyType");
  });

  it("should create generated dir when it does not exist", function () {
    const tempCwd = path.join(__dirname, "temp-output-dir");
    if (!fs.existsSync(tempCwd)) {
      fs.mkdirSync(tempCwd, { recursive: true });
    }
    const output = runHardhatTask(TASK_NAME, "--schema ../schemas/all_types.schema.json", { cwd: tempCwd });
    expect(output).to.include("Successfully generated EAS object");
    const tempGenerated = path.join(tempCwd, "generated");
    expect(fs.existsSync(tempGenerated)).to.be.true;
    const outFile = path.join(tempGenerated, "AllTypes.eas.json");
    expect(fs.existsSync(outFile)).to.be.true;
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    if (fs.existsSync(tempGenerated)) fs.rmdirSync(tempGenerated);
  });
});
