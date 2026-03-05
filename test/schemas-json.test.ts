/**
 * Tests for schemas in schemas-json/ (structure, required fields, x-oma3 extensions).
 * No application code is modified; we only assert on existing schema files.
 */
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

const SCHEMAS_DIR = path.join(__dirname, "..", "schemas-json");

function listSchemaFiles(): string[] {
  if (!fs.existsSync(SCHEMAS_DIR)) return [];
  return fs.readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".schema.json"));
}

function loadSchema(filename: string): any {
  const filePath = path.join(SCHEMAS_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filename}: ${(e as Error).message}`);
  }
}

describe("schemas-json", function () {
  describe("all schema files", function () {
    it("should have valid JSON in every .schema.json file", function () {
      const files = listSchemaFiles();
      expect(files.length).to.be.greaterThan(0);
      for (const file of files) {
        expect(() => loadSchema(file)).to.not.throw();
      }
    });

    it("each schema should have $schema; attestation schemas should have type and properties", function () {
      const files = listSchemaFiles();
      for (const file of files) {
        const schema = loadSchema(file);
        expect(schema, `${file} $schema`).to.have.property("$schema");
        expect(schema.$schema).to.be.a("string");
        // common.schema.json is a $defs-only file, not an attestation schema
        if (file === "common.schema.json") {
          expect(schema, `${file} $defs`).to.have.property("$defs");
          continue;
        }
        expect(schema, `${file} type`).to.have.property("type");
        expect(schema.type).to.equal("object");
        expect(schema, `${file} properties`).to.have.property("properties");
        expect(schema.properties).to.be.an("object");
      }
    });

    it("each schema should have $id and title", function () {
      const files = listSchemaFiles();
      for (const file of files) {
        const schema = loadSchema(file);
        expect(schema, `${file} $id`).to.have.property("$id");
        expect(schema.$id).to.be.a("string");
        expect(schema, `${file} title`).to.have.property("title");
        expect(schema.title).to.be.a("string");
      }
    });

    it("each schema with required array should only reference existing properties", function () {
      const files = listSchemaFiles();
      for (const file of files) {
        const schema = loadSchema(file);
        if (!Array.isArray(schema.required)) continue;
        const props = Object.keys(schema.properties || {});
        for (const req of schema.required) {
          expect(props, `${file} required "${req}" must exist in properties`).to.include(req);
        }
      }
    });
  });

  describe("controller-witness.schema.json", function () {
    const FILE = "controller-witness.schema.json";

    it("should have required: attester, subject, controller, method, observedAt", function () {
      const schema = loadSchema(FILE);
      const required = schema.required;
      expect(required).to.be.an("array");
      expect(required).to.include("attester");
      expect(required).to.include("subject");
      expect(required).to.include("controller");
      expect(required).to.include("method");
      expect(required).to.include("observedAt");
    });

    it("controller-witness required array should have exactly 5 elements: attester, subject, controller, method, observedAt", function () {
      const schema = loadSchema(FILE);
      const required = schema.required;
      expect(required).to.be.an("array");
      expect(required).to.have.lengthOf(5);
      expect(required).to.have.members([
        "attester",
        "subject",
        "controller",
        "method",
        "observedAt",
      ]);
    });

    it("should have method enum: dns-txt, did-json, social-profile, manual", function () {
      const schema = loadSchema(FILE);
      const methodProp = schema.properties?.method;
      expect(methodProp).to.exist;
      expect(methodProp.enum).to.deep.equal(["dns-txt", "did-json", "social-profile", "manual"]);
    });

    it("should have subject and controller as DID format with pattern", function () {
      const schema = loadSchema(FILE);
      expect(schema.properties?.subject?.format).to.equal("did");
      expect(schema.properties?.subject?.pattern).to.be.a("string").that.includes("did:");
      expect(schema.properties?.controller?.format).to.equal("did");
      expect(schema.properties?.controller?.pattern).to.be.a("string").that.includes("did:");
    });

    it("should have observedAt as integer with minimum 0", function () {
      const schema = loadSchema(FILE);
      const observedAt = schema.properties?.observedAt;
      expect(observedAt?.type).to.equal("integer");
      expect(observedAt?.minimum).to.equal(0);
    });

    it("should not have x-oma3-witness (it is the witness attestation itself)", function () {
      const schema = loadSchema(FILE);
      expect(schema).to.not.have.property("x-oma3-witness");
    });

    it("should have additionalProperties false", function () {
      const schema = loadSchema(FILE);
      expect(schema.additionalProperties).to.equal(false);
    });
  });

  describe("key-binding.schema.json (x-oma3-witness)", function () {
    const FILE = "key-binding.schema.json";

    it("should have x-oma3-witness with subjectField and controllerField", function () {
      const schema = loadSchema(FILE);
      expect(schema).to.have.property("x-oma3-witness");
      expect(schema["x-oma3-witness"]).to.have.property("subjectField", "subject");
      expect(schema["x-oma3-witness"]).to.have.property("controllerField", "keyId");
    });

    it("subjectField and controllerField should exist in schema properties", function () {
      const schema = loadSchema(FILE);
      const w = schema["x-oma3-witness"];
      expect(schema.properties).to.have.property(w.subjectField);
      expect(schema.properties).to.have.property(w.controllerField);
    });
  });

  describe("linked-identifier.schema.json (x-oma3-witness)", function () {
    const FILE = "linked-identifier.schema.json";

    it("should have x-oma3-witness with subjectField and controllerField", function () {
      const schema = loadSchema(FILE);
      expect(schema).to.have.property("x-oma3-witness");
      expect(schema["x-oma3-witness"]).to.have.property("subjectField", "subject");
      expect(schema["x-oma3-witness"]).to.have.property("controllerField", "linkedId");
    });

    it("subjectField and controllerField should exist in schema properties", function () {
      const schema = loadSchema(FILE);
      const w = schema["x-oma3-witness"];
      expect(schema.properties).to.have.property(w.subjectField);
      expect(schema.properties).to.have.property(w.controllerField);
    });
  });

  describe("common.schema.json", function () {
    const FILE = "common.schema.json";

    it("should have $defs with Proof or other shared definitions", function () {
      const schema = loadSchema(FILE);
      expect(schema).to.have.property("$defs");
      expect(schema.$defs).to.be.an("object");
      expect(Object.keys(schema.$defs).length).to.be.greaterThan(0);
    });
  });
});
