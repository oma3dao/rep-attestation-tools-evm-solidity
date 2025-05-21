import { expect } from "chai";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const TASK_CMD = "npx hardhat generate-bas-object";

function runTask(args: string, opts: { expectError?: boolean } = {}) {
  try {
    const output = execSync(`${TASK_CMD} ${args}`, { encoding: "utf-8" });
    if (opts.expectError) throw new Error("Expected error, but task succeeded");
    return output;
  } catch (err: any) {
    if (opts.expectError) return err.message;
    throw err;
  }
}

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

  it("should generate BAS object for all supported types", function () {
    const schemaPath = path.join(schemasDir, "all_types.schema.json");
    const output = runTask(`--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "AllTypes.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.include("string stringField");
    expect(basObj.schema).to.include("uint256 uint64Field");
    expect(basObj.schema).to.include("bool boolField");
    expect(basObj.schema).to.include("string[] arrayField");
    expect(basObj.schema).to.include("string optionalField");
    expect(basObj.resolver).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should handle array types correctly", function () {
    const schemaPath = path.join(schemasDir, "arrays.schema.json");
    const output = runTask(`--schema ${schemaPath}`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "Arrays.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.include("string[] stringArray");
    expect(basObj.schema).to.include("uint256[] integerArray");
    expect(basObj.schema).to.include("bool[] booleanArray");
    expect(basObj.schema).to.include("string[] nullableArray");
  });

  it("should handle an empty schema object gracefully", function () {
    const schemaPath = path.join(schemasDir, "no_value_type.schema.json");
    const output = runTask(`--schema ${schemaPath}`);
    testOutputFile = path.join(generatedDir, "NoValueType.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.schema).to.equal("");
    expect(basObj.resolver).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should fail if schema has no title and no --name is provided", function () {
    const schemaPath = path.join(schemasDir, "missing_name_version.schema.json");
    const error = runTask(`--schema ${schemaPath}`, { expectError: true });
    expect(error).to.include("does not have a title property");
    // No file is created in this test case
    testOutputFile = null;
  });

  it("should use --name if provided for schema with no title", function () {
    const schemaPath = path.join(schemasDir, "missing_name_version.schema.json");
    const output = runTask(`--schema ${schemaPath} --name CustomName`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "CustomName.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.name).to.equal("CustomName");
    expect(basObj.resolver).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should error if --schema is missing", function () {
    const error = runTask("", { expectError: true });
    expect(error).to.include("expects a value, but none was passed");
    // No file is created in this test case
    testOutputFile = null;
  });

  it("should use --name if provided", function () {
    const schemaPath = path.join(schemasDir, "all_types.schema.json");
    const output = runTask(`--schema ${schemaPath} --name CustomName`);
    expect(output).to.include("Successfully generated BAS object");
    testOutputFile = path.join(generatedDir, "CustomName.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.name).to.equal("CustomName");
    expect(basObj.resolver).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should use schema title if --name is not provided", function () {
    const schemaPath = path.join(schemasDir, "all_types.schema.json");
    runTask(`--schema ${schemaPath}`);
    testOutputFile = path.join(generatedDir, "AllTypes.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.name).to.equal("AllTypes");
    expect(basObj.resolver).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should set default resolver when not specified", function () {
    const schemaPath = path.join(schemasDir, "with_resolver.schema.json");
    runTask(`--schema ${schemaPath}`);
    testOutputFile = path.join(generatedDir, "WithResolver.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.resolver).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should allow setting custom resolver with --resolver", function () {
    const schemaPath = path.join(schemasDir, "with_resolver.schema.json");
    const customResolver = "0x0000000000000000000000000000000000000123";
    runTask(`--schema ${schemaPath} --resolver ${customResolver}`);
    testOutputFile = path.join(generatedDir, "WithResolver.bas.json");
    expect(fs.existsSync(testOutputFile)).to.be.true;
    const basObj = JSON.parse(fs.readFileSync(testOutputFile, "utf-8"));
    expect(basObj.resolver).to.equal(customResolver);
  });
}); 