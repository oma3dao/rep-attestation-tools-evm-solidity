/**
 * Mock tests for EAS tasks that use hre.ethers.getContractAt() for on-chain interaction.
 * Covers: eas-get-schema, eas-revoke, eas-attest, eas-get-attestation.
 *
 * These tasks differ from the SDK-based tasks (deploy/verify) because they create
 * ethers contract instances directly. We mock hre.ethers.getContractAt to return
 * mock contract objects with the appropriate methods.
 */
import { expect } from "chai";
import { run } from "hardhat";
import * as path from "path";

const signerUtilsModule = require("../tasks/shared/signer-utils");
const omatrustIdentity = require("@oma3/omatrust/identity");
const { NETWORK_CONTRACTS } = require("../hardhat.config");

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

const MOCK_SCHEMA_UID = "0x" + "a".repeat(64);
const MOCK_ATTESTATION_UID = "0x" + "b".repeat(64);
const MOCK_SIGNER_ADDRESS = "0x" + "d".repeat(40);
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Real addresses from config — tasks look these up, so our mock must match
const REAL_EAS_ADDRESS = NETWORK_CONTRACTS.omachainTestnet.easContract;
const REAL_SCHEMA_REGISTRY_ADDRESS = NETWORK_CONTRACTS.omachainTestnet.easSchemaRegistry;

function makeMockAttestation(overrides: Partial<Record<string, any>> = {}) {
  return {
    uid: MOCK_ATTESTATION_UID,
    schema: MOCK_SCHEMA_UID,
    attester: MOCK_SIGNER_ADDRESS,
    recipient: "0x" + "c".repeat(40),
    time: BigInt(1700000000),
    expirationTime: 0n,
    revocable: true,
    revocationTime: 0n,
    refUID: ZERO_HASH,
    data: "0x" + "00".repeat(32),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Top-level describe
// ---------------------------------------------------------------------------

describe("EAS contract tasks (mocked getContractAt)", function () {
  const hre = require("hardhat");
  let originalGetContractAt: any;
  let originalGetDeployerSigner: typeof signerUtilsModule.getDeployerSigner;
  let originalNetworkName: string;
  let originalDidToAddress: typeof omatrustIdentity.didToAddress;
  let originalGetBlockNumber: any;

  // Per-test mock contract — each test configures it as needed
  let mockEasContract: any;
  let mockSchemaRegistryContract: any;

  before(function () {
    originalGetContractAt = hre.ethers.getContractAt;
    originalGetDeployerSigner = signerUtilsModule.getDeployerSigner;
    originalDidToAddress = omatrustIdentity.didToAddress;
    originalGetBlockNumber = hre.ethers.provider.getBlockNumber;
  });

  after(function () {
    hre.ethers.getContractAt = originalGetContractAt;
    signerUtilsModule.getDeployerSigner = originalGetDeployerSigner;
    omatrustIdentity.didToAddress = originalDidToAddress;
    hre.ethers.provider.getBlockNumber = originalGetBlockNumber;
  });

  beforeEach(function () {
    originalNetworkName = hre.network.name;
    (hre.network as any).name = "omachainTestnet";

    // Default mock signer
    signerUtilsModule.getDeployerSigner = async () => ({
      signer: {},
      address: MOCK_SIGNER_ADDRESS,
      method: "SSH Key",
    });

    // Reset mock contracts
    mockEasContract = {};
    mockSchemaRegistryContract = {};

    // Route getContractAt by the real config addresses tasks will look up
    hre.ethers.getContractAt = async (_abi: any, address: string, _signer?: any) => {
      if (address === REAL_EAS_ADDRESS) {
        return mockEasContract;
      }
      return mockSchemaRegistryContract;
    };
  });

  afterEach(function () {
    (hre.network as any).name = originalNetworkName;
    signerUtilsModule.getDeployerSigner = originalGetDeployerSigner;
    hre.ethers.getContractAt = originalGetContractAt;
    omatrustIdentity.didToAddress = originalDidToAddress;
    hre.ethers.provider.getBlockNumber = originalGetBlockNumber;
  });

  // =========================================================================
  // eas-get-schema
  // =========================================================================

  describe("eas-get-schema", function () {
    it("should display schema details when schema exists", async function () {
      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "string subject, string controller",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
        index: 42n,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-schema", { uid: MOCK_SCHEMA_UID });
        expect(logCalls.some((m) => m.includes("Schema Details"))).to.be.true;
        expect(logCalls.some((m) => m.includes("string subject, string controller"))).to.be.true;
        expect(logCalls.some((m) => m.includes("Revocable: false"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should exit(1) when schema UID not found (ZeroHash response)", async function () {
      mockSchemaRegistryContract.getSchema = async () => ({
        uid: ZERO_HASH,
        schema: "",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
        index: 0n,
      });

      const origExit = process.exit;
      let exitCode: number | undefined;
      (process as any).exit = function (code: number) {
        exitCode = code;
        throw new Error(`exit ${code}`);
      };
      try {
        await run("eas-get-schema", { uid: MOCK_SCHEMA_UID });
        expect.fail("Expected process.exit");
      } catch (err: any) {
        expect(err.message).to.include("exit 1");
        expect(exitCode).to.equal(1);
      } finally {
        (process as any).exit = origExit;
      }
    });

    it("should exit(1) when schema uid is falsy", async function () {
      mockSchemaRegistryContract.getSchema = async () => ({
        uid: "",
        schema: "",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
        index: 0n,
      });

      const origExit = process.exit;
      (process as any).exit = function (code: number) {
        throw new Error(`exit ${code}`);
      };
      try {
        await run("eas-get-schema", { uid: MOCK_SCHEMA_UID });
        expect.fail("Expected process.exit");
      } catch (err: any) {
        expect(err.message).to.include("exit 1");
      } finally {
        (process as any).exit = origExit;
      }
    });

    it("should display '(empty)' when schema string is empty but uid exists", async function () {
      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: true,
        index: 1n,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-schema", { uid: MOCK_SCHEMA_UID });
        expect(logCalls.some((m) => m.includes("(empty)"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should throw when SchemaRegistry not configured for network", async function () {
      (hre.network as any).name = "unknownNetwork";
      try {
        await run("eas-get-schema", { uid: MOCK_SCHEMA_UID });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("not configured");
      }
    });
  });

  // =========================================================================
  // eas-revoke
  // =========================================================================

  describe("eas-revoke", function () {
    it("should revoke attestation successfully", async function () {
      const attestation = makeMockAttestation();
      mockEasContract.getAttestation = async () => attestation;
      mockEasContract.revoke = async () => ({
        hash: "0x" + "f".repeat(64),
        wait: async () => ({ blockNumber: 100 }),
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-revoke", {
          schema: MOCK_SCHEMA_UID,
          uid: MOCK_ATTESTATION_UID,
        });
        expect(logCalls.some((m) => m.includes("Attestation revoked successfully"))).to.be.true;
        expect(logCalls.some((m) => m.includes("Confirmed in block"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should throw when attestation does not exist (ZeroHash uid)", async function () {
      mockEasContract.getAttestation = async () =>
        makeMockAttestation({ uid: hre.ethers.ZeroHash });

      try {
        await run("eas-revoke", {
          schema: MOCK_SCHEMA_UID,
          uid: MOCK_ATTESTATION_UID,
        });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("does not exist");
      }
    });

    it("should throw when attestation is not revocable", async function () {
      mockEasContract.getAttestation = async () =>
        makeMockAttestation({ revocable: false });

      try {
        await run("eas-revoke", {
          schema: MOCK_SCHEMA_UID,
          uid: MOCK_ATTESTATION_UID,
        });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("not revocable");
      }
    });

    it("should return early with warning when already revoked", async function () {
      mockEasContract.getAttestation = async () =>
        makeMockAttestation({ revocationTime: BigInt(1700000000) });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-revoke", {
          schema: MOCK_SCHEMA_UID,
          uid: MOCK_ATTESTATION_UID,
        });
        expect(logCalls.some((m) => m.includes("already revoked"))).to.be.true;
        // Should NOT have "revoked successfully"
        expect(logCalls.some((m) => m.includes("revoked successfully"))).to.be.false;
      } finally {
        console.log = origLog;
      }
    });

    it("should throw when EAS contract not configured for network", async function () {
      (hre.network as any).name = "unknownNetwork";
      try {
        await run("eas-revoke", {
          schema: MOCK_SCHEMA_UID,
          uid: MOCK_ATTESTATION_UID,
        });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("not configured");
      }
    });
  });

  // =========================================================================
  // eas-attest
  // =========================================================================

  describe("eas-attest", function () {
    const MOCK_RECIPIENT = "0x" + "e".repeat(40);

    function setupAttestMock() {
      const attestedEventLog = { name: "Attested", args: { uid: MOCK_ATTESTATION_UID } };
      mockEasContract.attest = async () => ({
        hash: "0x" + "f".repeat(64),
        wait: async () => ({
          blockNumber: 50,
          logs: [{ topics: ["0x1"] }],
        }),
      });
      mockEasContract.interface = {
        parseLog: (_log: any) => attestedEventLog,
      };
    }

    it("should create attestation with pre-encoded --data", async function () {
      setupAttestMock();

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-attest", {
          schema: MOCK_SCHEMA_UID,
          recipient: MOCK_RECIPIENT,
          data: "0xabcdef",
        });
        expect(logCalls.some((m) => m.includes("Attestation UID") && m.includes(MOCK_ATTESTATION_UID))).to.be.true;
        expect(logCalls.some((m) => m.includes("Confirmed in block"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should encode from --types and --values and create attestation", async function () {
      setupAttestMock();

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-attest", {
          schema: MOCK_SCHEMA_UID,
          recipient: MOCK_RECIPIENT,
          types: "string,uint256",
          values: "hello,42",
        });
        expect(logCalls.some((m) => m.includes("Encoded data from types and values"))).to.be.true;
        expect(logCalls.some((m) => m.includes("Attestation UID") && m.includes(MOCK_ATTESTATION_UID))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should convert uint/int types to BigInt", async function () {
      let capturedData: any;
      mockEasContract.attest = async (args: any) => {
        capturedData = args;
        return {
          hash: "0x" + "f".repeat(64),
          wait: async () => ({ blockNumber: 50, logs: [] }),
        };
      };
      mockEasContract.interface = { parseLog: () => null };

      await run("eas-attest", {
        schema: MOCK_SCHEMA_UID,
        recipient: MOCK_RECIPIENT,
        types: "uint256",
        values: "999",
      });

      expect(capturedData).to.have.property("schema", MOCK_SCHEMA_UID);
      const decodedUint = hre.ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], capturedData.data.data);
      expect(decodedUint[0]).to.equal(999n);
    });

    it("should convert bool type correctly", async function () {
      let capturedData: any;
      mockEasContract.attest = async (args: any) => {
        capturedData = args;
        return {
          hash: "0x" + "f".repeat(64),
          wait: async () => ({ blockNumber: 50, logs: [] }),
        };
      };
      mockEasContract.interface = { parseLog: () => null };

      await run("eas-attest", {
        schema: MOCK_SCHEMA_UID,
        recipient: MOCK_RECIPIENT,
        types: "bool",
        values: "true",
      });

      expect(capturedData).to.have.property("schema", MOCK_SCHEMA_UID);
      const decodedBool = hre.ethers.AbiCoder.defaultAbiCoder().decode(["bool"], capturedData.data.data);
      expect(decodedBool[0]).to.equal(true);
    });

    it("should prepend 0x to bytes32/address values when missing", async function () {
      let capturedData: any;
      mockEasContract.attest = async (args: any) => {
        capturedData = args;
        return {
          hash: "0x" + "f".repeat(64),
          wait: async () => ({ blockNumber: 50, logs: [] }),
        };
      };
      mockEasContract.interface = { parseLog: () => null };

      await run("eas-attest", {
        schema: MOCK_SCHEMA_UID,
        recipient: MOCK_RECIPIENT,
        types: "address",
        values: "e".repeat(40),
      });

      expect(capturedData).to.have.property("schema", MOCK_SCHEMA_UID);
      const decodedAddr = hre.ethers.AbiCoder.defaultAbiCoder().decode(["address"], capturedData.data.data);
      expect(decodedAddr[0].toLowerCase()).to.equal("0x" + "e".repeat(40));
    });

    it("should throw when type count doesn't match value count", async function () {
      try {
        await run("eas-attest", {
          schema: MOCK_SCHEMA_UID,
          recipient: MOCK_RECIPIENT,
          types: "string,uint256",
          values: "onlyOne",
        });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("doesn't match value count");
      }
    });

    it("should throw when neither --data nor --types/--values provided", async function () {
      try {
        await run("eas-attest", {
          schema: MOCK_SCHEMA_UID,
          recipient: MOCK_RECIPIENT,
        });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("Must provide either");
      }
    });

    it("should throw when EAS contract not configured for network", async function () {
      (hre.network as any).name = "unknownNetwork";
      try {
        await run("eas-attest", {
          schema: MOCK_SCHEMA_UID,
          recipient: MOCK_RECIPIENT,
          data: "0xabcdef",
        });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("not configured");
      }
    });
  });

  // =========================================================================
  // eas-get-attestation
  // =========================================================================

  describe("eas-get-attestation", function () {
    it("should display attestation details when queried by --uid", async function () {
      const attestation = makeMockAttestation();
      mockEasContract.getAttestation = async () => attestation;

      // Schema registry for decoding
      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "string subject",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { uid: MOCK_ATTESTATION_UID });
        expect(logCalls.some((m) => m.includes("Attestation Details"))).to.be.true;
        expect(logCalls.some((m) => m.includes(`UID: ${MOCK_ATTESTATION_UID}`))).to.be.true;
        expect(logCalls.some((m) => m.includes(`Schema: ${MOCK_SCHEMA_UID}`))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should decode attestation data using schema definition", async function () {
      // Encode real data for decoding test
      const encoded = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint256"],
        ["TestSubject", BigInt(12345)]
      );
      const attestation = makeMockAttestation({ data: encoded });
      mockEasContract.getAttestation = async () => attestation;

      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "string subject, uint256 value",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { uid: MOCK_ATTESTATION_UID });
        expect(logCalls.some((m) => m.includes("Decoded Data"))).to.be.true;
        expect(logCalls.some((m) => m.includes("subject") && m.includes("TestSubject"))).to.be.true;
        expect(logCalls.some((m) => m.includes("value") && m.includes("12345"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should show error in decoded data when schema is empty", async function () {
      const attestation = makeMockAttestation();
      mockEasContract.getAttestation = async () => attestation;

      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { uid: MOCK_ATTESTATION_UID });
        expect(logCalls.some((m) => m.includes("Error") && m.includes("Empty schema"))).to.be.true;
        expect(logCalls.some((m) => m.includes("Raw:"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should handle decode errors gracefully (return error object)", async function () {
      const attestation = makeMockAttestation({ data: "0xbaaddata" });
      mockEasContract.getAttestation = async () => attestation;

      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "string subject, uint256 value",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { uid: MOCK_ATTESTATION_UID });
        // Should show error in decoded data, not crash
        expect(logCalls.some((m) => m.includes("Error:"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should display expiration and revocation timestamps when set", async function () {
      const attestation = makeMockAttestation({
        expirationTime: BigInt(1800000000),
        revocationTime: BigInt(1750000000),
      });
      mockEasContract.getAttestation = async () => attestation;

      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: true,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { uid: MOCK_ATTESTATION_UID });
        // Should NOT show "Never" or "Not revoked" since both timestamps are set
        expect(logCalls.some((m) => m.includes("Never"))).to.be.false;
        expect(logCalls.some((m) => m.includes("Not revoked"))).to.be.false;
      } finally {
        console.log = origLog;
      }
    });

    it("should query attestations by --did and display results", async function () {
      const didAddress = "0x" + "c".repeat(40);
      omatrustIdentity.didToAddress = (_did: string) => didAddress;

      hre.ethers.provider.getBlockNumber = async () => 20000;

      const attestation = makeMockAttestation({ recipient: didAddress });
      mockEasContract.getAttestation = async () => attestation;
      mockEasContract.filters = {
        Attested: () => ({}),
      };
      mockEasContract.queryFilter = async () => [
        { args: { recipient: didAddress, uid: MOCK_ATTESTATION_UID } },
      ];

      mockSchemaRegistryContract.getSchema = async () => ({
        uid: MOCK_SCHEMA_UID,
        schema: "string subject",
        resolver: "0x0000000000000000000000000000000000000000",
        revocable: false,
      });

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { did: "did:oma3:test" });
        expect(logCalls.some((m) => m.includes("Found 1 attestation"))).to.be.true;
        expect(logCalls.some((m) => m.includes(`UID: ${MOCK_ATTESTATION_UID}`))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should show 'No attestations found' when DID has no matches", async function () {
      const didAddress = "0x" + "c".repeat(40);
      omatrustIdentity.didToAddress = (_did: string) => didAddress;

      hre.ethers.provider.getBlockNumber = async () => 20000;

      mockEasContract.filters = {
        Attested: () => ({}),
      };
      // Return events that don't match the DID address
      mockEasContract.queryFilter = async () => [
        { args: { recipient: "0x" + "9".repeat(40), uid: MOCK_ATTESTATION_UID } },
      ];

      const logCalls: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logCalls.push(args.map(String).join(" "));
      try {
        await run("eas-get-attestation", { did: "did:oma3:test" });
        expect(logCalls.some((m) => m.includes("No attestations found"))).to.be.true;
      } finally {
        console.log = origLog;
      }
    });

    it("should throw when neither --uid nor --did provided", async function () {
      try {
        await run("eas-get-attestation", {});
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("Must provide either");
      }
    });

    it("should throw when EAS contract not configured for network", async function () {
      (hre.network as any).name = "unknownNetwork";
      try {
        await run("eas-get-attestation", { uid: MOCK_ATTESTATION_UID });
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).to.include("not configured");
      }
    });
  });
});
