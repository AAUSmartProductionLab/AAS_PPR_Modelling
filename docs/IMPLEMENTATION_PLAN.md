# Implementation Plan — Multi-type AAS, Cleanup & Clearer UI Modelling

Direction agreed with the user:
- **Keep ARSO and APSO separate**; validate an AAS against the shape set chosen by its **type**.
- AAS type is declared by an **explicit `aasType`** on the profile (`Resource | Product | Part`).
- Remove dead/deprecated files; make the remaining structure **well-defined and scalable**.
- LLM guidance: **drop the dead-vocab projection**, reuse the real validator.
- UI: make the **React Flow** connections work consistently, nodes display their content
  consistently, finish the **resource** submodel inputs, and add **generic node-connection rules**.

Grounding facts established during review:
- Projection types every shell as `css:Resource` unconditionally ([aas_to_rdf.py:678-679](../Transformation/AAS_to_RDF/aas_to_rdf.py#L678)).
- ARSO mandatory-submodel restrictions sit on `aas:AssetAdministrationShell` ([ARSO_AAS.ttl:134-181](../Ontology/ARSO/ARSO_AAS.ttl#L134)); APSO restrictions correctly sit on `apso:ProductAAS`.
- APSO is **OWL-only** — no SHACL shapes generated yet.
- `_load_shapes()` loads all shapes unconditionally ([validator.py:197](../Validation/Validator/validator.py#L197)).
- Graph `onConnect` hardwires only 2 semantics via `.includes()` on handle names ([ModelBuilder.tsx:159](../ui/src/components/modelbuilder/ModelBuilder.tsx#L159)).
- Submodel identity is spread across ~9 parallel hardcoded structures; TS `Skill` lacks the `interface` field the Python builder/SHACL require (model drift).

---

## Workstream A — Validation by AAS type (backend; unblocks product)

**A1. Type marker.** Add `aasType?: 'Resource'|'Product'|'Part'` to `SystemConfig`
([resourceaas.ts](../ui/src/types/resourceaas.ts)); the UI already stores `aasType` per node —
write it into the profile and persist it. Default `Resource`.

**A2. ARSO ontology gating.** Add `arso:ResourceAAS rdfs:subClassOf aas:AssetAdministrationShell`
and move the resource-specific mandatory/at-most-one restrictions from `aas:AssetAdministrationShell`
onto it ([ARSO_AAS.ttl:134-181](../Ontology/ARSO/ARSO_AAS.ttl#L134)). Genuinely generic AAS-metamodel
constraints stay on the shell.

**A3. Type-aware projection.** In `aas_to_rdf.convert`, type the shell from the marker: Resource →
`arso:ResourceAAS` (+ existing `css:Resource`/`representsResource`); Product/Part → `apso:ProductAAS`
/`apso:PartAAS` and **skip** the `css:Resource` link ([aas_to_rdf.py:667-679](../Transformation/AAS_to_RDF/aas_to_rdf.py#L667)).

**A4. APSO shapes.** Generalize `generate_shapes.py` (currently ARSO-hardcoded) into a parameterized
generator run per ontology → `Ontology/SHACL/Generated/arso.generated.shacl.ttl` and
`apso.generated.shacl.ttl`. Add APSO manual rules under `Ontology/SHACL/Manual/apso/` as needed.

**A5. SHACL layout + loader.** Reorganize: shared `Manual/aas-shacl-schema.ttl`, plus `Manual/arso/*`
and `Manual/apso/*`. Refactor `_load_shapes(aas_type)` to load **AAS-metamodel + the type's** generated
+ manual shapes. `run_shacl(json_text, tmp_dir, aas_type)` and `validate_rdf_graph(graph, aas_type)`
take the type.

**A6. API.** `ValidateRequest` gains `aas_type` ([models.py](../api/models.py)); `/api/validate`
passes it through; the UI sends `aasType` from the active node.

---

## Workstream B — Cleanup & scalability (backend)

- **Delete `Guidance/config_to_rdf.py`** (dead vocabulary `aau-ra/cssx#` / `resourceaas-validation#`).
- **Rework `ontology_guidance_engine.check_config`** to build the AAS from the (partial) config via
  the existing generator and run `run_shacl` — i.e. reuse the real projection (user's choice). One
  projection, type-aware, no drift.
- **Remove the dead `aas_validator` import branch** ([generate_aas.py:37-53](../Transformation/AAS_Builder/AAS_generation/core/generate_aas.py#L37)).
- **Fix the stale module path** in the validator error string (`Transformation.AAS_Builder.AAS_to_RDF`
  → `Transformation.AAS_to_RDF`, [validator.py:263](../Validation/Validator/validator.py#L263)).
- **Dedupe `_MESSAGE_TO_FIELD`** into one shared module imported by `validate.py` (and guidance);
  extend with product-submodel message patterns.

---

## Workstream C — Single submodel registry (UI scalability backbone)

Create `ui/src/aas/submodelRegistry.ts` — **one entry per submodel**, the single source of truth:

```ts
interface SubmodelDef {
  key: SubmodelKey; yamlKey: string; idShort: string; semanticId: string;
  label: string; description: string; color: string;
  aasTypes: AASType[];                 // which AAS types may use it
  build: (…) => AasSubmodel;           // the TS builder
  rows: (cfg) => NodeRow[];            // node content (consistent shape)
  connectionRoles: ConnectionRole[];   // handles this submodel exposes
}
```

Derive from it (deleting the parallel copies): `ALL_SUBMODELS`, `SUBMODEL_YAML_KEYS`,
`SUBMODEL_FIELD_PREFIXES`, `SUBMODEL_META`, the `buildSubmodels` switch, `IDSHORT_TO_KEY`, and the
`SUBMODEL_SEMANTIC_ID`/`SUBMODEL_IDSHORT` maps. Submodel availability becomes a function of `aasType`.
This removes the class of bug that broke the build (missing `AIMC`).

---

## Workstream D — React Flow: consistent connections & content

**D1. Structured handle IDs.** Replace substring conventions with `role:submodel:item` handle IDs,
parsed once into `{ role, submodel, item }`. No more `.includes('-cap-')`.

**D2. Connection-rule registry** `ui/src/components/modelbuilder/connectionRules.ts`:

```ts
interface ConnectionRule {
  id: string; from: {submodel, role}; to: {submodel, role}; label: string;
  apply(profileApi, src, tgt): void;      // write the relationship into the profile
  remove(profileApi, src, tgt): void;     // undo on edge delete
}
```

`onConnect` / `onEdgesChange` dispatch through this registry instead of hardcoded branches. Rules to
cover: Capability→Skill `realizedBy`; BoM HasPart/IsPartOf/SameAs; **Skill→AID-action** (`skill.interface`
— currently impossible in the graph though SHACL checks it); **AIMC** mapping (Variables/Skills/
Parameters → AID affordance); generic reference fallback. This is the "generic rules between nodes."

**D3. Consistent node content.** Move `getRows` into the registry with a uniform row shape and
consistent truncation/expansion; `SubmodelNode` renders rows + handles **derived from the same
`connectionRoles`**, so handles and rules always line up.

---

## Workstream E — Complete the resource submodel inputs

Audit each resource submodel's form/modal against `resourceaas.ts` + the Python builder; add missing
inputs so every supported field is editable. Known gaps to fix first:
- **`Skill.interface`** — add to the TS `Skill` type and the Skills editor (required by Python
  `_check_required_fields` and the AID-action SHACL rule); reconcile TS↔Python skill model.
- AID full affordance editing (properties/actions/events + forms bindings), Variables, Parameters,
  Capabilities (`semantic_id` + `realizedBy`), Nameplate full field set, AIMC relations editor.

---

## Phasing & dependencies

| Phase | Workstreams | Depends on | Notes |
|-------|-------------|-----------|-------|
| 1 | C (registry) | — | Backbone for all UI work; low risk; fixes build-fragility. |
| 2 | D (connections/content) | C | Highest felt pain ("connections must work"). |
| 3 | E (resource inputs) | C, D | Completes resource modelling. |
| 4 | A (validation by type) | — (parallel) | Backend; unblocks product. A1 shares the `aasType` marker with C/E. |
| 5 | B (cleanup) | A (for guidance rework) | config_to_rdf delete can happen anytime. |
| 6 | Product submodels + UI type-awareness | A, C, D, E | Add APSO submodel builders/forms; surface Product type in UI. |

**Deferred (separate decision):** the server-side single generator (delete TS builders, UI sends
profile only). The Workstream C registry makes that cheaper later; not in this round.

## Resolved decisions
- **PartAAS**: not a separate UI type. Everything product-side is a **Product AAS**; recursive
  assemblies→sub-assemblies→parts are linked via the BoM/hierarchical-structures submodel. Marker is
  `Resource | Product`; projection types products as `apso:ProductAAS`.
- **Shared submodels**: none. The four product submodels are APSO-specific; products link to each
  other through the APSO BoM.

## Multi-AAS workspace rules (added by user)
A workspace can hold **multiple AAS of mixed types** (Resource and Product) at once.
- **Per-AAS validation on every change** — validate **every** AAS node (each against its own type's
  shapes via `/api/validate`), not just the active node. → **Phase D** (extends Phase A plumbing;
  `useValidation` loops over all nodes). Already verified per-type validation works server-side.
- **Two catalogs** (Resource submodels / Product submodels) in the CatalogPanel, driven by registry
  `aasTypes`. → registry tagging in **Phase C**, rendering in **Phase D**.
- **No cross-type submodel drops** — a Product submodel cannot be dropped onto a Resource shell and
  vice versa; enforced in the React Flow drop handler using the target shell's `aasType` and the
  submodel's registry `aasTypes`. → **Phase D**.
