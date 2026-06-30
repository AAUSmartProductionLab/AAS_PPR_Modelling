# Extending to Product AAS (APSO) — Architecture Review & Plan

Scope: **manual modelling** path (UI builders + profile→full-AAS generation + guidance/validation).
LLM generation is intentionally out of scope here. This document records the assessment of the
current design, the correctness issues found, and the recommended approach to support **Product
AAS** validated by the **APSO** ontology alongside the existing **Resource AAS** (ARSO).

---

## 1. How the manual path works today

```
UI form edits → parsedProfile (compact per-system dict)
  → buildSubmodels() switch → ui/src/aas/builders/*.ts → serializer → full AAS JSON
  → POST /api/validate → aas_to_rdf → run_shacl (arso#/css# shapes)
  → issues (+ _MESSAGE_TO_FIELD) → GuidancePanel (live, debounced 400 ms)
```

- "Guidance" in the manual path = `/api/validate` + a regex field-map. The `Guidance/` Python
  package is **only** used by the server-side LLM generator, not the UI.
- The Python generator (`AAS_generation`) is **presence-driven** — it builds a submodel iff its
  config section exists — and already ships **Process-AAS** builders. Good extension precedent.

## 2. Correctness issues found

| # | Issue | Where | Impact |
|---|-------|-------|--------|
| C1 | **Mandatory-submodel constraints are on the generic shell, not a resource class.** "Every AAS must have one DigitalNameplate/HierarchicalStructures" restricts `aas:AssetAdministrationShell`. | [ARSO_AAS.ttl:134-181](../Ontology/ARSO/ARSO_AAS.ttl#L134) | **Blocks product support** — `apso:ProductAAS` is a subclass of the shell, so it would inherit resource requirements. |
| C2 | **`config_to_rdf.py` emits a dead vocabulary** (`aau-ra/cssx#`, `resourceaas-validation#`); nothing in `Ontology/` uses those NS (live NS are `w3id.org/2025/arso#`, `hsu-aut/css#`). | [config_to_rdf.py:12-14](../Guidance/config_to_rdf.py#L12) | LLM "ontology hints" are effectively empty; only the hardcoded auto-fixes act. Not on the manual path. |
| C3 | **Profile→full-AAS implemented twice** (TS builders + Python builders), already drifting (e.g. `revision` differs). | [ui/src/aas/builders/](../ui/src/aas/builders/) vs [AAS_generation/submodels/](../Transformation/AAS_Builder/AAS_generation/submodels/) | Every submodel written & maintained twice. |
| C4 | **Submodel set defined in ~9 parallel hardcoded structures**, none keyed by AAS type. | `useAppStore.ts`, `catalogMeta.ts`, `SubmodelAdvancedPanel.tsx`, `importAasJson` | The class of bug that broke the UI build (missing `AIMC`). |
| C5 | **`_MESSAGE_TO_FIELD` duplicated** in two modules. | [validate.py:25](../api/routers/validate.py#L25), [ontology_guidance_engine.py:21](../Guidance/ontology_guidance_engine.py#L21) | Drift. |
| C6 | **`generate_shapes.py` and `_load_shapes()` are ARSO-hardcoded** (single output file, single generated-shapes path). | [generate_shapes.py](../Transformation/Generate_Shapes/generate_shapes.py), [validator.py:197](../Validation/Validator/validator.py#L197) | APSO shapes can't be generated/loaded without changes. |

## 3. APSO assessment

APSO is **well-designed and symmetric to ARSO**: `w3id.org/2025/apso#`, modular `owl:imports`
(batch-information, bill-of-materials, bill-of-process, requirements), OWL cardinality
restrictions, and `apso:ProductAAS rdfs:subClassOf aas:AssetAdministrationShell`. Crucially its
restrictions are correctly scoped to `apso:ProductAAS` (gated). Mandatory set: **BatchInformation
[1], BoM [1], BoP [1], Requirements [0..1]** — different from resource (Nameplate + HS).

Conclusion: APSO needs no structural change. The work is making **ARSO + the projection + the
tooling** type-aware so both shape sets coexist in one graph (the simplest validation model).

## 4. Recommended approach

### Decisions taken
- **Server-side generator** (confirmed: live guidance is preserved — the UI already round-trips
  to `/api/validate` on every edit; only the local *build* step moves server-side).
- **Type-gated shapes, one graph** for validation (enabled by the ARSO refactor below).

### Phase 1 — Ontology gating (unblocks everything; no app code)
- Add `arso:ResourceAAS rdfs:subClassOf aas:AssetAdministrationShell`. Move the resource-specific
  mandatory/at-most-one submodel restrictions ([ARSO_AAS.ttl:134-181](../Ontology/ARSO/ARSO_AAS.ttl#L134))
  from `aas:AssetAdministrationShell` onto `arso:ResourceAAS` (mirrors `apso:ProductAAS`). Keep
  genuinely generic AAS-metamodel constraints on the shell.
- Generalize `generate_shapes.py` to a parameterized entry that emits ARSO **and** APSO generated
  shapes; have `_load_shapes()` glob the `Generated/` dir instead of one hardcoded file.

### Phase 2 — Type-aware RDF projection
- `aas_to_rdf` must type each shell as `arso:ResourceAAS` **or** `apso:ProductAAS`. Needs a
  discriminator in the AAS (e.g. an explicit type marker / assetType convention). Without it,
  neither gated shape set fires.

### Phase 3 — Single registry + server-side generator
- Introduce **one submodel registry** (`{ key, yamlKey, idShort, semanticId, builder, aasTypes[],
  meta }`) as the single source of truth; derive the UI catalog, build dispatch, and import-map
  from it. Replaces the ~9 parallel structures (fixes C4).
- Add product submodel builders (BatchInformation, BoM, Requirements, BoP) to the Python
  generator following the Process-builder pattern; register them for `aasTypes: ['Product']`.
- Add `POST /api/build-and-validate` (profile → `{ aas_json, issues }`). Switch the UI to send the
  **profile**; delete `ui/src/aas/builders/*`, `serializer.ts`, `parseAasToProfile.ts` (fixes C3).
  One generator now serves manual + LLM.

### Phase 4 — UI type-awareness & guidance cleanup
- Gate available submodels and catalog labels by `aasType` (already stored, currently unused).
- Dedupe `_MESSAGE_TO_FIELD` into one module; extend it with product-submodel messages (fixes C5).
- Decide `config_to_rdf` fate: either retarget to the live vocab or (preferred) delete it and have
  the LLM guidance reuse `aas_to_rdf` + `run_shacl` on a partial AAS (fixes C2, removes duplication).

## 5. Open questions
- **Type discriminator**: how should an AAS declare Resource vs Product in the profile/JSON so the
  projection can type the shell? (assetType convention? explicit field?)
- **PartAAS**: APSO has `apso:PartAAS subClassOf apso:ProductAAS` — surface it as a third UI type or
  treat as a Product variant?
- **Shared submodels**: do any resource submodels (e.g. DigitalNameplate) also apply to products,
  or is the product nameplate a distinct APSO submodel?
