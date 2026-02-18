import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { run } from "hardhat";
import { runHardhatTask } from "./helpers/runHardhatTask";

const TASK_NAME = "generate-bas-object";

describe("generate-bas-object task", function () {
  const schemasDir = path.join(__dirname, "schemas");
  const generatedDir = path.join(__dirname, "..", "generated");
  let testOutputFile: string | null = null;

  before(() => {
    if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir);
  });

  afterEach(() => {
    // Clean up any files created during tests, even if tests fail
    if (testOutputFile && fs.existsSync(testOutputFile)) {
      fs.unlinkSync(testOutputFile);
      testOutputFile = null;
    }
  });

  it("should generate BAS object for all supported types and use schema title as name", function () {
    const schemaPath = path.join(schemasDir, "all_types.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "AllTypes.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.name).to.equal("AllTypes");
    expect(basObj.schema).to.include("string stringField");
    expect(basObj.schema).to.include("uint256 uint64Field");
    expect(basObj.schema).to.include("bool boolField");
    expect(basObj.schema).to.include("string[] arrayField");
    expect(basObj.schema).to.include("string optionalField");
  });

  it("should handle array types correctly", function () {
    const schemaPath = path.join(schemasDir, "arrays.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "Arrays.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.include("string[] stringArray");
    expect(basObj.schema).to.include("uint256[] integerArray");
    expect(basObj.schema).to.include("bool[] booleanArray");
    expect(basObj.schema).to.include("string[] nullableArray");
  });

  it("should fail when schema has no top-level properties (shared definitions file)", function () {
    const schemaPath = path.join(schemasDir, "no_value_type.schema.json");
    const error = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`, { expectError: true });
    expect(error).to.include("no top-level properties");
    testOutputFile = null;
  });

  it("should fail if schema has no title and no --name is provided", function () {
    const schemaPath = path.join(schemasDir, "missing_name_version.schema.json");
    const error = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`, { expectError: true });
    expect(error).to.include("does not have a title property");
    // No file is created in this test case
    testOutputFile = null;
  });

  it("should use --name if provided for schema with no title", function () {
    const schemaPath = path.join(schemasDir, "missing_name_version.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath} --name CustomName`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "CustomName.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.name).to.equal("CustomName");
  });

  it("should error if --schema is missing", function () {
    const error = runHardhatTask(TASK_NAME, "", { expectError: true });
    expect(error).to.include("expects a value, but none was passed");
    // No file is created in this test case
    testOutputFile = null;
  });

  it("should use --name if provided", function () {
    const schemaPath = path.join(schemasDir, "all_types.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath} --name CustomName`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "CustomName.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.name).to.equal("CustomName");
  });

  it("should not include resolver in generated output", function () {
    const schemaPath = path.join(schemasDir, "with_resolver.schema.json");
    runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    testOutputFile = path.join(generatedDir, "WithResolver.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj).to.not.have.property("resolver");
  });

  it("should fail with parse/JSON error when schema file is invalid JSON", function () {
    const invalidPath = path.join(__dirname, "fixtures", "invalid.json");
    const error = runHardhatTask(TASK_NAME, `--schema ${invalidPath}`, { expectError: true });
    expect(error).to.satisfy(
      (msg: string) => /parse|JSON|Unexpected|invalid/i.test(msg),
      "expected error message to mention parse or JSON"
    );
    testOutputFile = null;
  });

  it("should fail when schema file path does not exist", function () {
    const error = runHardhatTask(TASK_NAME, "--schema nonexistent/schema.schema.json", { expectError: true });
    expect(error).to.include("not found");
    testOutputFile = null;
  });

  it("should include reserved field and log unused when only unused (x-oma3-skip-reason)", function () {
    const schemaPath = path.join(schemasDir, "unused_only.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    expect(output).to.include("Including reserved field");
    expect(output).to.include("x-oma3-skip-reason: unused");
    const outPath = path.join(generatedDir, "UnusedOnly.bas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(basObj.schema).to.include("reserved");
    testOutputFile = outPath;
  });

  it("should hit unused branch in-process (run()) for coverage", async function () {
    const schemaPath = path.join(schemasDir, "unused_only.schema.json");
    const outPath = path.join(generatedDir, "UnusedOnly.bas.json");
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
    const outPath = path.join(generatedDir, "SkipReasons.bas.json");
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

  it("should skip metadata/eas fields and include unused (x-oma3-skip-reason) in schema", function () {
    const schemaPath = path.join(schemasDir, "skip_reasons.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    expect(output).to.include("Skipping field");
    expect(output).to.include("Including reserved field");
    expect(output).to.include("x-oma3-skip-reason: unused");
    testOutputFile = path.join(generatedDir, "SkipReasons.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.include("value");
    expect(basObj.schema).to.include("reservedField");
    expect(basObj.schema).to.not.include("metadataField");
    expect(basObj.schema).to.not.include("easField");
  });

  it("should map string with bytes32 pattern to bytes32 and object type to string", function () {
    const schemaPath = path.join(schemasDir, "bytes32_and_object.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "Bytes32AndObject.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.include("bytes32 hashField");
    expect(basObj.schema).to.include("string objectField");
    expect(basObj.schema).to.not.include("badArray");
  });

  it("should cover array items type [string,null], array of objects, and unsupported scalar type", function () {
    const schemaPath = path.join(schemasDir, "coverage_branches_bas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "CoverageBranchesBas.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.include("string[] nullableStringArray");
    expect(basObj.schema).to.include("string[] objectArray");
    expect(basObj.schema).to.not.include("unsupportedScalar");
    expect(basObj.schema).to.not.include("arrayItemsNull");
  });

  it("should resolve array items via $ref and include string[] in schema", function () {
    const schemaPath = path.join(schemasDir, "array_items_ref_bas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    const outPath = path.join(generatedDir, "ArrayItemsRefBas.bas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(basObj.schema).to.include("string[] tags");
    testOutputFile = outPath;
  });

  it("should resolve external $ref and include referenced type in schema", function () {
    const schemaPath = path.join(schemasDir, "with_external_ref.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "WithExternalRef.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.include("refField");
  });

  it("should use cached external schema when same $ref is resolved twice", function () {
    const schemaPath = path.join(schemasDir, "cache_hit_bas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    const outPath = path.join(generatedDir, "CacheHitBas.bas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(basObj.schema).to.include("ref1");
    expect(basObj.schema).to.include("ref2");
    testOutputFile = outPath;
  });

  it("should warn and skip ref when external file exists but has invalid JSON", function () {
    const schemaPath = path.join(schemasDir, "parse_error_ref_bas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    const outPath = path.join(generatedDir, "ParseErrorRefBas.bas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(basObj.schema).to.include("validField");
    testOutputFile = outPath;
  });

  it("should complete and include valid fields when some $refs fail (nonexistent file, bad path, unsupported format)", function () {
    const schemaPath = path.join(schemasDir, "ref_warnings_bas.schema.json");
    const output = runHardhatTask(TASK_NAME, `--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    const outPath = path.join(generatedDir, "RefWarningsBas.bas.json");
    expect(fs.existsSync(outPath)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    expect(basObj.schema).to.include("validField");
    testOutputFile = outPath;
  });

  it("should create generated dir when it does not exist", function () {
    const tempCwd = path.join(__dirname, "temp-output-dir");
    if (!fs.existsSync(tempCwd)) {
      fs.mkdirSync(tempCwd, { recursive: true });
    }
    const output = runHardhatTask(TASK_NAME, "--schema ../schemas/all_types.schema.json", { cwd: tempCwd });
    expect(output).to.include("Successfully generated BAS object");
    const tempGenerated = path.join(tempCwd, "generated");
    expect(fs.existsSync(tempGenerated)).to.be.true;
    const outFile = path.join(tempGenerated, "AllTypes.bas.json");
    expect(fs.existsSync(outFile)).to.be.true;
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    if (fs.existsSync(tempGenerated)) fs.rmdirSync(tempGenerated);
  });
}); 