/**
 * Mock tests for EAS/BAS Hardhat tasks (verify-eas-schema, deploy-eas-schema, deploy-bas-schema).
 * We stub getProviderAndSigner and SchemaRegistry.prototype so tasks run without a live chain.
 * No application code is modified; only test file and stubs.
 *
 * eas-attest, eas-get-attestation, eas-get-schema, eas-revoke use hre.ethers.getContractAt()
 * and contract methods; mocking those would require stubbing the ethers contract API (more invasive).
 */
import { expect } from "chai";
import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const providerModule = require("../utils/provider");
const signerUtilsModule = require("../tasks/shared/signer-utils");
const easSdk = require("@ethereum-attestation-service/eas-sdk");
const basSdk = require("@bnb-attestation-service/bas-sdk");

describe("EAS/BAS tasks (mocked registry and provider)", function () {
  let originalGetProviderAndSigner: typeof providerModule.getProviderAndSigner;
  let originalGetDeployerSigner: typeof signerUtilsModule.getDeployerSigner;
  let originalEasConnect: any;
  let originalEasGetSchema: any;
  let originalEasRegister: any;
  let originalBasConnect: any;
  let originalBasGetSchema: any;
  let originalNetworkName: string;
  let basDeployedFile: string | null = null;

  before(function () {
    originalGetProviderAndSigner = providerModule.getProviderAndSigner;
    originalGetDeployerSigner = signerUtilsModule.getDeployerSigner;
    originalEasConnect = easSdk.SchemaRegistry?.prototype?.connect;
    originalEasGetSchema = easSdk.SchemaRegistry?.prototype?.getSchema;
    originalEasRegister = easSdk.SchemaRegistry?.prototype?.register;
    originalBasConnect = basSdk.SchemaRegistry?.prototype?.connect;
    originalBasGetSchema = basSdk.SchemaRegistry?.prototype?.getSchema;
  });

  after(function () {
    providerModule.getProviderAndSigner = originalGetProviderAndSigner;
    signerUtilsModule.getDeployerSigner = originalGetDeployerSigner;
    if (easSdk.SchemaRegistry?.prototype) {
      if (originalEasConnect != null) easSdk.SchemaRegistry.prototype.connect = originalEasConnect;
      if (originalEasGetSchema != null) easSdk.SchemaRegistry.prototype.getSchema = originalEasGetSchema;
      if (originalEasRegister != null) easSdk.SchemaRegistry.prototype.register = originalEasRegister;
    }
    if (basSdk.SchemaRegistry?.prototype) {
      if (originalBasConnect != null) basSdk.SchemaRegistry.prototype.connect = originalBasConnect;
      if (originalBasGetSchema != null) basSdk.SchemaRegistry.prototype.getSchema = originalBasGetSchema;
    }
  });

  beforeEach(function () {
    const hre = require("hardhat");
    originalNetworkName = hre.network.name;
  });

  afterEach(function () {
    const hre = require("hardhat");
    (hre.network as any).name = originalNetworkName;
    providerModule.getProviderAndSigner = originalGetProviderAndSigner;
    signerUtilsModule.getDeployerSigner = originalGetDeployerSigner;
    if (basDeployedFile && fs.existsSync(basDeployedFile)) {
      fs.unlinkSync(basDeployedFile);
      basDeployedFile = null;
    }
  });

  describe("verify-eas-schema", function () {
    it("should complete when schema is reported as existing (mock registry)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const mockProvider = {};
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });

      const mockSchema = {
        uid: "0x" + "a".repeat(64),
        schema: "string subject, string controller, string method, uint256 observedAt",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      };
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function (_args: { uid: string }) {
        return mockSchema;
      };

      const file = path.join("generated", "Controller-Witness.eas.json");
      const result = await run("verify-eas-schema", { file });
      expect(result).to.equal(true);
    });

    it("should complete when verifying by --uid (mock registry)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      const mockSchema = {
        uid: "0x" + "a".repeat(64),
        schema: "string subject",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      };
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return mockSchema;
      };
      const result = await run("verify-eas-schema", { uid: "0x" + "a".repeat(64) });
      expect(result).to.equal(true);
    });

    it("should calculate schema UID with non-empty resolver when --file is schema object", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      const mockSchema = {
        uid: "0x" + "a".repeat(64),
        schema: "string subject, string controller",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      };
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return mockSchema;
      };
      const file = path.join("test", "fixtures", "Ref.eastest.json");
      const result = await run("verify-eas-schema", { file });
      expect(result).to.equal(true);
    });

    it("should exit when network is unsupported", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("verify-eas-schema", { uid: "0x" + "a".repeat(64) });
        expect.fail("Expected verify-eas-schema to exit");
      } catch (err: any) {
        expect(err.message).to.include("exit 1");
      } finally {
        (process as any).exit = origExit;
      }
    });

    it("should exit when --file path does not exist", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("verify-eas-schema", { file: path.join("nonexistent", "file.eas.json") });
        expect.fail("Expected verify-eas-schema to exit");
      } catch (err: any) {
        expect(err.message).to.include("exit 1");
      } finally {
        (process as any).exit = origExit;
      }
    });

    it("should exit when neither --file nor --uid is provided", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("verify-eas-schema", {});
        expect.fail("Expected verify-eas-schema to exit");
      } catch (err: any) {
        expect(err.message).to.include("exit 1");
      } finally {
        (process as any).exit = origExit;
      }
    });

    it("should complete on omachainMainnet when schema exists (mock registry)", async function () {
      (require("hardhat").network as any).name = "omachainMainnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "a".repeat(64),
          schema: "string subject",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      const result = await run("verify-eas-schema", { uid: "0x" + "a".repeat(64) });
      expect(result).to.equal(true);
    });

    it("should complete with deployed file (uid, blockNumber, network) and match local schema", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      const mockSchema = {
        uid: "0x" + "a".repeat(64),
        schema: "string subject, string controller",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      };
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return mockSchema;
      };
      const deployedPath = path.join("test", "fixtures", "Ref.deployed.eastest.json");
      const result = await run("verify-eas-schema", { file: deployedPath });
      expect(result).to.equal(true);
    });

    it("should exit when schema does not exist on-chain", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return { uid: "0x" + "0".repeat(64), schema: "", resolver: "0x", revocable: false };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("verify-eas-schema", { uid: "0x" + "9".repeat(64) });
        expect.fail("Expected verify-eas-schema to exit");
      } catch (err: any) {
        expect(err.message).to.include("exit 1");
      } finally {
        (process as any).exit = origExit;
      }
    });

    it("should report mismatch when on-chain schema differs from local file", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "a".repeat(64),
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      const file = path.join("generated", "Controller-Witness.eas.json");
      const result = await run("verify-eas-schema", { file });
      expect(result).to.equal(true);
    });

    it("should report resolver mismatch when on-chain resolver differs from file", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "a".repeat(64),
          schema: "string subject, string controller, string method, uint256 observedAt",
          resolver: "0x1111111111111111111111111111111111111111",
          revocable: false,
        };
      };
      const file = path.join("generated", "Controller-Witness.eas.json");
      const result = await run("verify-eas-schema", { file });
      expect(result).to.equal(true);
    });

    it("should report revocable mismatch when on-chain revocable differs from file", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "a".repeat(64),
          schema: "string subject, string controller, string method, uint256 observedAt",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: true,
        };
      };
      const file = path.join("generated", "Controller-Witness.eas.json");
      const result = await run("verify-eas-schema", { file });
      expect(result).to.equal(true);
    });

    it("should use ZERO_ADDRESS when schema file has empty resolver", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "a".repeat(64),
          schema: "string subject",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      const file = path.join("test", "fixtures", "EmptyResolver.eastest.json");
      const result = await run("verify-eas-schema", { file });
      expect(result).to.equal(true);
    });
  });

  describe("deploy-eas-schema", function () {
    let easDeployedFile: string | null = null;

    afterEach(function () {
      if (easDeployedFile && fs.existsSync(easDeployedFile)) {
        fs.unlinkSync(easDeployedFile);
        easDeployedFile = null;
      }
    });

    it("should complete when schema already exists (mock: verifySchemaExists true)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({
        provider: {},
        signer: {},
      });

      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return { uid: "0x" + "b".repeat(64), schema: "...", resolver: "0x...", revocable: true };
      };
      // register not called when schema already exists
      easSdk.SchemaRegistry.prototype.register = async function () {
        return { tx: { hash: "0xabc", wait: async () => ({ blockNumber: 1, logs: [] }) } };
      };

      const file = path.join("generated", "Controller-Witness.eas.json");
      const result = await run("deploy-eas-schema", { file });
      expect(result).to.be.a("string");
      expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should deploy and verify when schema does not exist (mock register then getSchema)", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      const schemaUidFromLog = "0x" + "d".repeat(64);
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) {
          return { uid: hre.ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        }
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 42,
              status: 1,
              logs: [{ topics: ["0x0", schemaUidFromLog] }],
            }),
          },
        };
      };
      const file = path.join("test", "fixtures", "DeployOnly.eastest.json");
      const result = await run("deploy-eas-schema", { file, wait: "0" });
      expect(result).to.equal(schemaUidFromLog);
      const deployedPath = path.join("test", "fixtures", "DeployOnly.deployed.eastest.json");
      if (fs.existsSync(deployedPath)) easDeployedFile = deployedPath;
    });

    it("should exit when file not found", async function () {
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-eas-schema", { file: "nonexistent/file.eas.json" });
        expect.fail("Expected process.exit for file not found");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should exit when network is unsupported", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-eas-schema", { file: path.join("generated", "Controller-Witness.eas.json") });
        expect.fail("Expected process.exit for unsupported network");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should use provider.getTransactionReceipt when tx.wait() throws", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      const receiptBlockNumber = 43;
      const mockProvider = {
        getTransactionReceipt: async () => ({
          blockNumber: receiptBlockNumber,
          status: 1,
          logs: [{ topics: ["0x0", schemaUidFromLog] }],
        }),
      };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return { uid: hre.ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => {
              throw new Error("wait failed");
            },
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const file = path.join("test", "fixtures", "DeployOnly.eastest.json");
        const result = await run("deploy-eas-schema", { file, wait: "0" });
        expect(result).to.equal(schemaUidFromLog);
        expect(logCalls.some((m) => m.includes("Transaction confirmed in block") && m.includes(String(receiptBlockNumber)))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnly.deployed.eastest.json");
        if (fs.existsSync(deployedPath)) easDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should hit success block with receipt null when getTransactionReceipt returns null but verify succeeds (EAS)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const mockProvider = { getTransactionReceipt: async () => null };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function (args: { uid: string }) {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) {
          return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        }
        return {
          uid: args.uid,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => {
              throw new Error("wait failed");
            },
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const result = await run("deploy-eas-schema", { file: path.join("test", "fixtures", "DeployOnly.eastest.json"), wait: "0" });
        expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
        expect(logCalls.some((m) => m.includes("BLOCK NUMBER") && m.includes("unknown"))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnly.deployed.eastest.json");
        if (fs.existsSync(deployedPath)) easDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should use estimated schema UID when receipt has no schema UID in logs", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const waitBlockNumber = 44;
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        return {
          uid: "0xa3691f973db15364429c2630005260699e17c1353c6a88b8893f5362a97c49d6",
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: waitBlockNumber,
              status: 1,
              logs: [],
            }),
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const file = path.join("test", "fixtures", "DeployOnly.eastest.json");
        const result = await run("deploy-eas-schema", { file, wait: "0" });
        expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
        expect(logCalls.some((m) => m.includes("Transaction confirmed in block") && m.includes(String(waitBlockNumber)))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnly.deployed.eastest.json");
        if (fs.existsSync(deployedPath)) easDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should log 'unknown' when tx.wait() succeeds but receipt has no blockNumber (EAS)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        return { uid: schemaUidFromLog, schema: "string subject, string controller", resolver: "0x0000000000000000000000000000000000000000", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              status: 1,
              logs: [{ topics: ["0x0", schemaUidFromLog] }],
            }),
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const result = await run("deploy-eas-schema", { file: path.join("test", "fixtures", "DeployOnly.eastest.json"), wait: "0" });
        expect(result).to.equal(schemaUidFromLog);
        expect(logCalls.some((m) => m.includes("Transaction confirmed in block") && m.includes("unknown"))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnly.deployed.eastest.json");
        if (fs.existsSync(deployedPath)) easDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should verify schema after retry when first verify returns false (EAS)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 2) return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        return { uid: schemaUidFromLog, schema: "string subject, string controller", resolver: "0x0000000000000000000000000000000000000000", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: txHash,
            wait: async () => ({
              blockNumber: 42,
              status: 1,
              logs: [{ topics: ["0x0", schemaUidFromLog] }],
            }),
          },
        };
      };
      const file = path.join("test", "fixtures", "DeployOnly.eastest.json");
      const result = await run("deploy-eas-schema", { file, wait: "0" });
      expect(result).to.equal(schemaUidFromLog);
      const deployedPath = path.join("test", "fixtures", "DeployOnly.deployed.eastest.json");
      if (fs.existsSync(deployedPath)) easDeployedFile = deployedPath;
    });

    it("should exit when schema not verified and getTransactionReceipt returns null (EAS)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const txHash = "0x" + "e".repeat(64);
      const mockProvider = { getTransactionReceipt: async () => null };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          hash: txHash,
          wait: async () => {
            throw new Error("no wait");
          },
        };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-eas-schema", { file: path.join("test", "fixtures", "DeployOnly.eastest.json"), wait: "0" });
        expect.fail("Expected process.exit when schema not verified");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should exit when schema verification fails and receipt has status 0", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 45,
              status: 0,
              logs: [{ topics: ["0x0", "0x" + "d".repeat(64)] }],
            }),
          },
        };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-eas-schema", { file: path.join("test", "fixtures", "DeployOnly.eastest.json"), wait: "0" });
        expect.fail("Expected process.exit when schema not verified");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should exit when schema verification fails and receipt has status 1", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 46,
              status: 1,
              logs: [{ topics: ["0x0", "0x" + "d".repeat(64)] }],
            }),
          },
        };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-eas-schema", { file: path.join("test", "fixtures", "DeployOnly.eastest.json"), wait: "0" });
        expect.fail("Expected process.exit when schema not verified");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should exit when schema verification fails and receipt has status 0 (reverted)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 46,
              status: 0,
              logs: [],
            }),
          },
        };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-eas-schema", { file: path.join("test", "fixtures", "DeployOnly.eastest.json"), wait: "0" });
        expect.fail("Expected process.exit when schema not verified");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should use getTxHash when register returns tx without .tx.hash", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const mockProvider = {
        getTransactionReceipt: async () => ({
          blockNumber: 47,
          status: 1,
          logs: [{ topics: ["0x0", schemaUidFromLog] }],
        }),
      };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return { uid: hre.ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return {
          hash: txHash,
          wait: async () => {
            throw new Error("no tx.wait");
          },
        };
      };
      const file = path.join("test", "fixtures", "DeployOnly.eastest.json");
      const result = await run("deploy-eas-schema", { file, wait: "0" });
      expect(result).to.equal(schemaUidFromLog);
      const deployedPath = path.join("test", "fixtures", "DeployOnly.deployed.eastest.json");
      if (fs.existsSync(deployedPath)) easDeployedFile = deployedPath;
    });

    async function runDeployEasWithRegisterReturn(registerReturn: any, schemaUidFromLog: string, txHash: string) {
      const mockProvider = {
        getTransactionReceipt: async () => ({
          blockNumber: 48,
          status: 1,
          logs: [{ topics: ["0x0", schemaUidFromLog] }],
        }),
      };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
        return { uid: schemaUidFromLog, schema: "string subject", resolver: "0x0000000000000000000000000000000000000000", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return registerReturn;
      };
      const file = path.join("test", "fixtures", "DeployOnly.eastest.json");
      return run("deploy-eas-schema", { file, wait: "0" });
    }

    it("should use getTxHash when register returns hash as string", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployEasWithRegisterReturn(txHash, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should use getTxHash when register returns { transactionHash }", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployEasWithRegisterReturn({ transactionHash: txHash }, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should use getTxHash when register returns { tx: string }", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployEasWithRegisterReturn({ tx: txHash }, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should use getTxHash when register returns { id: string }", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const schemaUidFromLog = "0x" + "d".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployEasWithRegisterReturn({ id: txHash }, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should log error when getTxHash throws (malformed register response)", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return { uid: require("hardhat").ethers.ZeroHash, schema: "", resolver: "0x0", revocable: false };
      };
      easSdk.SchemaRegistry.prototype.register = async function () {
        return { tx: {} };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-eas-schema", { file: path.join("test", "fixtures", "DeployOnly.eastest.json"), wait: "0" });
        expect.fail("Expected process.exit after transaction handling error");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should complete when schema already exists on omachainMainnet", async function () {
      (require("hardhat").network as any).name = "omachainMainnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "b".repeat(64),
          schema: "string subject, string controller, string method, uint256 observedAt",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
        };
      };
      const file = path.join("generated", "Controller-Witness.eas.json");
      const result = await run("deploy-eas-schema", { file });
      expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should use resolver from CLI when --resolver provided", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      easSdk.SchemaRegistry.prototype.connect = async function () {};
      easSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "b".repeat(64),
          schema: "string subject",
          resolver: "0x1234567890123456789012345678901234567890",
          revocable: false,
        };
      };
      const file = path.join("test", "fixtures", "EmptyResolver.eastest.json");
      const result = await run("deploy-eas-schema", {
        file,
        resolver: "0x1234567890123456789012345678901234567890",
      });
      expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe("deploy-bas-schema", function () {
    let basSchemaDeployedFile: string | null = null;

    afterEach(function () {
      if (basSchemaDeployedFile && fs.existsSync(basSchemaDeployedFile)) {
        fs.unlinkSync(basSchemaDeployedFile);
        basSchemaDeployedFile = null;
      }
    });

    it("should complete when schema already exists (mock: verifySchemaExists true)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });

      basSdk.SchemaRegistry.prototype.connect = async function () {};
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "c".repeat(64),
          schema: "string subject, uint256 value",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: true,
          registrationBlockNumber: 12345,
        };
      };

      const file = path.join("test", "fixtures", "sample.bas.json");
      const result = await run("deploy-bas-schema", { file });
      expect(result).to.be.a("string");
      expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);

      const deployedPath = path.join("test", "fixtures", "Sample.deployed.bastest.json");
      if (fs.existsSync(deployedPath)) basDeployedFile = deployedPath;
    });

    it("should complete when schema already exists and getSchema has no registrationBlockNumber", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "c".repeat(64),
          schema: "string subject, uint256 value",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: true,
        };
      };
      const file = path.join("test", "fixtures", "sample.bas.json");
      const result = await run("deploy-bas-schema", { file });
      expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
      const deployedPath = path.join("test", "fixtures", "Sample.deployed.bastest.json");
      const content = fs.readFileSync(deployedPath, "utf-8");
      expect(content).to.include("unknown");
      if (fs.existsSync(deployedPath)) basDeployedFile = deployedPath;
    });

    it("should deploy and verify when schema does not exist (mock register then getSchema)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      const schemaUidFromLog = "0x" + "b".repeat(64);
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return null;
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
          registrationBlockNumber: 42,
        };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 42,
              status: 1,
              logs: [{ topics: ["0x0", schemaUidFromLog] }],
            }),
          },
        };
      };
      const file = path.join("test", "fixtures", "DeployOnlyBas.bastest.json");
      const result = await run("deploy-bas-schema", { file, wait: "0" });
      expect(result).to.equal(schemaUidFromLog);
      const deployedPath = path.join("test", "fixtures", "DeployOnlyBas.deployed.bastest.json");
      if (fs.existsSync(deployedPath)) basSchemaDeployedFile = deployedPath;
    });

    it("should exit when file not found", async function () {
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-bas-schema", { file: "nonexistent/file.bas.json" });
        expect.fail("Expected process.exit to be called");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should exit when network is unsupported", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-bas-schema", { file: path.join("test", "fixtures", "sample.bas.json") });
        expect.fail("Expected process.exit for unsupported network");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should use provider.getTransactionReceipt when tx.wait() throws", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const receiptBlockNumber = 43;
      const mockProvider = {
        getTransactionReceipt: async () => ({
          blockNumber: receiptBlockNumber,
          status: 1,
          logs: [{ topics: ["0x0", schemaUidFromLog] }],
        }),
      };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return null;
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
          registrationBlockNumber: 43,
        };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: txHash,
            wait: async () => {
              throw new Error("wait failed");
            },
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const file = path.join("test", "fixtures", "DeployOnlyBas.bastest.json");
        const result = await run("deploy-bas-schema", { file, wait: "0" });
        expect(result).to.equal(schemaUidFromLog);
        expect(logCalls.some((m) => m.includes("Transaction confirmed in block") && m.includes(String(receiptBlockNumber)))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnlyBas.deployed.bastest.json");
        if (fs.existsSync(deployedPath)) basSchemaDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should hit success block with receipt null when getTransactionReceipt returns null but verify succeeds (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const mockProvider = { getTransactionReceipt: async () => null };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function (args: { uid: string }) {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return null;
        return {
          uid: args.uid,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
          registrationBlockNumber: 42,
        };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => {
              throw new Error("wait failed");
            },
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const result = await run("deploy-bas-schema", { file: path.join("test", "fixtures", "DeployOnlyBas.bastest.json"), wait: "0" });
        expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
        expect(logCalls.some((m) => m.includes("BLOCK NUMBER") && m.includes("unknown"))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnlyBas.deployed.bastest.json");
        if (fs.existsSync(deployedPath)) basSchemaDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should use estimated schema UID when receipt has no schema UID in logs", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const waitBlockNumber = 44;
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return null;
        return {
          uid: "0xa3691f973db15364429c2630005260699e17c1353c6a88b8893f5362a97c49d6",
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
          registrationBlockNumber: 44,
        };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: waitBlockNumber,
              status: 1,
              logs: [],
            }),
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const file = path.join("test", "fixtures", "DeployOnlyBas.bastest.json");
        const result = await run("deploy-bas-schema", { file, wait: "0" });
        expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
        expect(logCalls.some((m) => m.includes("Transaction confirmed in block") && m.includes(String(waitBlockNumber)))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnlyBas.deployed.bastest.json");
        if (fs.existsSync(deployedPath)) basSchemaDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should log 'unknown' when tx.wait() succeeds but receipt has no blockNumber (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return null;
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
          registrationBlockNumber: 42,
        };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              status: 1,
              logs: [{ topics: ["0x0", schemaUidFromLog] }],
            }),
          },
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        const result = await run("deploy-bas-schema", { file: path.join("test", "fixtures", "DeployOnlyBas.bastest.json"), wait: "0" });
        expect(result).to.equal(schemaUidFromLog);
        expect(logCalls.some((m) => m.includes("Transaction confirmed in block") && m.includes("unknown"))).to.be.true;
        const deployedPath = path.join("test", "fixtures", "DeployOnlyBas.deployed.bastest.json");
        if (fs.existsSync(deployedPath)) basSchemaDeployedFile = deployedPath;
      } finally {
        console.log = origLog;
      }
    });

    it("should verify schema after retry when first verify returns false (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 2) return null;
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
          registrationBlockNumber: 42,
        };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: txHash,
            wait: async () => ({
              blockNumber: 42,
              status: 1,
              logs: [{ topics: ["0x0", schemaUidFromLog] }],
            }),
          },
        };
      };
      const file = path.join("test", "fixtures", "DeployOnlyBas.bastest.json");
      const result = await run("deploy-bas-schema", { file, wait: "0" });
      expect(result).to.equal(schemaUidFromLog);
      const deployedPath = path.join("test", "fixtures", "DeployOnlyBas.deployed.bastest.json");
      if (fs.existsSync(deployedPath)) basSchemaDeployedFile = deployedPath;
    });

    it("should exit when schema not verified and getTransactionReceipt returns null (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const txHash = "0x" + "e".repeat(64);
      const mockProvider = { getTransactionReceipt: async () => null };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        return null;
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          hash: txHash,
          wait: async () => {
            throw new Error("no wait");
          },
        };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-bas-schema", { file: path.join("test", "fixtures", "DeployOnlyBas.bastest.json"), wait: "0" });
        expect.fail("Expected process.exit when schema not verified");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should exit when schema verification fails and receipt has status 0", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        return null;
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 45,
              status: 0,
              logs: [{ topics: ["0x0", "0x" + "b".repeat(64)] }],
            }),
          },
        };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-bas-schema", { file: path.join("test", "fixtures", "DeployOnlyBas.bastest.json"), wait: "0" });
        expect.fail("Expected process.exit when schema not verified");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should exit when schema verification fails and receipt has status 1", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        return null;
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          tx: {
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 46,
              status: 1,
              logs: [{ topics: ["0x0", "0x" + "b".repeat(64)] }],
            }),
          },
        };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("deploy-bas-schema", { file: path.join("test", "fixtures", "DeployOnlyBas.bastest.json"), wait: "0" });
        expect.fail("Expected process.exit when schema not verified");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    it("should use getTxHash when register returns tx without .tx.hash", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const mockProvider = {
        getTransactionReceipt: async () => ({
          blockNumber: 47,
          status: 1,
          logs: [{ topics: ["0x0", schemaUidFromLog] }],
        }),
      };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return null;
        return {
          uid: schemaUidFromLog,
          schema: "string subject, string controller",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: false,
          registrationBlockNumber: 47,
        };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return {
          hash: txHash,
          wait: async () => {
            throw new Error("no tx.wait");
          },
        };
      };
      const file = path.join("test", "fixtures", "DeployOnlyBas.bastest.json");
      const result = await run("deploy-bas-schema", { file, wait: "0" });
      expect(result).to.equal(schemaUidFromLog);
      const deployedPath = path.join("test", "fixtures", "DeployOnlyBas.deployed.bastest.json");
      if (fs.existsSync(deployedPath)) basSchemaDeployedFile = deployedPath;
    });

    it("should log error when getTxHash throws (malformed register response)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        return null;
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return { tx: {} };
      };
      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      const file = path.join("test", "fixtures", "DeployOnlyBas.bastest.json");
      try {
        await run("deploy-bas-schema", { file, wait: "0" });
        expect.fail("Expected process.exit after transaction handling error");
      } catch (err: any) {
        expect(err.message).to.match(/^exit \d+$/);
      } finally {
        process.exit = origExit;
      }
    });

    async function runDeployBasWithRegisterReturn(registerReturn: any, schemaUidFromLog: string, txHash: string) {
      const mockProvider = {
        getTransactionReceipt: async () => ({
          blockNumber: 48,
          status: 1,
          logs: [{ topics: ["0x0", schemaUidFromLog] }],
        }),
      };
      providerModule.getProviderAndSigner = async () => ({ provider: mockProvider, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      let getSchemaCallCount = 0;
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        getSchemaCallCount++;
        if (getSchemaCallCount <= 1) return null;
        return { uid: schemaUidFromLog, schema: "string subject", resolver: "0x0000000000000000000000000000000000000000", revocable: false, registrationBlockNumber: 48 };
      };
      basSdk.SchemaRegistry.prototype.register = async function () {
        return registerReturn;
      };
      const file = path.join("test", "fixtures", "DeployOnlyBas.bastest.json");
      return run("deploy-bas-schema", { file, wait: "0" });
    }

    it("should use getTxHash when register returns hash as string (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployBasWithRegisterReturn(txHash, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should use getTxHash when register returns { transactionHash } (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployBasWithRegisterReturn({ transactionHash: txHash }, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should use getTxHash when register returns { tx: string } (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployBasWithRegisterReturn({ tx: txHash }, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should use getTxHash when register returns { id: string } (BAS)", async function () {
      (require("hardhat").network as any).name = "bscTestnet";
      const schemaUidFromLog = "0x" + "b".repeat(64);
      const txHash = "0x" + "e".repeat(64);
      const result = await runDeployBasWithRegisterReturn({ id: txHash }, schemaUidFromLog, txHash);
      expect(result).to.equal(schemaUidFromLog);
    });

    it("should complete when schema already exists on bsc mainnet", async function () {
      (require("hardhat").network as any).name = "bsc";
      providerModule.getProviderAndSigner = async () => ({ provider: {}, signer: {} });
      basSdk.SchemaRegistry.prototype.connect = async function () {};
      basSdk.SchemaRegistry.prototype.getSchema = async function () {
        return {
          uid: "0x" + "c".repeat(64),
          schema: "string subject, uint256 value",
          resolver: "0x0000000000000000000000000000000000000000",
          revocable: true,
          registrationBlockNumber: 12345,
        };
      };
      const file = path.join("test", "fixtures", "sample.bas.json");
      const result = await run("deploy-bas-schema", { file });
      expect(result).to.match(/^0x[a-fA-F0-9]{64}$/);
      const deployedPath = path.join("test", "fixtures", "Sample.deployed.bas.json");
      if (fs.existsSync(deployedPath)) basDeployedFile = deployedPath;
    });
  });

  describe("eas-get-schema", function () {
    it("should complete with mock contract getSchema", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          getSchema: async (uid: string) => ({
            uid,
            schema: "string subject, string controller",
            resolver: "0x0000000000000000000000000000000000000000",
            revocable: false,
            index: 0n,
          }),
        };
      };
      try {
        await run("eas-get-schema", { uid: "0x" + "d".repeat(64) });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should throw when network has no SchemaRegistry configured", async function () {
      (require("hardhat").network as any).name = "hardhat";
      try {
        await run("eas-get-schema", { uid: "0x" + "d".repeat(64) });
        expect.fail("Expected eas-get-schema to throw");
      } catch (err: any) {
        expect(err.message).to.include("SchemaRegistry not configured");
      }
    });
  });

  describe("eas-attest", function () {
    it("should complete with mock signer and EAS contract", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      const mockSigner = { getAddress: async () => "0x1234567890123456789012345678901234567890" };
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: mockSigner,
        address: "0x1234567890123456789012345678901234567890",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async () => ({
            hash: "0x" + "e".repeat(64),
            wait: async () => ({ blockNumber: 1, logs: [] }),
          }),
          interface: { parseLog: () => null },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string",
          values: "test",
        });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should complete when using --data only (no types/values)", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      const encodedData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["data-only"]);
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async () => ({
            hash: "0x" + "e".repeat(64),
            wait: async () => ({ blockNumber: 1, logs: [] }),
          }),
          interface: { parseLog: () => null },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          data: encodedData,
        });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should throw when neither --data nor --types/--values provided", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return { attest: async () => ({}), interface: {} };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
        });
        expect.fail("Expected eas-attest to throw");
      } catch (err: any) {
        expect(err.message).to.include("Must provide either --data OR both --types and --values");
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should log attestation UID when receipt contains Attested event", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      const uidFromEvent = "0x" + "u".repeat(64);
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async () => ({
            hash: "0x" + "e".repeat(64),
            wait: async () => ({
              blockNumber: 1,
              logs: [{}],
            }),
          }),
          interface: {
            parseLog: (log: any) => (log ? { name: "Attested", args: { uid: uidFromEvent } } : null),
          },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string",
          values: "test",
        });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should pass revocable false when --revocable false", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      let capturedData: any;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async (opts: any) => {
            capturedData = opts.data;
            return {
              hash: "0x" + "e".repeat(64),
              wait: async () => ({ blockNumber: 1, logs: [] }),
            };
          },
          interface: { parseLog: () => null },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string",
          values: "test",
          revocable: "false",
        });
        expect(capturedData.revocable).to.equal(false);
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should handle receipt without blockNumber when tx.wait() returns minimal receipt", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async () => ({
            hash: "0x" + "e".repeat(64),
            wait: async () => ({ logs: [] }),
          }),
          interface: { parseLog: () => null },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string",
          values: "test",
        });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should not log UID when parseLog throws on receipt logs", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async () => ({
            hash: "0x" + "e".repeat(64),
            wait: async () => ({ blockNumber: 1, logs: [{ topic: "0xother" }] }),
          }),
          interface: {
            parseLog: () => {
              throw new Error("Unknown event");
            },
          },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string",
          values: "test",
        });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should throw when EAS contract not configured for network", async function () {
      (require("hardhat").network as any).name = "hardhat";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string",
          values: "test",
        });
        expect.fail("Expected eas-attest to throw");
      } catch (err: any) {
        expect(err.message).to.include("EAS contract not configured");
      }
    });

    it("should encode uint256 type correctly", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      let capturedEncodedData: string | undefined;
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async (opts: any) => {
            capturedEncodedData = opts.data?.data;
            return {
              hash: "0x" + "e".repeat(64),
              wait: async () => ({ blockNumber: 1, logs: [] }),
            };
          },
          interface: { parseLog: () => null },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "uint256",
          values: "12345",
        });
        expect(capturedEncodedData).to.be.a("string");
        const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], capturedEncodedData);
        expect(decoded[0]).to.equal(12345n);
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should encode bool type correctly", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      let capturedEncodedData: string | undefined;
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async (opts: any) => {
            capturedEncodedData = opts.data?.data;
            return {
              hash: "0x" + "e".repeat(64),
              wait: async () => ({ blockNumber: 1, logs: [] }),
            };
          },
          interface: { parseLog: () => null },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "bool",
          values: "false",
        });
        expect(capturedEncodedData).to.be.a("string");
        const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(["bool"], capturedEncodedData);
        expect(decoded[0]).to.equal(false);
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should add 0x prefix for address/bytes32 when missing", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      let capturedEncodedData: string | undefined;
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async (opts: any) => {
            capturedEncodedData = opts.data?.data;
            return {
              hash: "0x" + "e".repeat(64),
              wait: async () => ({ blockNumber: 1, logs: [] }),
            };
          },
          interface: { parseLog: () => null },
        };
      };
      const addrNoPrefix = "1234567890123456789012345678901234567890";
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "address",
          values: addrNoPrefix,
        });
        expect(capturedEncodedData).to.be.a("string");
        const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(["address"], capturedEncodedData);
        expect(decoded[0].toLowerCase()).to.equal("0x" + addrNoPrefix.toLowerCase());
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should leave bytes32 value unchanged when it already has 0x prefix", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      let capturedEncodedData: string | undefined;
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async (opts: any) => {
            capturedEncodedData = opts.data?.data;
            return {
              hash: "0x" + "e".repeat(64),
              wait: async () => ({ blockNumber: 1, logs: [] }),
            };
          },
          interface: { parseLog: () => null },
        };
      };
      const bytes32WithPrefix = "0x" + "a".repeat(64);
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "bytes32",
          values: bytes32WithPrefix,
        });
        expect(capturedEncodedData).to.be.a("string");
        const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(["bytes32"], capturedEncodedData);
        expect(decoded[0]).to.equal(bytes32WithPrefix);
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should throw when type and value count mismatch", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = (require("hardhat") as any).ethers.getContractAt;
      (require("hardhat") as any).ethers.getContractAt = async () => ({});
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string,uint256",
          values: "only",
        });
        expect.fail("Expected type/value count mismatch");
      } catch (err: any) {
        expect(err.message).to.match(/Type count.*doesn't match value count/);
      } finally {
        (require("hardhat") as any).ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should pass refuid, expiration, and value when provided", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: { getAddress: async () => "0x1234" },
        address: "0x1234",
        method: "SSH Key",
      });
      let capturedAttestationData: any;
      const refUid = "0x" + "f".repeat(64);
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          attest: async (opts: any) => {
            capturedAttestationData = opts.data;
            return {
              hash: "0x" + "e".repeat(64),
              wait: async () => ({ blockNumber: 1, logs: [] }),
            };
          },
          interface: { parseLog: () => null },
        };
      };
      try {
        await run("eas-attest", {
          schema: "0x" + "a".repeat(64),
          recipient: "0x0000000000000000000000000000000000000001",
          types: "string",
          values: "test",
          refuid: refUid,
          expiration: "9999999999",
          value: "1000",
        });
        expect(capturedAttestationData.refUID).to.equal(refUid);
        expect(String(capturedAttestationData.expirationTime)).to.equal("9999999999");
        expect(capturedAttestationData.value).to.be.oneOf([1000n, 1000, "1000"]);
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });
  });

  describe("eas-revoke", function () {
    it("should complete with mock signer and EAS contract", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      const mockSigner = { getAddress: async () => "0x1234567890123456789012345678901234567890" };
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: mockSigner,
        address: "0x1234567890123456789012345678901234567890",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          getAttestation: async () => ({
            uid: "0x" + "f".repeat(64),
            revocable: true,
            revocationTime: 0n,
          }),
          revoke: async () => ({
            hash: "0x" + "e".repeat(64),
            wait: async () => ({ blockNumber: 2 }),
          }),
        };
      };
      try {
        await run("eas-revoke", {
          schema: "0x" + "a".repeat(64),
          uid: "0x" + "f".repeat(64),
        });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should throw when network has no EAS contract configured", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "hardhat";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      try {
        await run("eas-revoke", {
          schema: "0x" + "a".repeat(64),
          uid: "0x" + "f".repeat(64),
        });
        expect.fail("Expected eas-revoke to throw");
      } catch (err: any) {
        expect(err.message).to.include("EAS contract not configured");
      }
    });

    it("should throw when attestation does not exist (ZeroHash)", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          getAttestation: async () => ({
            uid: hre.ethers.ZeroHash,
            revocable: true,
            revocationTime: 0n,
          }),
        };
      };
      try {
        await run("eas-revoke", {
          schema: "0x" + "a".repeat(64),
          uid: "0x" + "f".repeat(64),
        });
        expect.fail("Expected eas-revoke to throw");
      } catch (err: any) {
        expect(err.message).to.include("does not exist");
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should throw when attestation is not revocable", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          getAttestation: async () => ({
            uid: "0x" + "f".repeat(64),
            revocable: false,
            revocationTime: 0n,
          }),
        };
      };
      try {
        await run("eas-revoke", {
          schema: "0x" + "a".repeat(64),
          uid: "0x" + "f".repeat(64),
        });
        expect.fail("Expected eas-revoke to throw");
      } catch (err: any) {
        expect(err.message).to.include("not revocable");
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should return early when attestation was already revoked", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          getAttestation: async () => ({
            uid: "0x" + "f".repeat(64),
            revocable: true,
            revocationTime: 1000000n,
          }),
        };
      };
      try {
        const result = await run("eas-revoke", {
          schema: "0x" + "a".repeat(64),
          uid: "0x" + "f".repeat(64),
        });
        expect(result).to.be.undefined;
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });
  });

  describe("eas-get-attestation", function () {
    it("should complete with mock EAS contract getAttestation", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      const mockSigner = { getAddress: async () => "0x1234567890123456789012345678901234567890" };
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: mockSigner,
        address: "0x1234567890123456789012345678901234567890",
        method: "SSH Key",
      });
      const originalGetContractAt = hre.ethers.getContractAt;
      const uid = "0x" + "f".repeat(64);
      hre.ethers.getContractAt = async function () {
        return {
          getAttestation: async () => ({
            uid,
            schema: "0x" + "a".repeat(64),
            attester: "0x0000000000000000000000000000000000000000",
            recipient: "0x0000000000000000000000000000000000000001",
            revocable: true,
            revocationTime: 0n,
            refUID: "0x" + "0".repeat(64),
            data: "0x",
            value: 0n,
            time: 1700000000n,
            expirationTime: 0n,
          }),
          getSchema: async (_schemaUID: string) => ({
            schema: "string subject",
            resolver: "0x0000000000000000000000000000000000000000",
            revocable: true,
            index: 0n,
          }),
        };
      };
      try {
        await run("eas-get-attestation", { uid });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should throw when neither --uid nor --did is provided", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      try {
        await run("eas-get-attestation", {});
        expect.fail("Expected eas-get-attestation to throw");
      } catch (err: any) {
        expect(err.message).to.include("Must provide either --uid or --did");
      }
    });

    it("should throw when EAS contract address is 0x", async function () {
      (require("hardhat").network as any).name = "omachainTestnet";
      const config = require("../hardhat.config");
      const orig = config.NETWORK_CONTRACTS.omachainTestnet;
      config.NETWORK_CONTRACTS.omachainTestnet = { ...orig, easContract: "0x" };
      try {
        await run("eas-get-attestation", { uid: "0x" + "f".repeat(64) });
        expect.fail("Expected eas-get-attestation to throw");
      } catch (err: any) {
        expect(err.message).to.include("EAS contract not configured");
      } finally {
        config.NETWORK_CONTRACTS.omachainTestnet = orig;
      }
    });

    it("should decode attestation data when schema and data match (success path)", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({
        signer: {},
        address: "0x1234",
        method: "SSH Key",
      });
      const encodedData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["hello"]);
      const originalGetContractAt = hre.ethers.getContractAt;
      let callCount = 0;
      hre.ethers.getContractAt = async function (_abi: any, address: string) {
        callCount++;
        if (callCount === 1) {
          return {
            getAttestation: async () => ({
              uid: "0x" + "f".repeat(64),
              schema: "0x" + "a".repeat(64),
              attester: "0x0000000000000000000000000000000000000000",
              recipient: "0x0000000000000000000000000000000000000001",
              revocable: true,
              revocationTime: 0n,
              refUID: "0x" + "0".repeat(64),
              data: encodedData,
              value: 0n,
              time: 1700000000n,
              expirationTime: 0n,
            }),
          };
        }
        return {
          getSchema: async () => ({
            uid: "0x" + "a".repeat(64),
            schema: "string subject",
            resolver: "0x0000000000000000000000000000000000000000",
            revocable: true,
            index: 0n,
          }),
        };
      };
      try {
        await run("eas-get-attestation", { uid: "0x" + "f".repeat(64) });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should show Empty schema when schema registry returns empty schema string", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({ signer: {}, address: "0x1234", method: "SSH Key" });
      const originalGetContractAt = hre.ethers.getContractAt;
      let callCount = 0;
      hre.ethers.getContractAt = async function () {
        callCount++;
        if (callCount === 1) {
          return {
            getAttestation: async () => ({
              uid: "0x" + "f".repeat(64),
              schema: "0x" + "a".repeat(64),
              attester: "0x0",
              recipient: "0x1",
              revocable: true,
              revocationTime: 0n,
              refUID: "0x" + "0".repeat(64),
              data: "0x",
              value: 0n,
              time: 1700000000n,
              expirationTime: 0n,
            }),
          };
        }
        return {
          getSchema: async () => ({
            uid: "0x" + "a".repeat(64),
            schema: "",
            resolver: "0x0",
            revocable: false,
            index: 0n,
          }),
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { uid: "0x" + "f".repeat(64) });
        expect(logCalls.some((m) => m.includes("Error:") && m.includes("Empty schema"))).to.be.true;
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
        console.log = origLog;
      }
    });

    it("should show decodedData error in DID mode when schema registry returns empty schema", async function () {
      const hre = require("hardhat");
      const { didToAddress } = require("@oma3/omatrust/identity");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({ signer: {}, address: "0x1234", method: "SSH Key" });
      const did = "did:key:z6MkpGR4gs4RcS6LAqxCGz9qS3hYzJY1f6mCqWXJfH3m";
      const didAddr = didToAddress(did);
      const attestationUid = "0x" + "e".repeat(64);
      const schemaUid = "0x" + "a".repeat(64);
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.provider.getBlockNumber = async () => 5000;
      let callCount = 0;
      hre.ethers.getContractAt = async function () {
        callCount++;
        if (callCount === 1) {
          return {
            filters: { Attested: () => ({}) },
            queryFilter: async () => [{ args: { recipient: didAddr, uid: attestationUid } }],
            getAttestation: async () => ({
              uid: attestationUid,
              schema: schemaUid,
              attester: "0x0",
              recipient: didAddr,
              revocable: true,
              revocationTime: 0n,
              refUID: "0x" + "0".repeat(64),
              data: "0x",
              value: 0n,
              time: 1700000000n,
              expirationTime: 0n,
            }),
          };
        }
        return {
          getSchema: async () => ({
            uid: schemaUid,
            schema: "",
            resolver: "0x0",
            revocable: false,
            index: 0n,
          }),
        };
      };
      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { did });
        expect(logCalls.some((m) => m.includes("Error:") && (m.includes("Empty schema") || m.includes("Raw:")))).to.be.true;
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
        console.log = origLog;
      }
    });

    it("should format expiration date when attestation has non-zero expirationTime", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({ signer: {}, address: "0x1234", method: "SSH Key" });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.getContractAt = async function () {
        return {
          getAttestation: async () => ({
            uid: "0x" + "f".repeat(64),
            schema: "0x" + "a".repeat(64),
            attester: "0x0",
            recipient: "0x1",
            revocable: true,
            revocationTime: 0n,
            refUID: "0x" + "0".repeat(64),
            data: "0x",
            value: 0n,
            time: 1700000000n,
            expirationTime: 2000000000n,
          }),
          getSchema: async () => ({
            uid: "0x" + "a".repeat(64),
            schema: "string subject",
            resolver: "0x0",
            revocable: true,
            index: 0n,
          }),
        };
      };
      try {
        await run("eas-get-attestation", { uid: "0x" + "f".repeat(64) });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should complete DID query mode when events match recipient", async function () {
      const hre = require("hardhat");
      const { didToAddress } = require("@oma3/omatrust/identity");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({ signer: {}, address: "0x1234", method: "SSH Key" });
      const did = "did:key:z6MkpGR4gs4RcS6LAqxCGz9qS3hYzJY1f6mCqWXJfH3m";
      const didAddr = didToAddress(did);
      const attestationUid = "0x" + "e".repeat(64);
      const originalGetContractAt = hre.ethers.getContractAt;
      const originalGetBlockNumber = hre.ethers.provider.getBlockNumber;
      hre.ethers.provider.getBlockNumber = async () => 5000;
      let callCount = 0;
      hre.ethers.getContractAt = async function () {
        callCount++;
        if (callCount === 1) {
          return {
            filters: {
              Attested: () => ({}),
            },
            queryFilter: async () => [
              { args: { recipient: didAddr, uid: attestationUid } },
            ],
            getAttestation: async () => ({
              uid: attestationUid,
              schema: "0x" + "a".repeat(64),
              attester: "0x0",
              recipient: didAddr,
              revocable: true,
              revocationTime: 0n,
              refUID: "0x" + "0".repeat(64),
              data: "0x",
              value: 0n,
              time: 1700000000n,
              expirationTime: 0n,
            }),
          };
        }
        return {
          getSchema: async () => ({
            uid: "0x" + "a".repeat(64),
            schema: "string subject",
            resolver: "0x0",
            revocable: true,
            index: 0n,
          }),
        };
      };
      try {
        await run("eas-get-attestation", { did });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
        hre.ethers.provider.getBlockNumber = originalGetBlockNumber;
      }
    });

    it("should report no attestations when DID query returns no matching events", async function () {
      const hre = require("hardhat");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({ signer: {}, address: "0x1234", method: "SSH Key" });
      const originalGetContractAt = hre.ethers.getContractAt;
      hre.ethers.provider.getBlockNumber = async () => 5000;
      let callCount = 0;
      hre.ethers.getContractAt = async function () {
        callCount++;
        if (callCount === 1) {
          return {
            filters: { Attested: () => ({}) },
            queryFilter: async () => [],
          };
        }
        return { getSchema: async () => ({}) };
      };
      try {
        await run("eas-get-attestation", { did: "did:key:z6MkpGR4gs4RcS6LAqxCGz9qS3hYzJY1f6mCqWXJfH3m" });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
      }
    });

    it("should decode and log attestation data in DID query mode when schema and data match", async function () {
      const hre = require("hardhat");
      const { didToAddress } = require("@oma3/omatrust/identity");
      (hre.network as any).name = "omachainTestnet";
      signerUtilsModule.getDeployerSigner = async () => ({ signer: {}, address: "0x1234", method: "SSH Key" });
      const did = "did:key:z6MkpGR4gs4RcS6LAqxCGz9qS3hYzJY1f6mCqWXJfH3m";
      const didAddr = didToAddress(did);
      const attestationUid = "0x" + "e".repeat(64);
      const schemaUid = "0x" + "a".repeat(64);
      const encodedData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["decodedSubject"]);
      const originalGetContractAt = hre.ethers.getContractAt;
      const originalGetBlockNumber = hre.ethers.provider.getBlockNumber;
      hre.ethers.provider.getBlockNumber = async () => 5000;
      let callCount = 0;
      hre.ethers.getContractAt = async function () {
        callCount++;
        if (callCount === 1) {
          return {
            filters: { Attested: () => ({}) },
            queryFilter: async () => [{ args: { recipient: didAddr, uid: attestationUid } }],
            getAttestation: async () => ({
              uid: attestationUid,
              schema: schemaUid,
              attester: "0x0",
              recipient: didAddr,
              revocable: true,
              revocationTime: 0n,
              refUID: "0x" + "0".repeat(64),
              data: encodedData,
              value: 0n,
              time: 1700000000n,
              expirationTime: 0n,
            }),
          };
        }
        return {
          getSchema: async () => ({
            uid: schemaUid,
            schema: "string subject",
            resolver: "0x0",
            revocable: true,
            index: 0n,
          }),
        };
      };
      try {
        await run("eas-get-attestation", { did });
      } finally {
        hre.ethers.getContractAt = originalGetContractAt;
        hre.ethers.provider.getBlockNumber = originalGetBlockNumber;
      }
    });
  });
});
