/**
 * Tests for generated EAS schema files in generated/.
 * Asserts structure and that schema strings include expected fields from attestation schemas.
 * No application code is modified.
 */
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { runHardhatTask } from "./helpers/runHardhatTask";

const GENERATED_DIR = path.join(__dirname, "..", "generated");
const REQUIRED_EAS_FILES = ["_test-Controller-Witness.eas.json", "_test-Key-Binding.eas.json", "_test-Linked-Identifier.eas.json"];
const SCHEMAS_TO_GENERATE: [string, string][] = [
  ["schemas-json/controller-witness.schema.json", "_test-Controller-Witness"],
  ["schemas-json/key-binding.schema.json", "_test-Key-Binding"],
  ["schemas-json/linked-identifier.schema.json", "_test-Linked-Identifier"],
];

function listEasFiles(): string[] {
  if (!fs.existsSync(GENERATED_DIR)) return [];
  return fs.readdirSync(GENERATED_DIR).filter((f) => f.endsWith(".eas.json") && !f.includes(".deployed.") && !f.startsWith("_test-"));
}

function loadEas(filename: string): { name: string; schema: string; revocable: boolean } {
  const filePath = path.join(GENERATED_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const obj = JSON.parse(raw);
  return obj;
}

function ensureGeneratedEasFiles(): void {
  const missing = REQUIRED_EAS_FILES.filter((f) => !fs.existsSync(path.join(GENERATED_DIR, f)));
  if (missing.length === 0) return;
  if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
  for (const [schemaPath, name] of SCHEMAS_TO_GENERATE) {
    runHardhatTask("generate-eas-object", `--schema ${schemaPath} --name ${name}`);
  }
}

describe("generated EAS files", function () {
  before(function () {
    // Clean up any leftover test artifacts from a previous crashed run
    if (fs.existsSync(GENERATED_DIR)) {
      const leftover = fs.readdirSync(GENERATED_DIR).filter(f => f.startsWith('_test-'));
      for (const f of leftover) {
        fs.unlinkSync(path.join(GENERATED_DIR, f));
      }
    }
    ensureGeneratedEasFiles();
  });

  after(function () {
    // Clean up test-generated files
    if (fs.existsSync(GENERATED_DIR)) {
      const testFiles = fs.readdirSync(GENERATED_DIR).filter(f => f.startsWith('_test-'));
      for (const f of testFiles) {
        fs.unlinkSync(path.join(GENERATED_DIR, f));
      }
    }
  });

  describe("all .eas.json files (non-deployed)", function () {
    it("should have valid JSON with name, schema, revocable", function () {
      const files = listEasFiles();
      expect(files.length).to.be.greaterThan(0);
      for (const file of files) {
        const eas = loadEas(file);
        expect(eas, `${file} name`).to.have.property("name");
        expect(eas, `${file} schema`).to.have.property("schema");
        expect(eas, `${file} revocable`).to.have.property("revocable");
        expect(eas.name).to.be.a("string");
        expect(eas.schema).to.be.a("string");
        expect(eas.revocable).to.be.a("boolean");
      }
    });

    it("schema string should contain only expected EAS types (string, uint256, bool, arrays)", function () {
      const files = listEasFiles();
      const allowedTypes = ["string", "uint256", "bool", "string[]", "uint256[]", "bool[]"];
      for (const file of files) {
        const eas = loadEas(file);
        const parts = eas.schema.split(",").map((s: string) => s.trim().split(" ")[0]);
        for (const part of parts) {
          expect(allowedTypes, `${file} schema type "${part}"`).to.include(part);
        }
      }
    });
  });

  describe("Controller-Witness.eas.json", function () {
    const FILE = "Controller-Witness.eas.json";

    it("should have name Controller-Witness", function () {
      const eas = loadEas(FILE);
      expect(eas.name).to.equal("Controller-Witness");
    });

    it("schema string should include subject, controller, method, observedAt", function () {
      const eas = loadEas(FILE);
      expect(eas.schema).to.include("subject");
      expect(eas.schema).to.include("controller");
      expect(eas.schema).to.include("method");
      expect(eas.schema).to.include("observedAt");
    });

    it("should have revocable false per controller-witness design", function () {
      const eas = loadEas(FILE);
      expect(eas.revocable).to.equal(false);
    });
  });

  describe("Key-Binding.eas.json (witness subject/controller fields)", function () {
    const FILE = "Key-Binding.eas.json";

    it("schema string should include subject and keyId (controller field for witness)", function () {
      const eas = loadEas(FILE);
      expect(eas.schema).to.include("subject");
      expect(eas.schema).to.include("keyId");
    });
  });

  describe("Linked-Identifier.eas.json (witness subject/controller fields)", function () {
    const FILE = "Linked-Identifier.eas.json";

    it("schema string should include subject and linkedId (controller field for witness)", function () {
      const eas = loadEas(FILE);
      expect(eas.schema).to.include("subject");
      expect(eas.schema).to.include("linkedId");
    });
  });
});
