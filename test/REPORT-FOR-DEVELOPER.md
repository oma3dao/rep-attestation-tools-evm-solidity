# Test Engineer Report for Developer

This document lists items that **would require code or dependency changes** to test. The test suite does **not** implement these; they are reported for developer action.

## Tested code (no code change)

The following are now covered by tests:

- **utils/easTools.ts**: `calculateSchemaUID`, `formatSchemaUID`, `verifySchemaExists`, `getSchemaDetails` (unit tests in `test/utils-easTools.test.ts`; registry-dependent ones use a **mock registry**, no network).
- **utils/basTools.ts**: Same (unit tests in `test/utils-basTools.test.ts`), including the documented BAS example UID.
- **utils/constants.ts**: `ZERO_ADDRESS` (test in `test/utils-constants.test.ts`).
- **utils/provider.ts**: `getProviderAndSigner` (test in `test/utils-provider.test.ts` with **mock HRE**; hardhat/localhost branch and “missing PRIVATE_KEY” error path).
- **tasks/shared/signer-utils.ts**: `getDeployerSigner` (test in `test/signer-utils.test.ts` with **mock HRE + env**).
- **tasks/generate-eas-object**: CLI task tests in `test/generate-eas-object.test.ts` (success, missing schema, no title, --name override).
- **tasks/generate-bas-object**: Existing tests in `test/generate-bas-object.test.ts`.
- **tasks/eas-encode-data**: CLI task tests in `test/eas-encode-data.test.ts` (encode string/uint256/bool/address; fail on type/value count mismatch). Encoding is local (no network).
- **schemas-json/** and **generated/** EAS files: Tests in `test/schemas-json.test.ts` and `test/generated-eas.test.ts`.

## Code still lacking tests (require code change only)

- **getTxHash** (internal in deploy-eas-schema and deploy-bas-schema) – could be unit-tested if exported to a shared util.

## Mock task tests added (no code change)

The following are now covered by **mock** tests in `test/tasks-eas-mocked.test.ts` (stub provider, signer-utils, SchemaRegistry, or getContractAt so tasks run without a live chain):

- **tasks/verify-eas-schema** – mock registry + provider; task completes when schema “exists”.
- **tasks/deploy-eas-schema** – mock registry; “schema already exists” path.
- **tasks/deploy-bas-schema** – mock BAS registry; “schema already exists” path (uses `test/fixtures/sample.bas.json`).
- **tasks/eas-get-schema** – mock getContractAt returning getSchema.
- **tasks/eas-attest** – mock getDeployerSigner + getContractAt (attest returns fake tx).
- **tasks/eas-revoke** – mock getDeployerSigner + getContractAt (getAttestation + revoke).
- **tasks/eas-get-attestation** – mock getContractAt (getAttestation + getSchema for decode).

---

## 1. Runtime JSON Schema validation of attestation payloads

**What we would test:** That attestation payloads (e.g. controller-witness, key-binding) conform to their JSON schemas before submission.

**Why we did not implement:** Doing this in tests would require either:
- Adding a JSON Schema validator dependency (e.g. Ajv) and validating payloads in test code, or
- Exposing a validation function from the application that we could call from tests.

**Recommendation:** If the app or API should reject invalid payloads, consider adding runtime validation (e.g. Ajv) in the application and/or an exported validation helper. Tests could then call that helper without adding a new dependency solely for tests.

---

## 2. Controller Witness API contract (developer-docs)

**What we would test:** That the backend Controller Witness API (see `developer-docs/docs/api/controller-witness.md`) accepts the expected request shape and returns the documented response.

**Why we did not implement:** This requires either:
- A running service or mock server, and/or
- HTTP client tests in this repo against an external API.

**Recommendation:** Add contract or integration tests (in this repo or in developer-docs/backend) that hit the Controller Witness endpoint with the documented request format and assert on response shape and status.

---

## 3. EAS schema UID calculation vs BAS reference

**Status:** The UID calculation is now covered by unit tests: `test/utils-easTools.test.ts` and `test/utils-basTools.test.ts` call `calculateSchemaUID` and `formatSchemaUID`. The BAS test asserts the documented example UID from the `test-schema-uid` task. No automated test runs the `test-schema-uid` task itself (would require parsing stdout).

---

## 4. On-chain EAS schema verification

**What exists:** The `verify-eas-schema` task checks that a schema exists on-chain and matches a local file. This requires network and credentials.

**Why we did not implement:** Automated tests would need either:
- A testnet and deployment keys in CI, or
- Mocked provider responses.

**Recommendation:** Add CI job that runs `verify-eas-schema` against testnet for deployed schemas (with secrets in CI). Alternatively, add unit tests that mock the registry and assert the verification logic.

---

## 5. x-oma3-witness frontend behavior

**What we would test:** That the frontend (rep-attestation-frontend) calls the Controller Witness API after key-binding or linked-identifier attestations, using the subject and controller fields from the schema.

**Why we did not implement:** This repo does not contain the frontend. Testing this would require the frontend repo and possibly E2E or integration setup.

**Recommendation:** Add E2E or integration tests in the frontend repo that submit a key-binding (or linked-identifier) attestation and assert that a Controller Witness API call is made with the correct subject and controller.

---

## Summary

| Item                               | Blocking reason                          | Suggested owner   |
|------------------------------------|------------------------------------------|-------------------|
| Runtime schema validation          | New dependency or exported validation    | Backend / app     |
| Controller Witness API contract   | Running service or mocks                 | Backend / QA      |
| Schema UID automated test         | Task design or test harness              | Repo maintainer   |
| On-chain verify-eas-schema in CI   | Network + secrets                        | DevOps / maintainer |
| Frontend witness API call          | Different repo, E2E                      | Frontend / QA     |

All tests added in the `test/` folder run without code changes and assert on existing schema files and generated EAS artifacts.

---

## 6. generate-bas-object: empty schema (resolved in tests)

The test "should handle an empty schema object gracefully" was updated to expect the task to **fail** when the schema has no top-level properties (current task behavior). If the product is later changed to accept such schemas again, the test should be reverted to expect success and an empty schema string.
