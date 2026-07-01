"""Requirements submodel builder (APSO Product AAS).

Follows the APSO ontology module requirements.ttl:
  - Requirements [SMC, 1..*] containing requirement [SMC, 1..*] entries
  - Each requirement has: requirementId, semanticId, description, value, unit, unitSemanticId
"""
from __future__ import annotations

from typing import Dict, Optional
from basyx.aas import model


class RequirementsSubmodelBuilder:
    """Requirements submodel builder — APSO-aligned, basyx SDK based."""

    SEMANTIC_ID = "https://w3id.org/2025/apso#RequirementsSubmodel"

    def __init__(self, base_url: str, semantic_factory, element_factory):
        self.base_url = base_url
        self.semantic_factory = semantic_factory
        self.element_factory = element_factory

    def build(self, system_id: str, config: Dict) -> Optional[model.Submodel]:
        req_config = config.get("Requirements") or {}
        if not req_config:
            return None

        req_entries = req_config.get("Requirements", {}) or {}
        if not req_entries:
            return None

        requirements_collection_elements = []

        for req_name, req in req_entries.items():
            if not isinstance(req, dict):
                continue
            req_elements = []

            req_elements.append(self.element_factory.create_property(
                id_short="requirementId",
                value=req.get("requirementId", req_name),
                value_type=model.datatypes.String,
            ))
            req_elements.append(self.element_factory.create_property(
                id_short="semanticId",
                value=req.get("semanticId", ""),
                value_type=model.datatypes.String,
            ))
            if req.get("description"):
                req_elements.append(self.element_factory.create_property(
                    id_short="description",
                    value=req.get("description", ""),
                    value_type=model.datatypes.String,
                ))
            req_elements.append(self.element_factory.create_property(
                id_short="value",
                value=str(req.get("value", "")),
                value_type=model.datatypes.String,
            ))
            if req.get("unit"):
                req_elements.append(self.element_factory.create_property(
                    id_short="unit",
                    value=req.get("unit", ""),
                    value_type=model.datatypes.String,
                ))
            if req.get("unitSemanticId"):
                req_elements.append(self.element_factory.create_property(
                    id_short="unitSemanticId",
                    value=req.get("unitSemanticId", ""),
                    value_type=model.datatypes.String,
                ))

            requirements_collection_elements.append(model.SubmodelElementCollection(
                id_short=req_name,
                value=req_elements,
            ))

        if not requirements_collection_elements:
            return None

        elements = [model.SubmodelElementCollection(
            id_short="requirements",
            value=requirements_collection_elements,
        )]

        return model.Submodel(
            id_=f"{self.base_url}/submodels/instances/{system_id}/Requirements",
            id_short="Requirements",
            kind=model.ModellingKind.INSTANCE,
            semantic_id=model.ExternalReference(
                key=(model.Key(type_=model.KeyTypes.GLOBAL_REFERENCE, value=self.SEMANTIC_ID),)
            ),
            administration=model.AdministrativeInformation(version="1", revision="0"),
            submodel_element=elements,
        )
