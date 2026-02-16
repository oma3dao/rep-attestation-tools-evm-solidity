# Controller Witness – References (Test Branch)

This branch (`test/repository`) is for repository-wide tests. It includes controller-witness attestation schema and related tooling. Below are the files in **this repo** and pointers to external docs.

## In This Repo (rep-attestation-tools-evm-solidity)

| Asset | Path |
|-------|------|
| Controller Witness schema | `schemas-json/controller-witness.schema.json` |
| Key Binding schema (witness extension) | `schemas-json/key-binding.schema.json` |
| Linked Identifier schema (witness extension) | `schemas-json/linked-identifier.schema.json` |
| Schema docs & extensions | `schemas-json/README.md` (incl. `x-oma3-witness`) |

## External Documentation (Other Repos)

- **Specs & design (workspace root)**  
  - `CONTROLLER-WITNESS-SCHEMA.md` – full controller witness design spec (gates, flow, API contract)  
  - `GITHUB-ISSUE-controller-witness-architecture.md` – architecture overview and proxy setup  

- **OMA Trust specs** (repo: `omatrust-docs`)  
  - `omatrust-docs/specification/omatrust-specification-reputation.md`  
  - `omatrust-docs/specification/omatrust-specification-proofs.md`  
  - `omatrust-docs/specification/omatrust-specification-identity.md`  

- **Developer API** (repo: `developer-docs`)  
  - `developer-docs/docs/api/controller-witness.md`  

Pull those external docs from their respective repositories when you need the full design and API details.
