"""Map SHACL validation-result messages to profile/UI field dot-paths.

Single source of truth shared by the API validate router and the LLM guidance
engine, so the two never drift. Patterns are tried in order; first match wins.
"""
from __future__ import annotations

import re

# Resource (ARSO) message → field mappings.
_MESSAGE_TO_FIELD: list[tuple[re.Pattern, str]] = [
    (re.compile(r"DigitalNameplate submodel is mandatory", re.I), "DigitalNameplate"),
    (re.compile(r"HierarchicalStructures.*submodel is mandatory", re.I), "HierarchicalStructures"),
    (re.compile(r"AID submodel must be present", re.I), "AID"),
    (re.compile(r"SoftwareInterface must be present", re.I), "AID"),
    (re.compile(r"ResourceInterface must be mapped", re.I), "AID.InterfaceMQTT"),
    (re.compile(r"SkillInterface.*must use.*ResourceInterface", re.I), "Skills"),
    (re.compile(r"exactly one SkillInterface", re.I), "Skills"),
    (re.compile(r"Skills submodel.*Capabilities submodel", re.I), "Capabilities"),
    (re.compile(r"Capabilities submodel.*Skills submodel", re.I), "Skills"),
    (re.compile(r"provides Skills.*must provide.*Capabilit", re.I), "Capabilities"),
    (re.compile(r"provides Capabilit.*must provide.*Skill", re.I), "Skills"),
    (re.compile(r"Capabilit.*isRealizedBySkill", re.I), "Capabilities"),
    (re.compile(r"serialNumber.*manufacturerName", re.I), "DigitalNameplate"),
    (re.compile(r"HierarchicalStructures.*Name is required", re.I), "HierarchicalStructures.Name"),
    (re.compile(r"BoM entity.*globalAssetId", re.I), "HierarchicalStructures"),
    (re.compile(r"Archetype.*no entity entries", re.I), "HierarchicalStructures"),
    (re.compile(r"sourceSemanticId.*capabilit", re.I), "Capabilities"),
    (re.compile(r"sourceSemanticId.*skill", re.I), "Skills"),
    (re.compile(r"yearOfConstruction", re.I), "DigitalNameplate.YearOfConstruction"),
    (re.compile(r"dateOfManufacture", re.I), "DigitalNameplate.DateOfManufacture"),
    (re.compile(r"serialNumber", re.I), "DigitalNameplate.SerialNumber"),
    (re.compile(r"manufacturerName", re.I), "DigitalNameplate.ManufacturerName"),
    (re.compile(r"ManufacturerName", re.I), "DigitalNameplate.ManufacturerName"),
    (re.compile(r"ContactInformation", re.I), "DigitalNameplate"),
    (re.compile(r"OrderCodeOfManufacturer", re.I), "DigitalNameplate"),
    # Product (APSO)
    (re.compile(r"BatchInformation", re.I), "BatchInformation"),
    (re.compile(r"BillOfMaterials", re.I), "BillOfMaterials"),
    (re.compile(r"BillOfProcess", re.I), "BillOfProcess"),
    (re.compile(r"Requirements submodel", re.I), "Requirements"),
]


def map_message_to_field(message: str) -> str:
    """Return the field dot-path for a validation message, or '' if none match."""
    for pattern, field in _MESSAGE_TO_FIELD:
        if pattern.search(message):
            return field
    return ""


# Submodel idShort aliases → the canonical profile/UI key. The AAS-to-RDF
# projection names a submodel node by its idShort, which is not always the same
# token the editor/profile uses for the section (e.g. the Variables section is
# emitted as the "OperationalData" submodel).
_SUBMODEL_IDSHORT_ALIASES: dict[str, str] = {
    "Nameplate": "DigitalNameplate",
}


def field_from_focus_node(focus_node: str) -> str:
    """Derive the submodel (+ element) a violation sits on, from its focus-node IRI.

    SHACL focus nodes from the projection look like::

        .../submodels/instances/<systemId>/<SubmodelIdShort>[#<elementPath>]

    The submodel idShort is a language-independent field anchor that is present
    even when no message pattern matches. When the focus node points at a nested
    element, the leading element name is appended as ``Submodel.Element``.
    Returns '' if the IRI carries no usable submodel segment.
    """
    if not focus_node:
        return ""
    head, _, fragment = focus_node.partition("#")
    submodel = head.rstrip("/").split("/")[-1]
    if not submodel:
        return ""
    submodel = _SUBMODEL_IDSHORT_ALIASES.get(submodel, submodel)
    if fragment:
        elem = fragment.split("/")[0]
        if elem:
            return f"{submodel}.{elem}"
    return submodel


def map_issue_to_field(message: str, focus_node: str = "", result_path: str = "") -> str:
    """Best field anchor for a SHACL issue.

    Prefers the curated message→field patterns (they encode domain knowledge and
    are often more specific than the structural location), then falls back to the
    focus-node IRI, which is language-independent and present for element-level
    violations. ``result_path`` is accepted for completeness but is intentionally
    not used for anchoring: SHACL result paths are generic AAS-metamodel
    properties (``Submodel/submodelElements``, ``Entity/statements``, …) that do
    not identify the submodel or field.
    """
    field = map_message_to_field(message)
    if field:
        return field
    return field_from_focus_node(focus_node)
