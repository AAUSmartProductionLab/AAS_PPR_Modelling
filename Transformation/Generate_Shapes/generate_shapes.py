"""
Regenerate the per-ontology SHACL shape files under Ontology/SHACL/Generated/.

Applies the owl2sh-semi-closed ruleset to the union of a domain ontology
(ARSO for Resource AAS, APSO for Product AAS) and the locally vendored AAS v3.1
ontology. Each domain ontology produces its own output file so the validator can
load only the shapes relevant to the AAS type being validated:

    ARSO_AAS.ttl  -> Ontology/SHACL/Generated/arso.generated.shacl.ttl
    APSO_AAS.ttl  -> Ontology/SHACL/Generated/apso.generated.shacl.ttl

The inline catalog mirrors each import URI to its local file so rdflib resolves
imports without a network call.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from rdflib import Graph, OWL

from generate_shapes_from_ontology import import_uri_to_local_path, run_owl2shacl_rules


_REPO_ROOT = Path(__file__).resolve().parents[2]
_ONTOLOGY_DIR = _REPO_ROOT / "Ontology"
_GENERATED_DIR = _ONTOLOGY_DIR / "SHACL" / "Generated"

_AAS_RDF_TTL = _ONTOLOGY_DIR / "AAS" / "aas-rdf-ontology.ttl"
_CSS_TTL = _ONTOLOGY_DIR / "CSS" / "CSS-Ontology.ttl"
_RULESET = _ONTOLOGY_DIR / "SHACL" / "owl2shacl" / "owl2sh-semi-closed.ttl"

_ARSO_MODULES = _ONTOLOGY_DIR / "ARSO" / "Modules"
_APSO_MODULES = _ONTOLOGY_DIR / "APSO" / "modules"

# Shared catalog entries (AAS + CSS) used by every domain ontology.
_SHARED_CATALOG: dict[str, Path] = {
    "https://admin-shell.io/aas/3/1/": _AAS_RDF_TTL,
    "https://admin-shell.io/aas/3/1": _AAS_RDF_TTL,
    "http://admin-shell.io/aas/3/1/": _AAS_RDF_TTL,
    "http://www.w3id.org/hsu-aut/css": _CSS_TTL,
    "http://www.w3id.org/hsu-aut/css/": _CSS_TTL,
}


@dataclass
class OntologyConfig:
    """One domain ontology to derive SHACL shapes from."""
    name: str                       # "arso" | "apso"
    root_ttl: Path                  # the *_AAS.ttl entry point
    output: Path                    # generated shapes file
    catalog: dict[str, Path] = field(default_factory=dict)  # import URI -> local file


_CONFIGS: list[OntologyConfig] = [
    OntologyConfig(
        name="arso",
        root_ttl=_ONTOLOGY_DIR / "ARSO" / "ARSO_AAS.ttl",
        output=_GENERATED_DIR / "arso.generated.shacl.ttl",
        catalog={
            "https://w3id.org/2025/arso/modules/nameplate": _ARSO_MODULES / "nameplate.ttl",
            "https://w3id.org/2025/arso/modules/hierarchical-structures": _ARSO_MODULES / "hierarchical-structures.ttl",
            "https://w3id.org/2025/arso/modules/aid": _ARSO_MODULES / "aid.ttl",
            "https://w3id.org/2025/arso/modules/control-component": _ARSO_MODULES / "control-component.ttl",
            "https://w3id.org/2025/arso/modules/capabilities": _ARSO_MODULES / "capabilities.ttl",
            "https://w3id.org/2025/arso/modules/operational-data": _ARSO_MODULES / "operational-data.ttl",
            "https://w3id.org/2025/arso/modules/parameters": _ARSO_MODULES / "parameters.ttl",
            "https://w3id.org/2025/arso/modules/technical-data": _ARSO_MODULES / "technical-data.ttl",
        },
    ),
    OntologyConfig(
        name="apso",
        root_ttl=_ONTOLOGY_DIR / "APSO" / "APSO_AAS.ttl",
        output=_GENERATED_DIR / "apso.generated.shacl.ttl",
        catalog={
            "https://w3id.org/2025/apso/modules/batch-information": _APSO_MODULES / "batch_information.ttl",
            "https://w3id.org/2025/apso/modules/bill-of-materials": _APSO_MODULES / "bill_of_materials.ttl",
            "https://w3id.org/2025/apso/modules/bill-of-process": _APSO_MODULES / "bill_of_process.ttl",
            "https://w3id.org/2025/apso/modules/requirements": _APSO_MODULES / "requirements.ttl",
        },
    ),
]


def _resolve_with_catalog(import_uri: str, parent_file: Path, catalog: dict[str, Path]) -> Path | None:
    canon = import_uri.rstrip("/")
    if import_uri in catalog:
        return catalog[import_uri]
    if canon in catalog:
        return catalog[canon]
    return import_uri_to_local_path(import_uri, parent_file)


def _load_with_imports(target: Graph, ontology_file: Path, visited: set[Path], catalog: dict[str, Path]) -> None:
    resolved = ontology_file.resolve()
    if resolved in visited or not resolved.exists():
        return
    visited.add(resolved)
    g = Graph().parse(str(resolved), format="turtle")
    target += g
    for _, _, imported in g.triples((None, OWL.imports, None)):
        local = _resolve_with_catalog(str(imported), resolved, catalog)
        if local is not None:
            _load_with_imports(target, local, visited, catalog)


def generate(config: OntologyConfig) -> None:
    """Generate the SHACL shapes file for one domain ontology."""
    catalog = {**_SHARED_CATALOG, **config.catalog}

    for required in (config.root_ttl, _AAS_RDF_TTL, _CSS_TTL, _RULESET):
        if not required.exists():
            raise FileNotFoundError(f"Required file not found: {required}")

    ontology_graph = Graph()
    visited: set[Path] = set()
    _load_with_imports(ontology_graph, config.root_ttl, visited, catalog)
    if _AAS_RDF_TTL.resolve() not in visited:
        _load_with_imports(ontology_graph, _AAS_RDF_TTL, visited, catalog)

    rules_graph = Graph().parse(str(_RULESET), format="turtle")
    generated_shapes = run_owl2shacl_rules(ontology_graph, rules_graph)

    config.output.parent.mkdir(parents=True, exist_ok=True)
    generated_shapes.serialize(destination=str(config.output), format="turtle")
    print(f"[{config.name}] generated shapes from {config.root_ttl.name}: {config.output}")
    print(f"[{config.name}] triples in shape graph: {len(generated_shapes)}")


def main() -> None:
    for config in _CONFIGS:
        generate(config)


if __name__ == "__main__":
    main()
