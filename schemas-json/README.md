# Creating Schemas

Schemas in this repository are defined using [JSON Schema](https://json-schema.org/) (Draft 2020-12), which provides a standard way to describe the structure and validation rules for attestation data. For the complete JSON Schema specification, see the [official documentation](https://json-schema.org/specification).

All schema definitions are located in this directory (`schemas-json/`). Each schema file follows the naming convention `[schema-name].schema.json` (e.g., `endorsement.schema.json`, `security-assessment.schema.json`).

## OMA3 Schema Extensions

In addition to standard JSON Schema properties, OMA3 schemas support custom extension properties (prefixed with `x-oma3-`) that control how schemas are processed and rendered in UIs:

### `x-oma3-skip-reason`

Excludes a field from form generation. Common values:

- `"metadata"` - JSON-LD context fields (`@context`, `@type`)
- `"eas"` - Fields handled by the attestation service (e.g., `attester`)
- `"computed"` - Fields calculated from other data (e.g., `subjectDidHash`)
- `"default"` - Fields with auto-generated defaults that don't need user input

**Example:**
```json
{
  "attester": {
    "type": "string",
    "x-oma3-skip-reason": "eas"
  }
}
```

### `x-oma3-subtype`

Specifies the semantic meaning of a field to control UI rendering and validation. Supported values:

- `"timestamp"` - Unix timestamp in seconds (for `integer` fields). Renders as a datetime picker in UIs.

**Example:**
```json
{
  "issuedAt": {
    "type": "integer",
    "title": "Issued Date",
    "x-oma3-subtype": "timestamp",
    "x-oma3-default": "current-timestamp"
  }
}
```

### `x-oma3-default`

Specifies auto-generation behavior for field defaults. Supported values:

- `"current-timestamp"` - Auto-generates Unix timestamp in seconds (for `integer` fields with `x-oma3-subtype: "timestamp"`)
- `"current-datetime"` - Auto-generates ISO 8601 datetime string (for `string` fields with `format: "date-time"`)
- `"current-date"` - Auto-generates ISO 8601 date string (for `string` fields with `format: "date"`)

**Example:**
```json
{
  "issuedAt": {
    "type": "integer",
    "title": "Issued Date",
    "x-oma3-subtype": "timestamp",
    "x-oma3-default": "current-timestamp"
  }
}
```

### `x-oma3-nested`

Controls rendering style for object fields (boolean):

- `true` - Renders with a container, border, and heading (grouped/nested style)
- `false` or omitted - Renders sub-fields flat at the same level as other fields

**Example:**
```json
{
  "payload": {
    "type": "object",
    "title": "Assessment Payload",
    "x-oma3-nested": true,
    "properties": {
      "assessmentKind": { "type": "string" }
    }
  }
}
```

### `x-oma3-enum`

Provides suggested values for string fields without enforcing strict validation. This allows fields to accept any string value while giving UI tooling hints about recommended/registered values.

Use this instead of standard JSON Schema `enum` when you want:
- Flexibility to accept custom values without schema updates
- UI dropdowns showing suggested values
- Forward compatibility as new values emerge

**Example:**
```json
{
  "proofType": {
    "type": "string",
    "title": "Proof Type",
    "description": "A registered proof type defined in the OMA3 Proof Type Registry.",
    "maxLength": 64,
    "x-oma3-enum": [
      "x402-user",
      "x402-server",
      "onchain-tx"
    ]
  }
}
```

**When to use `x-oma3-enum` vs standard `enum`:**
- Use `x-oma3-enum` for extensible registries (proof types, verification methods, assessment kinds)
- Use standard `enum` for fixed, immutable values (hash algorithms like "keccak256" or "sha256")

### `x-oma3-witness`

Declares that a schema should trigger a Controller Witness API call after a successful attestation. This is a **top-level** schema extension (not on a property) that tells the frontend which fields map to the witness API's `subject` and `controller` parameters.

When present, the frontend automatically calls the Controller Witness API as a non-blocking, fire-and-forget step after the attestation is submitted on-chain. The witness creates an immutable record that a trusted observer saw the controller assertion (DNS TXT or did.json) at a specific point in time. This solves the mutable evidence problem — if the subject later removes their DNS record, the witness attestation preserves the proof.

**Fields:**
- `subjectField` — name of the property containing the subject DID (e.g., `"subject"`)
- `controllerField` — name of the property containing the controller DID (e.g., `"keyId"` for key-binding, `"linkedId"` for linked-identifier)

**Example:**
```json
{
  "title": "Key Binding",
  "type": "object",
  "x-oma3-witness": {
    "subjectField": "subject",
    "controllerField": "keyId"
  },
  "properties": {
    "subject": { "type": "string", "title": "Subject ID" },
    "keyId": { "type": "string", "title": "Key Identifier" }
  }
}
```

**Currently enabled on:**
- **Key Binding** — `controllerField: "keyId"`
- **Linked Identifier** — `controllerField: "linkedId"`

**Notes:**
- The `x-oma3-witness` field does not affect the EAS schema string or on-chain data — it is purely frontend metadata.
- See `developer-docs/docs/api/controller-witness.md` for the full API reference.

## Schema Design Best Practices

1. **Use descriptive titles** - Field titles appear as labels in UIs, so make them clear and self-explanatory
2. **Provide descriptions** - Help users understand what data to enter
3. **Use consistent timestamp formats** - Prefer `integer` with Unix timestamps for consistency and EAS compatibility
4. **Mark required fields** - Include fields in the `required` array at the appropriate level
5. **Choose the right enum strategy**:
   - Use `x-oma3-enum` for extensible registries (allows custom values)
   - Use standard `enum` for fixed, immutable choices (enforces validation)
6. **Add maxLength constraints** - Protect against DDoS attacks with reasonable string length limits
7. **Leverage x-oma3 extensions** - Skip unnecessary fields, auto-generate defaults, and control UI layout

## Example Schema Structure

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://oma3.org/schemas/example-v1.0.0.schema.json",
  "title": "Example Schema",
  "description": "An example attestation schema",
  "type": "object",
  "required": ["subject", "issuedAt"],
  "properties": {
    "attester": {
      "type": "string",
      "x-oma3-skip-reason": "eas"
    },
    "subject": {
      "type": "string",
      "title": "Subject ID"
    },
    "issuedAt": {
      "type": "integer",
      "title": "Issued Date",
      "x-oma3-subtype": "timestamp",
      "x-oma3-default": "current-timestamp"
    },
    "expiresAt": {
      "type": "integer",
      "title": "Expiration Date",
      "x-oma3-subtype": "timestamp"
    },
    "payload": {
      "type": "object",
      "x-oma3-nested": true,
      "properties": {
        "rating": {
          "type": "integer",
          "title": "Rating",
          "minimum": 1,
          "maximum": 5
        }
      }
    }
  }
}
```
