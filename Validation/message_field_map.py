"""Map SHACL validation-result messages to profile/UI field dot-paths.

Single source of truth shared by the API validate router and the LLM guidance
engine, so the two never drift. Patterns are tried in order; first match wins.
Add Product (APSO) message patterns here as the product submodels land.
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
